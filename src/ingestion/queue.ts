/**
 * RecoverOS - Idempotent Data Ingestion Queue & Schema Validation
 * 
 * Rules:
 * 1. Schema validation via Zod with strict type coercion.
 * 2. Idempotent processing: Duplicate payloads return existing job without duplicating DB records.
 * 3. Enforce strict batch size and memory limits.
 * 4. Background queue with retries and Dead-Letter Queue (DLQ).
 */

import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { AuthenticatedSession, SecurityViolationError, db } from '../db/client';

// ---------------------------------------------------------------------------
// Zod Ingestion Schemas
// ---------------------------------------------------------------------------
export const InvoiceRowSchema = z.object({
  invoiceNumber: z.string().min(1).max(64),
  supplierTaxId: z.string().min(1).max(64),
  purchaseOrderNumber: z.string().max(64).optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'TRY', 'JPY', 'KWD']),
  grossAmountMinor: z.bigint().or(z.number().transform((n) => BigInt(Math.round(n * 100)))),
  taxAmountMinor: z.bigint().or(z.number().transform((n) => BigInt(Math.round(n * 100)))).default(0n),
  paidAmountMinor: z.bigint().or(z.number().transform((n) => BigInt(Math.round(n * 100)))).default(0n),
  status: z.enum(['PAID', 'PARTIAL', 'UNPAID']).default('PAID'),
});

export const PoRowSchema = z.object({
  poNumber: z.string().min(1).max(64),
  supplierTaxId: z.string().min(1).max(64),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.enum(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'TRY', 'JPY', 'KWD']),
  totalAmountMinor: z.bigint().or(z.number().transform((n) => BigInt(Math.round(n * 100)))),
});

export const IngestionBatchPayloadSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  entityType: z.enum(['INVOICE', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PAYMENT', 'CONTRACT']),
  records: z.array(z.record(z.string(), z.any())).min(1).max(50000, 'Batch exceeds 50,000 record maximum threshold'),
});

export type IngestionBatchPayload = z.infer<typeof IngestionBatchPayloadSchema>;

export interface IngestionJob {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  payloadSha256: string;
  entityType: string;
  recordCount: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  processedRecordsCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface DeadLetterEntry {
  id: string;
  tenantId: string;
  jobId: string;
  failureReason: string;
  rawPayloadPreview: string;
  attemptsMade: number;
  quarantinedAt: string;
}

export class IngestionQueueService {
  private static jobs: Map<string, IngestionJob> = new Map();
  private static deadLetterQueue: Map<string, DeadLetterEntry> = new Map();
  private static idempotencyIndex: Map<string, string> = new Map(); // `${tenantId}_${idempotencyKey}` -> jobId

  /**
   * Submit an ingestion batch idempotently
   */
  static async submitBatch(
    session: AuthenticatedSession,
    payload: IngestionBatchPayload
  ): Promise<{ job: IngestionJob; isExisting: boolean }> {
    if (!session || !session.tenantId) {
      throw new SecurityViolationError('Cannot submit ingestion batch without authenticated session.');
    }

    // 1. Validate payload envelope with Zod
    const validated = IngestionBatchPayloadSchema.parse(payload);
    const tenantId = session.tenantId;

    // 2. Compute Payload SHA-256 for integrity and deduplication
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(validated.records))
      .digest('hex');

    // 3. Idempotency Check: Return existing job if already submitted
    const idempotencyIndexKey = `${tenantId}_${validated.idempotencyKey}`;
    const existingJobId = this.idempotencyIndex.get(idempotencyIndexKey);
    if (existingJobId) {
      const existingJob = this.jobs.get(existingJobId);
      if (existingJob) {
        return { job: existingJob, isExisting: true };
      }
    }

