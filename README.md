# Kafka Connect Deep Dive

A hands-on learning project to explore Kafka Connect and Change Data Capture (CDC) patterns using Debezium.

## Intent

This project demonstrates how to capture real-time database changes and stream them to Kafka using Kafka Connect. It serves as a practical exploration of:

- **Kafka Connect** - Understanding how connectors work and how to configure them
- **Change Data Capture (CDC)** - Learning how Debezium captures database changes via PostgreSQL's logical replication
- **Event-Driven Architecture** - Observing how database operations become events in Kafka topics
- **Stream Processing** - Building a foundation for event streaming and data integration patterns

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐      ┌─────────┐
│     API     │─────>│  PostgreSQL  │─────>│   Debezium   │─────>│  Kafka  │
│  (NestJS)   │      │(WAL=logical) │      │Kafka Connect │      │         │
└─────────────┘      └──────────────┘      └──────────────┘      └─────────┘
                                                   │
                                                   │
                                                   v
                                            ┌─────────────┐
                                            │Kafka Topics │
                                            │(user table) │
                                            └─────────────┘
                                                   │
                                                   │
                                                   v
                                            ┌─────────────┐
                                            │   Neo4j     │─────> Neo4j Graph
                                            │Sink Connect │       Database
                                            └─────────────┘
```

### Components

**API Service** (Port 8000)

- NestJS REST API with CRUD operations for users
- Connected to PostgreSQL via TypeORM
- Endpoints: `GET/POST/PUT/DELETE /users`

**PostgreSQL** (Port 5432)

- Configured with `wal_level=logical` to enable Change Data Capture
- Stores user data (firstName, lastName, isActive, timestamps)
- Changes are captured via PostgreSQL's logical replication slots

**Kafka Connect** (Port 8083)

- Runs the Debezium PostgreSQL connector
- Monitors PostgreSQL write-ahead log (WAL) for changes
- Publishes INSERT, UPDATE, DELETE events to Kafka topics

**Debezium Connector (Source)**

- Configuration: `connectors/register-postgres.json`
- Captures all changes from the `public` schema
- Uses the `pgoutput` logical decoding plugin
- Publishes events to Kafka topics

**Neo4j Connector (Sink)**

- Configuration: `connectors/sink.pattern.neo4j.json`
- Consumes events from the `postgres.public.users` topic
- Writes user data to Neo4j graph database as nodes
- Uses Cypher queries to merge user nodes with properties

**Kafka + Zookeeper**

- Kafka broker (Ports 9092 for host, 29092 for containers)
- Stores change events from database operations
- Zookeeper for Kafka cluster coordination

**Neo4j** (Ports 7474, 7687)

- Graph database storing user nodes
- No authentication configured (development only)
- Browser UI for visualizing graph data

**Management Tools**

- **Kafbat UI** (Port 8080) - Browse Kafka topics, messages, and consumer groups
- **pgAdmin** (Port 3000) - PostgreSQL database administration

## How It Works

1. **Make a change** - POST a new user via the API
2. **Database writes** - API inserts the user into PostgreSQL
3. **CDC captures** - Debezium detects the change via WAL
4. **Event published** - Change is published to a Kafka topic
5. **Sink processing** - Neo4j connector consumes the event
6. **Graph update** - User node is created/updated in Neo4j
7. **Observe** - View the event in Kafbat UI and the graph in Neo4j Browser

Every INSERT, UPDATE, and DELETE operation on the users table becomes an event in Kafka, complete with before/after values and metadata. The Neo4j sink connector then consumes these events and maintains a synchronized representation in the graph database.

## Getting Started

Run these commands from the root of the repository

```bash
# Start all services
docker-compose up -d

# Register the Debezium connector
# Wait for the kafka connect container to start

curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @connectors/register-postgres.json

# Register the neo4j connector
# Wait for the kafka connect container to start

curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @connectors/sink.pattern.neo4j.json

# Create a user
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe", "isActive": true}'

# View the change event in Kafbat UI
open "http://localhost:8080/ui/clusters/local/all-topics/postgres.public.users/messages?mode=LATEST&limit=100"
```

## Access Points

- API: http://localhost:8000
- Kafbat UI: http://localhost:8080
- Kafka Connect: http://localhost:8083
- Neo4j Browser: http://localhost:7474 (no authentication)
- pgAdmin: http://localhost:3000 (pg@admin.com / pgadmin)
- PostgreSQL: localhost:5432 (postgres / postgres)
- Neo4j Bolt: localhost:7687 (no authentication)

## Learning Objectives

- Understanding Kafka Connect architecture and REST API
- Configuring and deploying source and sink connectors
- Working with Debezium CDC patterns
- Observing database changes as event streams
- Exploring message formats and schemas in Kafka topics
- Streaming data from relational databases to graph databases
- Understanding event-driven data synchronization patterns
