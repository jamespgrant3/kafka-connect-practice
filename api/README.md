# User Management API

A NestJS REST API demonstrating two Kafka integration patterns: direct event publishing and Change Data Capture (CDC).

## Overview

This API manages user records in PostgreSQL while showcasing two different approaches to event streaming:

1. **Direct Kafka Producer** - Explicitly publishes events to Kafka (e.g., `user.created` topic)
2. **Change Data Capture (CDC)** - All database changes are automatically captured by Debezium via PostgreSQL's write-ahead log

## Architecture

```
API Request → PostgreSQL Write → Two Event Streams:
                                  ├─ Direct: Kafka Producer (user.created topic)
                                  └─ CDC: Debezium Connector (captures all changes)
                                           ↓
                                    Kafka Topics (postgres.public.users)
                                           ↓
                                    Neo4j Sink Connector
                                           ↓
                                    Neo4j Graph Database
```

## Endpoints

### Get All Users
```bash
GET http://localhost:8000/users
```

### Get User by ID
```bash
GET http://localhost:8000/users/:id
```

### Create User
```bash
POST http://localhost:8000/users
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true
}
```

Example:
```bash
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Alice",
    "lastName": "Carter",
    "isActive": true
  }'
```

### Update User
```bash
PUT http://localhost:8000/users/:id
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith"
}
```

### Delete User
```bash
DELETE http://localhost:8000/users/:id
```

## Data Model

**User Entity** (`users` table):
- `id` - UUID (auto-generated)
- `firstName` - string
- `lastName` - string
- `isActive` - boolean (default: true)
- `createdAt` - timestamp (auto-generated)
- `updatedAt` - timestamp (auto-updated)

## Event Patterns

### 1. Direct Publishing (Application-Level)
When a user is created, the API explicitly sends an event to the `user.created` Kafka topic via KafkaJS producer. This gives you control over:
- Event payload structure
- When events are sent
- Topic naming
- Custom business logic

### 2. Change Data Capture (Database-Level)
Debezium monitors PostgreSQL's write-ahead log and captures ALL database changes:
- **INSERT** - New user created
- **UPDATE** - User fields modified
- **DELETE** - User removed

CDC events include:
- Before and after values
- Transaction metadata
- Schema information
- Operation type

These CDC events are then consumed by the Neo4j Sink Connector, which synchronizes the data into a graph database. This demonstrates a complete event-driven data pipeline from relational database to graph database.

## Tech Stack

- **NestJS** - Progressive Node.js framework
- **TypeORM** - Database ORM with entity management
- **PostgreSQL** - Primary data store with logical replication enabled
- **KafkaJS** - Native Kafka client for Node.js
- **Docker** - Containerized deployment

## Development

### Install Dependencies
```bash
npm install
```

### Run Locally
```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod
```

### Run Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Build
```bash
npm run build
```

## Configuration

Environment variables (set in docker-compose.yml):
- `PORT` - API port (default: 8000)
- `KAFKA_CLIENT_ID` - Kafka client identifier
- `KAFKA_BOOTSTRAP_SERVERS` - Kafka broker addresses

Database connection (hard-coded for local dev):
- Host: `postgres`
- Port: `5432`
- User: `postgres`
- Password: `postgres`
- Database: `postgres`

## Observing Events

After making API calls, observe the events across the entire pipeline:

1. **Kafbat UI** (http://localhost:8080) - View Kafka topics:
   - **user.created** topic - Application-level events (direct publish)
   - **postgres.public.users** topic - CDC events (Debezium)

2. **Neo4j Browser** (http://localhost:7474) - View synchronized graph data:
   ```cypher
   MATCH (u:User) RETURN u
   ```

Compare the two event formats to understand the differences between explicit publishing and CDC patterns. Then observe how CDC events flow from PostgreSQL → Kafka → Neo4j automatically.
