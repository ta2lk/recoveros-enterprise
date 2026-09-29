import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { BenchmarkEvaluator } from './src/engine/benchmark';
import { MatchingEngine } from './src/engine/matching';
import { PromptDefense } from './src/security/promptDefense';
import { ArchitecturalTestRunner } from './src/engine/architecturalTest';
import {
  BENCHMARK_TENANT_ID,
  BENCHMARK_SUPPLIERS,
  BENCHMARK_CONTRACTS,
  BENCHMARK_POS,
  BENCHMARK_INVOICES,
  BENCHMARK_PAYMENTS,
  BENCHMARK_SHIPMENTS,
} from './src/data/benchmarkDataset';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Request logging & tenant context middleware
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] || 'default-tenant';
  (req as any).tenantId = tenantId;
  next();
});

// Liveness & Readiness Checks (Section 42)
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'READY', services: ['database', 'matching-engine', 'agents'] });
});

// API v1 Endpoints (Section 53)
app.get('/api/v1/health', (req, res) => {
  res.json({
    platform: 'RecoverOS',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    mode: 'AUTONOMOUS_ENTERPRISE_RECOVERY',
  });
});

// Run ground-truth benchmark
app.post('/api/v1/benchmark/run', (req, res) => {
  try {
    const results = BenchmarkEvaluator.runBenchmark();
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run full architectural test
app.post('/api/v1/architecture/run', async (req, res) => {
  try {
    const report = await ArchitecturalTestRunner.runFullArchitecturalAudit();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger audit
app.post('/api/v1/audit/execute', (req, res) => {
  try {
    const opps = MatchingEngine.runAudit({
      tenantId: (req as any).tenantId,
      suppliers: BENCHMARK_SUPPLIERS,
      invoices: BENCHMARK_INVOICES,
      purchaseOrders: BENCHMARK_POS,
      contracts: BENCHMARK_CONTRACTS,
      payments: BENCHMARK_PAYMENTS,
      shipments: BENCHMARK_SHIPMENTS,
    });
    res.json({
      opportunitiesCount: opps.length,
      totalRecoverable: opps.reduce((sum, o) => sum + o.recoverableAmount, 0),
      opportunities: opps,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sanitize untrusted external document
app.post('/api/v1/security/sanitize', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text parameter' });
  const sanitized = PromptDefense.sanitizeExternalData(text);
  res.json(sanitized);
});

// In production, serve static assets
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// If not in Vite dev mode, start server
if (process.env.NODE_ENV === 'production') {
  app.listen(port, () => {
    console.log(`RecoverOS Enterprise Server listening on port ${port}`);
  });
}

export default app;