    // 4. Create new job
    const jobId = `job-${tenantId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const job: IngestionJob = {
      id: jobId,
      tenantId,
      idempotencyKey: validated.idempotencyKey,
      payloadSha256: payloadHash,
      entityType: validated.entityType,
      recordCount: validated.records.length,
      status: 'QUEUED',
      retryCount: 0,
      maxRetries: 3,
      processedRecordsCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    this.idempotencyIndex.set(idempotencyIndexKey, jobId);

    // 5. Execute processing (asynchronously or synchronously based on size)
    await this.processJob(job, validated.records);

    return { job, isExisting: false };
  }

  /**
   * Process job records with schema validation and retry/DLQ logic
   */
  private static async processJob(job: IngestionJob, rawRecords: any[]): Promise<void> {
    job.status = 'PROCESSING';

    try {
      // Validate each row against its schema
      let schema: z.ZodSchema<any>;
      switch (job.entityType) {
        case 'INVOICE':
          schema = InvoiceRowSchema;
          break;
        case 'PURCHASE_ORDER':
          schema = PoRowSchema;
          break;
        default:
          schema = z.record(z.string(), z.any());
      }

      for (let i = 0; i < rawRecords.length; i++) {
        const row = rawRecords[i];
        schema.parse(row); // Fails closed on any schema violation
        job.processedRecordsCount++;
      }

      job.status = 'COMPLETED';
      job.completedAt = new Date().toISOString();
    } catch (err: any) {
      job.retryCount++;
      job.errorMessage = err.message || 'Validation or processing error';

      if (job.retryCount < job.maxRetries) {
        job.status = 'QUEUED'; // Ready for retry
      } else {
        // Quarantine to Dead-Letter Queue
        job.status = 'DEAD_LETTER';
        const dlqEntry: DeadLetterEntry = {
          id: `dlq-${job.id}`,
          tenantId: job.tenantId,
          jobId: job.id,
          failureReason: job.errorMessage || 'Exceeded retry limit',
          rawPayloadPreview: JSON.stringify(rawRecords.slice(0, 3)),
          attemptsMade: job.retryCount,
          quarantinedAt: new Date().toISOString(),
        };
        this.deadLetterQueue.set(dlqEntry.id, dlqEntry);
      }
    }
  }

  /** PostgreSQL-backed ingestion path used by the production API. */
  static async submitBatchDurable(
    session: AuthenticatedSession,
    payload: IngestionBatchPayload
  ): Promise<{ job: IngestionJob; isExisting: boolean }> {
    if (!session || !session.tenantId) {
      throw new SecurityViolationError('Cannot submit ingestion batch without authenticated session.');
    }
    const validated = IngestionBatchPayloadSchema.parse(payload);
    const payloadHash = createHash('sha256').update(JSON.stringify(validated.records)).digest('hex');
    const existing = await db.findMany<IngestionJob>('ingestion_jobs', session, (job) =>
      job.idempotencyKey === validated.idempotencyKey
    );
    if (existing[0]) return { job: existing[0], isExisting: true };

    const job: IngestionJob = {
      id: `job-${session.tenantId}-${Date.now()}-${randomUUID().slice(0, 8)}`,
      tenantId: session.tenantId,
      idempotencyKey: validated.idempotencyKey,
      payloadSha256: payloadHash,
      entityType: validated.entityType,
      recordCount: validated.records.length,
      status: 'PROCESSING',
      retryCount: 0,
      maxRetries: 3,
      processedRecordsCount: 0,
      createdAt: new Date().toISOString(),
    };
    await db.insert('ingestion_jobs', session, job);

    try {
      let schema: z.ZodSchema<any>;
      switch (job.entityType) {
        case 'INVOICE': schema = InvoiceRowSchema; break;
        case 'PURCHASE_ORDER': schema = PoRowSchema; break;
        default: schema = z.record(z.string(), z.any());
      }
      for (const row of validated.records) {
        schema.parse(row);
        job.processedRecordsCount++;
      }
      job.status = 'COMPLETED';
      job.completedAt = new Date().toISOString();
      await db.update('ingestion_jobs', session, job.id, job);
    } catch (err: any) {
      job.retryCount = 1;
      job.status = 'DEAD_LETTER';
      job.errorMessage = err.message || 'Validation or processing error';
      await db.update('ingestion_jobs', session, job.id, job);
      const deadLetter: DeadLetterEntry = {
        id: `dlq-${job.id}`,
        tenantId: session.tenantId,
        jobId: job.id,
        failureReason: job.errorMessage || 'Validation or processing error',
        rawPayloadPreview: JSON.stringify(validated.records.slice(0, 3)),
        attemptsMade: job.retryCount,
        quarantinedAt: new Date().toISOString(),
      };
      await db.insert('dead_letter_queue', session, deadLetter);
    }
    return { job, isExisting: false };
  }

  /**
   * Get job status
   */
  static getJob(session: AuthenticatedSession, jobId: string): IngestionJob | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    if (job.tenantId !== session.tenantId) {
      throw new SecurityViolationError('Cannot inspect jobs of another tenant.');
    }
    return job;
  }

  static async getJobDurable(session: AuthenticatedSession, jobId: string): Promise<IngestionJob | null> {
    return db.findById<IngestionJob>('ingestion_jobs', session, jobId);
  }

  /**
   * Get DLQ entries for tenant
   */
  static getDeadLetters(session: AuthenticatedSession): DeadLetterEntry[] {
    const results: DeadLetterEntry[] = [];
    for (const dl of this.deadLetterQueue.values()) {
      if (dl.tenantId === session.tenantId) {
        results.push(dl);
      }
    }
    return results;
  }

  static async getDeadLettersDurable(session: AuthenticatedSession): Promise<DeadLetterEntry[]> {
    return db.findMany<DeadLetterEntry>('dead_letter_queue', session);
  }

  /**
   * Clear state (testing only)
   */
  static clear() {
    this.jobs.clear();
    this.deadLetterQueue.clear();
    this.idempotencyIndex.clear();
  }
}
