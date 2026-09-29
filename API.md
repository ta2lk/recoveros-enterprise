# RecoverOS - REST API v1 Reference Documentation

All API requests enforce tenant scoping via the `x-tenant-id` header or Bearer JWT token.

Base URL: `/api/v1`

---

## 1. System & Health

### `GET /healthz`
Liveness probe for container orchestration.
```json
{
  "status": "HEALTHY",
  "timestamp": "2026-09-27T12:00:00.000Z"
}
```

### `GET /ready`
Readiness probe confirming database and agent service availability.

---

## 2. Ingestion & Audit Pipeline

### `POST /api/v1/audit/execute`
Triggers an autonomous 4-way matching audit pass across the tenant's current ledger records.
*   **Headers**: `x-tenant-id: <tenant_id>`
*   **Response**:
```json
{
  "opportunitiesCount": 5,
  "totalRecoverable": 25745.00,
  "opportunities": [ ... ]
}
```

---

## 3. Ground-Truth Synthetic Benchmark

### `POST /api/v1/benchmark/run`
Executes an evaluation audit against the 100-invoice synthetic ground-truth dataset.
*   **Response**:
```json
{
  "totalRecordsProcessed": 300,
  "plantedErrorsCount": 6,
  "detectedErrorsCount": 6,
  "truePositives": 6,
  "falsePositives": 0,
  "precision": 100,
  "recall": 100,
  "f1Score": 100,
  "calculationAccuracy": 100,
  "averageProcessingTimeMs": 14
}
```

---

## 4. Security & Sanitization

### `POST /api/v1/security/sanitize`
Inspects untrusted external text against adversarial prompt injection attacks.
*   **Body**: `{ "text": "string" }`
*   **Response**:
```json
{
  "sanitizedText": "...",
  "threatsDetected": [],
  "isQuarantined": false
}
```
