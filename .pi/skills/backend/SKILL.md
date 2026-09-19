---
name: backend
description: Build, modify, and debug backend services and APIs. Use when the user asks for server-side logic, database design, authentication, API design, microservices, DevOps, or infrastructure work.
---

# Backend Skill

Expert guidance and workflows for building robust, scalable backend services — from REST APIs and GraphQL to databases, authentication, caching, and deployment.

## Technology Stacks

### Runtime & Languages
- **Node.js** — Express, Fastify, NestJS, Hono; ESM-first, native fetch (18+)
- **Python** — FastAPI, Django, Flask; type hints with Pydantic
- **Go** — Gin, Echo, stdlib net/http; excellent for high-concurrency services
- **Rust** — Axum, Actix-web; memory-safe, high-performance

### API Styles
- **REST** — resource-oriented, HTTP verbs, stateless, JSON
- **GraphQL** — single endpoint, precise queries, great for complex UIs
- **gRPC** — binary protobuf, streaming, service-to-service communication
- **tRPC** — end-to-end typesafe APIs (TypeScript full-stack)

### Databases
| Use Case | Recommendation |
|---|---|
| General purpose / relational | PostgreSQL |
| Document / flexible schema | MongoDB |
| Key-value / caching / sessions | Redis |
| Search / full-text | Elasticsearch, Meilisearch |
| Time-series | InfluxDB, TimescaleDB |
| Graph relationships | Neo4j |

### ORMs & Query Builders
- **TypeScript**: Prisma (recommended), Drizzle, TypeORM
- **Python**: SQLAlchemy, Django ORM, Prisma Client Python
- **Go**: GORM, sqlc (compile-time checked SQL)
- **Rust**: Diesel, SeaORM, sqlx

### Authentication & Authorization
- **JWT** — stateless, short-lived access + long-lived refresh tokens
- **Session-based** — httpOnly cookies + server-side session store (Redis)
- **OAuth2/OIDC** — social login, SSO; use established libraries (Passport, Authlib)
- **RBAC / ABAC** — role-based or attribute-based access control
- **API Keys** — for service-to-service or third-party integrations

## Workflows

### New API Endpoint
```
1. Define the route, HTTP method, and URL pattern
2. Design request/response schema (Zod, Pydantic, JSON Schema)
3. Implement validation middleware (fail fast, 400 for bad input)
4. Write the business logic (service layer, not in the route handler)
5. Handle errors consistently (structured error responses, appropriate status codes)
6. Add authentication/authorization checks
7. Write tests: unit (service), integration (route), contract (schema)
8. Document: OpenAPI/Swagger, or inline README
```

### Database Schema Design
```
1. Identify entities and relationships (1:1, 1:N, N:M)
2. Normalize to 3NF, then denormalize selectively for read performance
3. Choose primary keys (auto-increment int vs UUID vs ULID)
4. Add indexes on query columns (foreign keys, search fields, sort fields)
5. Define constraints (NOT NULL, UNIQUE, CHECK, foreign key cascades)
6. Plan migrations (incremental, reversible, tested)
7. Seed data for development
```

### Authentication Flow (JWT)
```
1. User submits credentials → validate against hashed password (bcrypt/argon2)
2. Issue access token (15 min expiry) + refresh token (7+ days)
3. Store refresh token hash in database (revocation capability)
4. Client sends access token in Authorization header
5. Middleware verifies token signature and expiry on each request
6. On 401, client uses refresh token endpoint to get new access token
7. Logout: blacklist refresh token, clear client storage
```

### Error Handling Strategy
```
- Operational errors (expected): validation, not found, conflict → 4xx with message
- Programmer errors (bugs): null pointer, type mismatch → 500, log stack trace, generic message to client
- External errors: DB timeout, API down → retry with backoff, circuit breaker, degrade gracefully
- Always log: timestamp, request ID, user ID, stack trace, context
```

## Common Patterns

### "Create a REST API from scratch"
```
1. Choose stack (e.g., Node.js + Fastify + Prisma + PostgreSQL)
2. Set up project structure: src/{routes,services,models,middleware,utils,config}/
3. Configure environment (dotenv, validation with envalid/zod)
4. Set up database connection and run first migration
5. Implement health check endpoint (/health, /health/live, /health/ready)
6. Add request logging (pino, winston) and correlation IDs
7. Implement auth middleware
8. Build CRUD endpoints for core resources
9. Add pagination, filtering, sorting on list endpoints
10. Write integration tests
```

