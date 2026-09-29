# RecoverOS - Changelog

## [1.0.0] - 2026-09-27

### Added
*   **Core Audit Engine**: Implemented deterministic 4-way matching engine (`MatchingEngine`) reconciling invoices, purchase orders, contracts, and payments.
*   **Deterministic Math**: Created `DecimalMath` and `CalculationEngine` ensuring zero floating point inaccuracy in financial delta calculations.
*   **Bilingual Architecture**: Full English (LTR) and Arabic (RTL) localization covering all views, notifications, and metadata.
*   **Multi-Agent System**: Defined 12 specialized agents with granular tool permissions and financial exposure boundaries.
*   **Synthetic Benchmark Dataset**: Seeded 100 invoices, 20 contracts, and 50 shipments with planted ground-truth errors for objective precision/recall measurement.
*   **Security & Isolation**: Added `RbacGuard` and `PromptDefense` sanitization pipeline to prevent adversarial overrides.
*   **REST API**: Implemented `/api/v1` routes with Express and containerized production Docker deployment.
