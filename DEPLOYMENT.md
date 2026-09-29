# RecoverOS - Production Deployment Guide

## 1. Containerized Deployment via Docker

RecoverOS includes a hardened multi-stage Dockerfile and Docker Compose configuration.

### Building and Running the Production Container

```bash
# 1. Build the production image with automated test validation
docker build -t recoveros:latest .

# 2. Run with Docker Compose
docker-compose up -d

# 3. Verify health probe
curl http://localhost:3000/healthz
```

---

## 2. Cloud Run & Kubernetes Deployment

*   **Port Configuration**: Default HTTP port is `3000`. Configured via standard `PORT` environment variable.
*   **Probes**:
    *   Liveness: `GET /healthz` (200 OK)
    *   Readiness: `GET /ready` (200 OK)
*   **Environment Secrets**:
    *   `GEMINI_API_KEY`: Injected into server process for language reasoning and claim notice drafting.
    *   `NODE_ENV`: Set to `production`.