### "Add a new database table / migration"
```
1. Model the entity with fields, types, constraints, relations
2. Write migration (up + down) — test on a copy of production data if possible
3. Run migration in development, verify schema
4. Add seed data for local testing
5. Update ORM models / types
6. Write repository/service functions
7. Expose via API endpoints if needed
```

### "Set up authentication"
```
1. Choose strategy: JWT (stateless) or session (stateful) based on requirements
2. Add password hashing (never store plaintext)
3. Implement register, login, logout, refresh endpoints
4. Add middleware to protect routes
5. Handle password reset flow (secure token via email)
6. Add rate limiting on auth endpoints (prevent brute force)
```

### "Fix a production bug"
```
1. Check logs and error tracking (Sentry, Datadog, CloudWatch)
2. Reproduce locally if possible — use production-like data
3. Add targeted logging around the failure point
4. Write a failing test that reproduces the bug
5. Fix the code, verify test passes
6. Deploy behind feature flag or during low-traffic window
7. Monitor error rates post-deploy
```

### "Add caching"
```
1. Identify hot paths (frequent reads, rarely changing data)
2. Choose cache strategy: cache-aside, write-through, or read-through
3. Set TTL based on data freshness requirements
4. Add cache invalidation on writes (or use event-driven invalidation)
5. Add cache stampede protection (per-request locking, early expiration)
6. Monitor cache hit rate
```

## Architecture Decisions

### Monolith vs Microservices
- **Monolith** (default): simpler deployment, shared code, easier testing — use until team/scale demands split
- **Microservices**: independent deploys, polyglot stacks, team autonomy — adds operational complexity

### Sync vs Async Communication
- **Synchronous** (HTTP/gRPC): simpler, immediate consistency, tight coupling — use for user-facing operations
- **Asynchronous** (message queues): decoupled, resilient, scalable — use for background jobs, event propagation
- **Message brokers**: RabbitMQ, Apache Kafka, AWS SQS, Redis Streams

### API Versioning
- URL path (`/v1/users`) — most common, explicit
- Header (`Accept: application/vnd.api+json;version=1`) — cleaner URLs, harder to discover
- Query param (`?api-version=1`) — simple but pollutes cache keys

## Security Checklist

- [ ] HTTPS everywhere (HSTS header)
- [ ] Input validation on all endpoints (never trust client)
- [ ] SQL injection prevention (parameterized queries / ORM)
- [ ] XSS prevention (sanitize output, Content-Security-Policy)
- [ ] CSRF protection for session-based auth (cookies with SameSite)
- [ ] Rate limiting on public endpoints (sliding window or token bucket)
- [ ] Secrets in environment variables, never in code
- [ ] Dependency scanning (npm audit, pip-audit, cargo audit)
- [ ] Security headers (CORS configured explicitly, X-Frame-Options, etc.)

## DevOps & Deployment

- **Containers**: Docker, Docker Compose for local dev; multi-stage builds for production
- **Orchestration**: Kubernetes (complex), Docker Swarm, or managed (ECS, Cloud Run, Fly.io)
- **CI/CD**: GitHub Actions, GitLab CI — lint, test, build, deploy stages
- **Monitoring**: structured logging, metrics (Prometheus/Grafana), tracing (OpenTelemetry)
- **Health checks**: liveness (is it running?) and readiness (is it ready for traffic?)

## Testing Strategy

| Layer | Tooling | Scope |
|---|---|---|
| Unit | Jest, Vitest, pytest | Functions, utilities, pure logic |
| Integration | Supertest, httpx | API endpoints with real DB (testcontainers) |
| Contract | Pact, Schemathesis | Consumer-provider API compatibility |
| E2E | Playwright, Cypress | Full user flows |

## Notes

- Prefer idempotency for mutations (safe retries, deduplication keys)
- Design for observability from day one — structured logs, metrics, tracing
- Keep business logic out of framework-specific code (controllers/routes should be thin)
- Database transactions for multi-step mutations — rollback on failure
- Pagination is non-optional for list endpoints; default to cursor-based for large datasets
