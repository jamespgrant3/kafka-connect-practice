# Kafka Connectors

This directory contains Kafka Connect connector configurations and plugins for capturing database changes using Debezium.

## What is Kafka Connect?

Kafka Connect is a framework for streaming data between Apache Kafka and other systems (databases, key-value stores, search indexes, file systems). It uses:

- **Source Connectors** - Import data FROM external systems INTO Kafka
- **Sink Connectors** - Export data FROM Kafka INTO external systems

This project demonstrates both connector types:
- **Debezium PostgreSQL Source Connector** - Captures database changes and publishes to Kafka
- **Neo4j Sink Connector** - Consumes Kafka events and writes to a graph database

## Directory Structure

```
connectors/
├── register-postgres.json          # Debezium source connector configuration
├── sink.pattern.neo4j.json         # Neo4j sink connector configuration
├── debezium-connector-postgres/    # Debezium plugin JARs (v3.4.0.Alpha1)
│   ├── debezium-connector-postgres-3.4.0.Alpha1.jar
│   ├── debezium-core-3.4.0.Alpha1.jar
│   ├── debezium-api-3.4.0.Alpha1.jar
│   ├── postgresql-42.7.7.jar
│   └── ...
└── neo4j-connector/                # Neo4j plugin JAR (v5.1.18)
    └── neo4j-kafka-connect-5.1.18.jar
```

The plugin directories are mounted into Kafka Connect via docker-compose.yml at:
```
/usr/share/confluent-hub-components/custom-connectors
```

## Connector Configurations

### Debezium PostgreSQL Source Connector

**File:** `register-postgres.json`

```json
{
  "name": "user-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "tasks.max": "1",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "postgres",
    "database.password": "postgres",
    "database.dbname": "postgres",
    "schema.include.list": "public",
    "plugin.name": "pgoutput"
  }
}
```

### Configuration Properties

| Property | Value | Description |
|----------|-------|-------------|
| `name` | `user-connector` | Unique name for this connector instance |
| `connector.class` | `PostgresConnector` | Debezium PostgreSQL connector class |
| `tasks.max` | `1` | Number of parallel tasks (1 for single connector) |
| `database.hostname` | `postgres` | PostgreSQL container hostname |
| `database.port` | `5432` | PostgreSQL port |
| `database.user` | `postgres` | Database username |
| `database.password` | `postgres` | Database password |
| `database.dbname` | `postgres` | Database name |
| `schema.include.list` | `public` | Capture changes only from the public schema |
| `plugin.name` | `pgoutput` | PostgreSQL logical decoding output plugin |

### Why pgoutput?

`pgoutput` is PostgreSQL's native logical replication protocol (available since PostgreSQL 10). It requires no additional plugin installation and is production-ready. Alternative plugins include `decoderbufs` and `wal2json`, but pgoutput is the recommended default.

### Neo4j Sink Connector

**File:** `sink.pattern.neo4j.json`

```json
{
  "name": "neo4j-sink",
  "config": {
    "topics": "postgres.public.users",
    "connector.class": "org.neo4j.connectors.kafka.sink.Neo4jConnector",
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": "false",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "true",
    "neo4j.uri": "bolt://neo4j:7687",
    "neo4j.authentication.type": "NONE",
    "neo4j.cypher.topic.postgres.public.users": "MERGE (u:User {id: event.after.id}) SET u.firstName = event.after.firstName, u.lastName = event.after.lastName, u.isActive = event.after.isActive, u.createdAt = event.after.createdAt, u.updatedAt = event.after.updatedAt"
  }
}
```

#### Configuration Properties

| Property | Value | Description |
|----------|-------|-------------|
| `name` | `neo4j-sink` | Unique name for this connector instance |
| `topics` | `postgres.public.users` | Kafka topic to consume from |
| `connector.class` | `Neo4jConnector` | Neo4j sink connector class |
| `neo4j.uri` | `bolt://neo4j:7687` | Neo4j connection URI |
| `neo4j.authentication.type` | `NONE` | No authentication (dev only) |
| `neo4j.cypher.topic.*` | Cypher query | Custom Cypher query to process events |

#### Cypher Query Pattern

The connector uses a MERGE pattern to create or update user nodes:

```cypher
MERGE (u:User {id: event.after.id})
SET u.firstName = event.after.firstName,
    u.lastName = event.after.lastName,
    u.isActive = event.after.isActive,
    u.createdAt = event.after.createdAt,
    u.updatedAt = event.after.updatedAt
```

This query:
- Creates a `User` node if it doesn't exist (based on `id`)
- Updates all properties if the node already exists
- Handles both INSERT and UPDATE events from Debezium

## Managing the Connectors

### Register the Debezium Connector

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @connectors/register-postgres.json
```

### Register the Neo4j Connector

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @connectors/sink.pattern.neo4j.json
```

### Check Connector Status

Check Debezium connector:
```bash
curl http://localhost:8083/connectors/user-connector/status | jq
```

