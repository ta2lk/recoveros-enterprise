import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

class Counter {
  private values = new Map<string, number>();
  inc(labels: Record<string, string> = {}, amount = 1) {
    const key = Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(',') || '_';
    this.values.set(key, (this.values.get(key) || 0) + amount);
  }
  snapshot() { return [...this.values.entries()]; }
}

class Histogram {
  private values = new Map<string, number[]>();
  observe(value: number, labels: Record<string, string> = {}) {
    const key = Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(',') || '_';
    const entries = this.values.get(key) || []; entries.push(value); this.values.set(key, entries);
  }
  snapshot() { return [...this.values.entries()]; }
}

export const metrics = {
  requests: new Counter(),
  requestDurationMs: new Histogram(),
  errors: new Counter(),
  dbHealth: new Counter(),
};

function labelValue(value: string): string { return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
function labelsText(key: string): string {
  if (key === '_') return '';
  return `{${key.split(',').map((pair) => { const [k, ...rest] = pair.split('='); return `${k}="${labelValue(rest.join('='))}"`; }).join(',')}}`;
}

export function prometheusMetrics(): string {
  const lines: string[] = [];
  lines.push('# HELP recoveros_http_requests_total Total HTTP requests.');
  lines.push('# TYPE recoveros_http_requests_total counter');
  metrics.requests.snapshot().forEach(([key, value]) => lines.push(`recoveros_http_requests_total${labelsText(key)} ${value}`));
  lines.push('# HELP recoveros_http_errors_total Total HTTP 4xx/5xx responses.');
  lines.push('# TYPE recoveros_http_errors_total counter');
  metrics.errors.snapshot().forEach(([key, value]) => lines.push(`recoveros_http_errors_total${labelsText(key)} ${value}`));
  lines.push('# HELP recoveros_database_health_checks_total Database health checks.');
  lines.push('# TYPE recoveros_database_health_checks_total counter');
  metrics.dbHealth.snapshot().forEach(([key, value]) => lines.push(`recoveros_database_health_checks_total${labelsText(key)} ${value}`));
  lines.push('# HELP recoveros_http_request_duration_ms Request duration observations.');
  lines.push('# TYPE recoveros_http_request_duration_ms summary');
  metrics.requestDurationMs.snapshot().forEach(([key, values]) => {
    const sum = values.reduce((a, b) => a + b, 0); const count = values.length;
    lines.push(`recoveros_http_request_duration_ms_sum${labelsText(key)} ${sum}`);
    lines.push(`recoveros_http_request_duration_ms_count${labelsText(key)} ${count}`);
  });
  return `${lines.join('\n')}\n`;
}

export function requestObservability(req: Request, res: Response, next: NextFunction) {
  const requestId = typeof req.headers['x-request-id'] === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(req.headers['x-request-id'])
    ? req.headers['x-request-id'] : randomUUID();
  const started = process.hrtime.bigint();
  res.setHeader('X-Request-ID', requestId);
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status: String(res.statusCode) };
    metrics.requests.inc(labels); metrics.requestDurationMs.observe(durationMs, { method: req.method, route });
    if (res.statusCode >= 400) metrics.errors.inc({ method: req.method, route, status: String(res.statusCode) });
    process.stdout.write(`${JSON.stringify({ level: 'info', event: 'http.request', requestId, method: req.method, route, status: res.statusCode, durationMs: Math.round(durationMs * 100) / 100 })}\n`);
  });
  next();
}
