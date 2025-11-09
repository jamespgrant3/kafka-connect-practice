# Neo4j Kafka Sink Connector

This directory contains the Neo4j Kafka Sink Connector plugin for streaming data from Kafka topics into a Neo4j graph database.

## What is the Neo4j Sink Connector?

The Neo4j Kafka Sink Connector is a plugin that consumes messages from Kafka topics and writes them to Neo4j using Cypher queries. It enables real-time synchronization of data from Kafka into a graph database.

## Plugin Details

**Version:** 5.1.18
**File:** `neo4j-kafka-connect-5.1.18.jar`
**Official Connector:** Neo4j Streams
**License:** Apache 2.0

## Installation

The connector JAR is mounted into Kafka Connect via `docker-compose.yml`:

```yaml
volumes:
  - ./connectors/neo4j-connector:/usr/share/confluent-hub-components/custom-connectors/neo4j-connector
```

Kafka Connect automatically discovers the plugin at startup.

## Configuration

The connector is configured in `connectors/sink.pattern.neo4j.json`:

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

## How It Works

### Data Flow

1. Debezium captures changes from PostgreSQL
2. Changes are published to the `postgres.public.users` topic
3. Neo4j connector consumes messages from the topic
4. Connector executes custom Cypher query for each message
5. User nodes are created or updated in Neo4j

### Cypher Query Pattern

The connector uses the `MERGE` pattern to handle both inserts and updates:

```cypher
MERGE (u:User {id: event.after.id})
SET u.firstName = event.after.firstName,
    u.lastName = event.after.lastName,
    u.isActive = event.after.isActive,
    u.createdAt = event.after.createdAt,
    u.updatedAt = event.after.updatedAt
```

**What this does:**
- `MERGE` creates the node if it doesn't exist, or matches it if it does
- The `{id: event.after.id}` ensures uniqueness based on the user ID
- `SET` updates all properties with the latest values from Kafka
- Works for both INSERT and UPDATE events from Debezium

### Event Mapping

The connector accesses Debezium CDC event fields using the `event` variable:

| Debezium Field | Cypher Reference | Description |
|----------------|------------------|-------------|
| `after.id` | `event.after.id` | User UUID |
| `after.firstName` | `event.after.firstName` | User first name |
| `after.lastName` | `event.after.lastName` | User last name |
| `after.isActive` | `event.after.isActive` | Active status |
| `after.createdAt` | `event.after.createdAt` | Creation timestamp |
| `after.updatedAt` | `event.after.updatedAt` | Update timestamp |

## Verifying the Connector

### Check Plugin is Loaded

```bash
curl http://localhost:8083/connector-plugins | jq '.[] | select(.class == "org.neo4j.connectors.kafka.sink.Neo4jConnector")'
```

Expected output:
```json
{
  "class": "org.neo4j.connectors.kafka.sink.Neo4jConnector",
  "type": "sink",
  "version": "5.1.18"
}
```

### Register the Connector

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @connectors/sink.pattern.neo4j.json
```

### Check Status

```bash
curl http://localhost:8083/connectors/neo4j-sink/status | jq
```

Expected output:
```json
{
  "name": "neo4j-sink",
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

## Viewing Data in Neo4j

### Access Neo4j Browser

Open http://localhost:7474 in your web browser.

### Query All Users

```cypher
MATCH (u:User) RETURN u
```

### View User Properties

```cypher
MATCH (u:User)
RETURN u.id, u.firstName, u.lastName, u.isActive, u.createdAt, u.updatedAt
ORDER BY u.createdAt DESC
```

### Count Users

```cypher
MATCH (u:User) RETURN count(u) as userCount
```

### Find Specific User

```cypher
MATCH (u:User {firstName: "John"})
RETURN u
```

## Troubleshooting

### Connector Fails to Start

1. Check connector logs:
```bash
docker logs kafka-connect | grep -i neo4j
```

2. Verify Neo4j is running:
```bash
docker ps | grep neo4j
```

3. Test Neo4j connectivity:
```bash
docker exec -it neo4j cypher-shell -a bolt://localhost:7687
```

### No Data Appearing in Neo4j

1. Verify connector is consuming messages:
```bash
curl http://localhost:8083/connectors/neo4j-sink/status | jq '.tasks[].state'
```

2. Check if messages exist in the topic:
```bash
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic postgres.public.users \
  --from-beginning \
  --max-messages 5
```

3. Verify Cypher query syntax by testing in Neo4j Browser manually

4. Check connector task errors:
```bash
curl http://localhost:8083/connectors/neo4j-sink/status | jq '.tasks[].trace'
```

### Restart the Connector

```bash
curl -X POST http://localhost:8083/connectors/neo4j-sink/restart
```

### Delete the Connector

```bash
curl -X DELETE http://localhost:8083/connectors/neo4j-sink
```

## Configuration Options

### Common Settings

| Property | Description | Example |
|----------|-------------|---------|
| `neo4j.uri` | Neo4j connection URI | `bolt://neo4j:7687` |
| `neo4j.authentication.type` | Auth type (BASIC, NONE, KERBEROS) | `NONE` |
| `neo4j.authentication.basic.username` | Username for BASIC auth | `neo4j` |
| `neo4j.authentication.basic.password` | Password for BASIC auth | `password` |
| `neo4j.database` | Target database (Neo4j 4.0+) | `neo4j` |

### Pattern Strategies

The connector supports multiple strategies for processing messages:

1. **Cypher Pattern** (used in this project)
   - Custom Cypher queries per topic
   - Full control over data mapping
   - Property: `neo4j.cypher.topic.<topic-name>`

2. **Source Pattern**
   - Automatic node/relationship creation
   - Structured message format required

3. **Node Pattern**
   - Simple node creation from key-value pairs
   - Less flexible but easier to configure

## Learning Resources

- [Neo4j Kafka Connector Documentation](https://neo4j.com/docs/kafka/current/)
- [Cypher Query Language Guide](https://neo4j.com/docs/cypher-manual/current/)
- [Neo4j Graph Database Concepts](https://neo4j.com/docs/getting-started/current/)
- [Kafka Connect Sink Connector API](https://kafka.apache.org/documentation/#connect_developing)

## Next Steps

Try these exercises to learn more:

1. **Modify the Cypher query** to add labels or additional properties
2. **Create relationships** between user nodes (e.g., friendships)
3. **Add error handling** for malformed events
4. **Experiment with batch sizes** to optimize throughput
5. **Add a second sink connector** to write to a different Neo4j database
6. **Implement DELETE handling** using tombstone events
