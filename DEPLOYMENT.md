# RecoverOS - Production Deployment Guide

## 1. PostgreSQL-backed local deployment

The application requires PostgreSQL for production persistence. The in-memory store is available only for unit tests.

```bash
cp .env.example .env
export POSTGRES_PASSWORD='change-me-locally'
export RECOVEROS_MASTER_KEK_HEX="$(openssl rand -hex 32)"
docker compose up --build
curl http://localhost:3000/healthz
curl http://localhost:3000/ready
```

`/ready` must return HTTP 200 with `database: "CONNECTED"` and `persistenceMode: "postgres"` before the service is considered ready.

The first startup applies the versioned `0001_runtime_records` and `0002_authentication` migrations and enables PostgreSQL Row-Level Security on tenant runtime data. The persistent volume is named `recoveros-postgres-data`.

Authentication uses `auth_users` and `auth_sessions`: passwords are stored as Node.js `scrypt` hashes, bearer tokens are random opaque values whose SHA-256 hashes are stored, and logout marks sessions revoked in PostgreSQL. The client never supplies the authenticated tenant or role.

Login protection is enabled by default:

- Per-process rate limiting tracks email and source IP: 10 attempts per 15-minute window.
- PostgreSQL persists account failures; after 5 failed password or MFA attempts, the account is locked for 15 minutes.
- `Owner` and `Admin` accounts must enroll in TOTP MFA before they can receive a session.
- MFA secrets are encrypted with AES-256-GCM using `RECOVEROS_MASTER_KEK_HEX` and are never returned after setup except as the one-time setup response.
- MFA setup endpoints are `POST /api/v1/auth/mfa/setup` and `POST /api/v1/auth/mfa/confirm`.
- For multiple application replicas, put a shared rate limiter/WAF (for example, a managed gateway or Redis-backed limiter) in front of the service; the persistent account lock remains database-backed.

User provisioning is server-side and tenant-scoped:

- `GET /api/v1/admin/users` — Owner/Admin only; returns no password fields.
- `POST /api/v1/admin/users` — Owner/Admin only; the server generates the user ID and forces the actor's tenant.
- `PATCH /api/v1/admin/users/:userId` — Owner/Admin only; cross-tenant IDs are rejected, Admin cannot create/manage Owner or Admin accounts, and changing status or role revokes active sessions.
- An actor cannot change their own role or status, and the last active Owner cannot be disabled.

To provision the first user, call `AuthUserService.createUser` from a protected administrative provisioning workflow. Do not add a public signup endpoint. The login endpoint is:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"your-password"}'
```

## 2. Secrets and production requirements

- `RECOVEROS_MASTER_KEK_HEX` must be supplied by a KMS or Secret Manager and must be exactly 32 bytes encoded as 64 hexadecimal characters.
- `POSTGRES_PASSWORD` must not be committed to Git.
- Use a managed PostgreSQL instance with encrypted storage, automated backups, point-in-time recovery, and TLS in production.
- Set `DATABASE_SSL=true` when the managed provider requires TLS.
- The current phase persists generic runtime records, audit entries, ingestion jobs, and the dead-letter queue. Sessions and encrypted object storage remain in the next migration phase.

## 3. Containerized deployment

```bash
docker build -t recoveros:latest .
docker compose up -d
```

The image builds the browser bundle and server bundle separately, runs as a non-root user, and executes the server with Node.js without requiring development tooling at runtime.

## 4. Cloud Run & Kubernetes deployment

- **Port Configuration**: Default HTTP port is `3000`, configurable through `PORT`.
- **Probes**:
  - Liveness: `GET /healthz`
  - Readiness: `GET /ready`
- **Required Secrets**: `DATABASE_URL`, `RECOVEROS_MASTER_KEK_HEX`, and optionally `GEMINI_API_KEY`.
- **Database**: Use an external managed PostgreSQL service, not a database container inside the application runtime.