Check Neo4j connector:
```bash
curl http://localhost:8083/connectors/neo4j-sink/status | jq
```

Expected output:
```json
{
  "name": "user-connector",
  "connector": {
    "state": "RUNNING",
    "worker_id": "kafka-connect:8083"
  },
  "tasks": [
    {
      "id": 0,
      "state": "RUNNING",
      "worker_id": "kafka-connect:8083"
    }
  ]
}
```

### List All Connectors

```bash
curl http://localhost:8083/connectors | jq
```

### Get Connector Configuration

```bash
curl http://localhost:8083/connectors/user-connector | jq
```

### Pause the Connector

```bash
curl -X PUT http://localhost:8083/connectors/user-connector/pause
```

### Resume the Connector

```bash
curl -X PUT http://localhost:8083/connectors/user-connector/resume
```

### Restart the Connector

```bash
curl -X POST http://localhost:8083/connectors/user-connector/restart
```

### Delete the Connector

```bash
curl -X DELETE http://localhost:8083/connectors/user-connector
```

## Kafka Topics Created

When the connector runs, Debezium automatically creates Kafka topics:

### 1. Data Change Topics

**Format:** `<database>.<schema>.<table>`

For the `users` table:
```
postgres.public.users
```

This topic contains INSERT, UPDATE, and DELETE events for the users table.

### 2. Internal Topics (managed by Kafka Connect)

- `connect-configs` - Connector configurations
- `connect-offsets` - Tracks which changes have been processed
- `connect-status` - Connector and task status

## Event Structure

Each change event includes:

```json
{
  "before": null,          // Previous row state (null for INSERT)
  "after": {               // New row state
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  },
  "source": {              // Metadata
    "version": "3.4.0.Alpha1",
    "connector": "postgresql",
    "name": "postgres",
    "ts_ms": 1234567890,
    "snapshot": "false",
    "db": "postgres",
    "schema": "public",
    "table": "users",
    "txId": 123,
    "lsn": 456
  },
  "op": "c",               // Operation: c=create, u=update, d=delete, r=read
  "ts_ms": 1234567890
}
```

## Viewing Data in Neo4j

After creating users via the API, view the synchronized graph data in Neo4j Browser:

1. Open http://localhost:7474
2. Run this Cypher query to see all users:
```cypher
MATCH (u:User) RETURN u
```

3. View user properties:
```cypher
MATCH (u:User)
RETURN u.id, u.firstName, u.lastName, u.isActive, u.createdAt, u.updatedAt
```

4. Count users:
```cypher
MATCH (u:User) RETURN count(u)
```

The Neo4j Browser provides a visual graph interface where you can see nodes and their properties.

## Troubleshooting

### Check Kafka Connect Logs

```bash
docker logs kafka-connect
```

### Connector Not Starting

1. Verify PostgreSQL is configured with `wal_level=logical`:
```bash
docker exec -it postgres psql -U postgres -c "SHOW wal_level;"
```

2. Check if the connector plugins are loaded:
```bash
curl http://localhost:8083/connector-plugins | jq
```

Look for:
- `io.debezium.connector.postgresql.PostgresConnector`
- `org.neo4j.connectors.kafka.sink.Neo4jConnector`

### No Events Appearing

1. Verify connector is running:
```bash
curl http://localhost:8083/connectors/user-connector/status
```

2. Check Kafka topics exist:
```bash
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list
```

3. Verify database changes are being made:
```bash
curl http://localhost:8000/users
```

### View Topic Messages

Using Kafbat UI (recommended):
- Open http://localhost:8080
- Navigate to Topics → `postgres.public.users`

Using Kafka CLI:
```bash
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic postgres.public.users \
  --from-beginning
```

### Neo4j Data Not Appearing

1. Verify Neo4j connector is running:
```bash
curl http://localhost:8083/connectors/neo4j-sink/status | jq
```

2. Check if Neo4j is accessible:
```bash
docker logs neo4j
```

3. Verify data in Neo4j Browser (http://localhost:7474):
```cypher
MATCH (u:User) RETURN u LIMIT 10
```

4. Check connector logs for errors:
```bash
docker logs kafka-connect | grep -i neo4j
```

## Learning Resources

- [Debezium PostgreSQL Connector Docs](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)
- [Neo4j Kafka Connector Docs](https://neo4j.com/docs/kafka/current/)
- [Kafka Connect REST API](https://docs.confluent.io/platform/current/connect/references/restapi.html)
- [PostgreSQL Logical Replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [Neo4j Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)

## Next Steps

After registering both connectors, try:

1. Create a user via the API
2. View the CDC event in Kafbat UI
3. Verify the user appears in Neo4j Browser
4. Update the user and observe the before/after values in Kafka
5. Check that the Neo4j node was updated
6. Delete the user and see the tombstone event
7. Compare CDC events with the direct `user.created` topic
