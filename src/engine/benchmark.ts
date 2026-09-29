/**
 * RecoverOS - Ground-Truth Benchmark Evaluator
 * Objectively evaluates detection precision, recall, calculation accuracy, and latency.
 */

import { BenchmarkMetrics } from '../types';
import { MatchingEngine } from './matching';
import {
  BENCHMARK_TENANT_ID,
  BENCHMARK_SUPPLIERS,
  BENCHMARK_CONTRACTS,
  BENCHMARK_POS,
  BENCHMARK_INVOICES,
  BENCHMARK_PAYMENTS,
  BENCHMARK_SHIPMENTS,
  GROUND_TRUTH_DISCREPANCIES,
} from '../data/benchmarkDataset';

export class BenchmarkEvaluator {
  /**
   * Run the full audit against the 100-invoice benchmark dataset and compute rigorous metrics
   */
  static runBenchmark(): BenchmarkMetrics {
    const startTime = performance.now();

    // Run audit
    const detectedOpportunities = MatchingEngine.runAudit({
      tenantId: BENCHMARK_TENANT_ID,
      suppliers: BENCHMARK_SUPPLIERS,
      invoices: BENCHMARK_INVOICES,
      purchaseOrders: BENCHMARK_POS,
      contracts: BENCHMARK_CONTRACTS,
      payments: BENCHMARK_PAYMENTS,
      shipments: BENCHMARK_SHIPMENTS,
    });

    const elapsedMs = Math.round(performance.now() - startTime);

    let truePositives = 0;
    let falsePositives = 0;
    let correctCalculations = 0;

    // Check detected against ground truth
    detectedOpportunities.forEach((opp) => {
      const match = GROUND_TRUTH_DISCREPANCIES.find((gt) => {
        if (gt.type === opp.category) {
          if (gt.invoiceNumber && opp.title.includes(gt.invoiceNumber)) return true;
          if (gt.contractId && opp.id.includes(gt.contractId)) return true;
          if (gt.trackingNumber && opp.title.includes(gt.trackingNumber)) return true;
        }
        return false;
      });

      if (match) {
        truePositives++;
        // Verify calculation accuracy
        if (Math.abs(opp.recoverableAmount - match.expectedRecovery) < 0.01) {
          correctCalculations++;
        }
      } else {
        falsePositives++;
      }
    });

    const totalPlanted = GROUND_TRUTH_DISCREPANCIES.length;
    const falseNegatives = Math.max(0, totalPlanted - truePositives);

    const precision =
      truePositives + falsePositives > 0
        ? Math.round((truePositives / (truePositives + falsePositives)) * 1000) / 10
        : 0;

    const recall =
      totalPlanted > 0
        ? Math.round((truePositives / totalPlanted) * 1000) / 10
        : 0;

    const f1Score =
      precision + recall > 0
        ? Math.round(((2 * (precision * recall)) / (precision + recall)) * 10) / 10
        : 0;

    const calculationAccuracy =
      truePositives > 0
        ? Math.round((correctCalculations / truePositives) * 1000) / 10
        : 100.0;

    return {
      totalRecordsProcessed:
        BENCHMARK_INVOICES.length +
        BENCHMARK_POS.length +
        BENCHMARK_PAYMENTS.length +
        BENCHMARK_SHIPMENTS.length,
      plantedErrorsCount: totalPlanted,
      detectedErrorsCount: detectedOpportunities.length,
      truePositives,
      falsePositives,
      falseNegatives,
      precision,
      recall,
      f1Score,
      calculationAccuracy,
      averageProcessingTimeMs: elapsedMs,
      timestamp: new Date().toISOString(),
    };
  }
}
