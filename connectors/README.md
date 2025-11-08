# Kafka Connectors

This directory contains Kafka Connect connector configurations and plugins for capturing database changes using Debezium.

## What is Kafka Connect?

Kafka Connect is a framework for streaming data between Apache Kafka and other systems (databases, key-value stores, search indexes, file systems). It uses:

- **Source Connectors** - Import data FROM external systems INTO Kafka
- **Sink Connectors** - Export data FROM Kafka INTO external systems

This project uses a **Debezium PostgreSQL Source Connector** to capture database changes.

## Directory Structure

```
connectors/
├── register-postgres.json          # Connector configuration
└── debezium-connector-postgres/    # Debezium plugin JARs (v3.4.0.Alpha1)
    ├── debezium-connector-postgres-3.4.0.Alpha1.jar
    ├── debezium-core-3.4.0.Alpha1.jar
    ├── debezium-api-3.4.0.Alpha1.jar
    ├── postgresql-42.7.7.jar
    └── ...
```

The plugin directory is mounted into Kafka Connect via docker-compose.yml at:
```
/usr/share/confluent-hub-components/custom-connectors
```

## Connector Configuration

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

## Managing the Connector

### Register the Connector

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @connectors/register-postgres.json
```

### Check Connector Status

```bash
curl http://localhost:8083/connectors/user-connector/status | jq
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

2. Check if the connector plugin is loaded:
```bash
curl http://localhost:8083/connector-plugins | jq
```

Look for `io.debezium.connector.postgresql.PostgresConnector`.

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

## Learning Resources

- [Debezium PostgreSQL Connector Docs](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)
- [Kafka Connect REST API](https://docs.confluent.io/platform/current/connect/references/restapi.html)
- [PostgreSQL Logical Replication](https://www.postgresql.org/docs/current/logical-replication.html)

## Next Steps

After registering the connector, try:

1. Create a user via the API
2. View the CDC event in Kafbat UI
3. Update the user and observe the before/after values
4. Delete the user and see the tombstone event
5. Compare CDC events with the direct `user.created` topic
