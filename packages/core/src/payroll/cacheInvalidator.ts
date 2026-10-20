/**
 * Payroll Domain Cache Invalidation Helpers.
 *
 * Dedicated helpers for safeguarding payroll review states, cycle commitments,
 * and disbursement readiness against stale cached entries.
 */

import { ServerCacheAdapter } from "../cache/ServerCacheAdapter";
import { CacheProvider } from "../cache/CacheProvider";
import { CacheNamespace } from "../cache/types";
import {
  CacheEntryMetadata,
  InvalidationResult,
  StalenessEvaluationOptions,
  StalenessEvaluationResult,
} from "../cache/invalidationTypes";
import { buildPayrollCacheKey } from "../cache/keys";
import { applyInvalidationPlan, isPayrollStateStale } from "../cache/invalidation";
import { PayrollError } from "../errors";

export interface PayrollReviewState {
  readonly runId: string;
  readonly employer: string;
  readonly employeeIds: readonly string[];
  readonly totalAmount: bigint;
  readonly metadata: CacheEntryMetadata;
}

export class StalePayrollReviewError extends PayrollError {
  constructor(
    message: string,
    public readonly details?: StalenessEvaluationResult
  ) {
    super(message, 409);
    this.name = "StalePayrollReviewError";
  }
}

/**
 * Invalidates review states and draft summaries for an employer and run ID.
 */
export async function invalidatePayrollReviewState(
  cache: ServerCacheAdapter | CacheProvider | Map<string, unknown>,
  employer: string,
  runId?: string
): Promise<InvalidationResult> {
  const targets = runId
    ? [
        {
          namespace: CacheNamespace.PAYROLL,
          key: buildPayrollCacheKey({ subscope: "review", employer, runId }),
        },
        {
          namespace: CacheNamespace.PAYROLL,
          key: buildPayrollCacheKey({ subscope: "run", employer, runId }),
        },
      ]
    : [
        {
          namespace: CacheNamespace.PAYROLL,
          pattern: `payroll:review:${employer}:*`,
        },
      ];

  return applyInvalidationPlan(cache, {
    trigger: "manual:payroll_review_invalidated",
    domains: ["payroll"],
    targets,
    reasons: [`Invalidated payroll review state for employer ${employer}`],
    timestamp: Date.now(),
  });
}

/**
 * Invalidates cycle-specific cached state when commitments or revelations occur.
 */
export async function invalidatePayrollCycleState(
  cache: ServerCacheAdapter | CacheProvider | Map<string, unknown>,
  employer: string,
  cycleId: string | bigint | number
): Promise<InvalidationResult> {
  return applyInvalidationPlan(cache, {
    trigger: "manual:payroll_cycle_reset",
    domains: ["payroll"],
    targets: [
      {
        namespace: CacheNamespace.PAYROLL,
        key: buildPayrollCacheKey({ subscope: "cycle", employer, cycleId }),
      },
    ],
    reasons: [`Invalidated cycle ${cycleId} state for employer ${employer}`],
    timestamp: Date.now(),
  });
}

/**
 * Evaluates whether a cached payroll review state is still fresh and safe for approval.
 */
export function evaluatePayrollReviewFreshness(
  review: PayrollReviewState,
  options: StalenessEvaluationOptions = {}
): StalenessEvaluationResult {
  return isPayrollStateStale(review.metadata, options);
}

/**
 * Asserts that a payroll review state is fresh, throwing StalePayrollReviewError if stale.
 */
export function assertFreshPayrollReview(
  review: PayrollReviewState,
  options: StalenessEvaluationOptions = {}
): void {
  const result = evaluatePayrollReviewFreshness(review, options);
  if (result.isStale) {
    throw new StalePayrollReviewError(
      `Payroll review state for run ${review.runId} is stale: ${result.reason}`,
      result
    );
  }
}
