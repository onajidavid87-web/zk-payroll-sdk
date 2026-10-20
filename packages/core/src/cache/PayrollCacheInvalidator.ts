/**
 * PayrollCacheInvalidator.
 *
 * High-level SDK helper class providing predictable event-driven and manual
 * cache invalidation, key management, and staleness detection across
 * payroll, employee, treasury, and contract domains.
 */

import { ServerCacheAdapter } from "./ServerCacheAdapter";
import { CacheProvider } from "./CacheProvider";
import { CacheNamespace } from "./types";
import {
  CacheDomain,
  CacheEntryMetadata,
  InvalidationPlan,
  InvalidationResult,
  InvalidationTarget,
  StalenessEvaluationOptions,
  StalenessEvaluationResult,
} from "./invalidationTypes";
import {
  buildContractCacheKey,
  buildEmployeeCacheKey,
  buildPayrollCacheKey,
  buildTreasuryCacheKey,
} from "./keys";
import {
  AnyCacheBackend,
  applyInvalidationPlan,
  InvalidationInput,
  isContractStateStale,
  isEmployeeStateStale,
  isPayrollStateStale,
  isTreasuryStateStale,
  resolveInvalidationPlan,
} from "./invalidation";
import {
  CacheInvalidationRule,
  listInvalidationRulesByDomain,
  PAYROLL_CACHE_INVALIDATION_RULES,
} from "./rules";

export interface InvalidatePayrollOptions {
  readonly employer?: string;
  readonly runId?: string;
  readonly cycleId?: string | bigint | number;
  readonly draftId?: string;
}

export interface InvalidateEmployeeOptions {
  readonly employer?: string;
  readonly employeeId?: string;
  readonly clearRoster?: boolean;
}

export interface InvalidateTreasuryOptions {
  readonly companyId: string;
  readonly asset?: string;
  readonly reservationId?: string;
  readonly clearCheckpoints?: boolean;
}

export interface InvalidateContractOptions {
  readonly contractId: string;
  readonly entityId?: string;
}

export class PayrollCacheInvalidator {
  constructor(private readonly cache: AnyCacheBackend) {}

  /**
   * Generates an InvalidationPlan from an event or action without executing it (dry-run).
   */
  plan(eventOrTrigger: InvalidationInput): InvalidationPlan {
    return resolveInvalidationPlan(eventOrTrigger);
  }

  /**
   * Executes invalidation triggered by an on-chain or lifecycle event.
   */
  async invalidateFromEvent(event: InvalidationInput): Promise<InvalidationResult> {
    const plan = resolveInvalidationPlan(event);
    return applyInvalidationPlan(this.cache, plan);
  }

  /**
   * Invalidates cached payroll state (runs, cycles, drafts, reviews, status).
   */
  async invalidatePayroll(options: InvalidatePayrollOptions = {}): Promise<InvalidationResult> {
    const targets: InvalidationTarget[] = [];
    const reasons: string[] = [];
    const employer = options.employer?.trim();
    const runId = options.runId?.trim();
    const cycleId = options.cycleId !== undefined ? String(options.cycleId).trim() : undefined;
    const draftId = options.draftId?.trim();

    if (runId) {
      targets.push({
        namespace: CacheNamespace.PAYROLL,
        key: buildPayrollCacheKey({ subscope: "run", employer, runId }),
      });
      targets.push({
        namespace: CacheNamespace.PAYROLL,
        key: buildPayrollCacheKey({ subscope: "review", employer, runId }),
      });
      targets.push({
        namespace: CacheNamespace.PAYROLL,
        key: buildPayrollCacheKey({ subscope: "status", runId }),
      });
      reasons.push(`Invalidated payroll run and review states for run: ${runId}`);
    }

    if (cycleId) {
      targets.push({
        namespace: CacheNamespace.PAYROLL,
        key: buildPayrollCacheKey({ subscope: "cycle", employer, cycleId }),
      });
      reasons.push(`Invalidated payroll cycle state for cycle: ${cycleId}`);
    }

    if (draftId) {
      targets.push({
        namespace: CacheNamespace.PAYROLL,
        key: buildPayrollCacheKey({ subscope: "draft", draftId }),
      });
      reasons.push(`Invalidated draft payload for draft: ${draftId}`);
    }

    if (employer && !runId && !cycleId && !draftId) {
      targets.push({
        namespace: CacheNamespace.PAYROLL,
        pattern: `payroll:run:${employer}:*`,
      });
      targets.push({
        namespace: CacheNamespace.PAYROLL,
        pattern: `payroll:review:${employer}:*`,
      });
      reasons.push(`Invalidated all cached payroll runs and reviews for employer: ${employer}`);
    }

    if (targets.length === 0) {
      // General payroll domain invalidation
      targets.push({ namespace: CacheNamespace.PAYROLL, clearNamespace: true });
      reasons.push("Cleared entire payroll cache namespace");
    }

    const plan: InvalidationPlan = {
      trigger: "manual:payroll_run_reset",
      domains: ["payroll"],
      targets,
      reasons,
      timestamp: Date.now(),
      metadata: { ...options },
    };

    return applyInvalidationPlan(this.cache, plan);
  }

  /**
   * Invalidates cached employee state (profile, eligibility, destination, roster).
   */
  async invalidateEmployee(options: InvalidateEmployeeOptions = {}): Promise<InvalidationResult> {
    const targets: InvalidationTarget[] = [];
    const reasons: string[] = [];
    const employer = options.employer?.trim();
    const employeeId = options.employeeId?.trim();

    if (employeeId) {
      targets.push({
        namespace: CacheNamespace.EMPLOYEE,
        key: buildEmployeeCacheKey({ subscope: "profile", employer, employeeId }),
      });
      targets.push({
        namespace: CacheNamespace.EMPLOYEE,
        key: buildEmployeeCacheKey({ subscope: "eligibility", employer, employeeId }),
      });
      targets.push({
        namespace: CacheNamespace.EMPLOYEE,
        key: buildEmployeeCacheKey({ subscope: "destination", employeeId }),
      });
      reasons.push(`Invalidated profile, eligibility, and destination for employee: ${employeeId}`);
    }

    if (options.clearRoster || (employer && !employeeId)) {
      targets.push({
        namespace: CacheNamespace.EMPLOYEE,
        key: buildEmployeeCacheKey({ subscope: "roster", employer }),
      });
      reasons.push(`Invalidated employee roster for employer: ${employer ?? "all"}`);
    }

    if (targets.length === 0) {
      targets.push({ namespace: CacheNamespace.EMPLOYEE, clearNamespace: true });
      reasons.push("Cleared entire employee cache namespace");
    }

    const plan: InvalidationPlan = {
      trigger: "manual:employee_profile_updated",
      domains: ["employee"],
      targets,
      reasons,
      timestamp: Date.now(),
      metadata: { ...options },
    };

    return applyInvalidationPlan(this.cache, plan);
  }

  /**
   * Invalidates cached treasury state (balances, reservations, checkpoints).
   */
  async invalidateTreasury(options: InvalidateTreasuryOptions): Promise<InvalidationResult> {
    const targets: InvalidationTarget[] = [];
    const reasons: string[] = [];
    const companyId = options.companyId.trim();
    const asset = options.asset?.trim();
    const reservationId = options.reservationId?.trim();

    if (reservationId) {
      targets.push({
        namespace: CacheNamespace.TREASURY,
        key: buildTreasuryCacheKey({ subscope: "reservation", companyId, reservationId }),
      });
      targets.push({
        namespace: CacheNamespace.TREASURY,
        key: buildTreasuryCacheKey({ subscope: "reservations", companyId }),
      });
      reasons.push(`Invalidated treasury reservation ${reservationId}`);
    } else {
      targets.push({
        namespace: CacheNamespace.TREASURY,
        key: buildTreasuryCacheKey({ subscope: "balance", companyId, asset }),
      });
      targets.push({
        namespace: CacheNamespace.TREASURY,
        key: buildTreasuryCacheKey({ subscope: "reservations", companyId }),
      });
      reasons.push(`Invalidated treasury balance and reservations for ${companyId}`);
    }

    if (options.clearCheckpoints) {
      targets.push({
        namespace: CacheNamespace.TREASURY,
        key: buildTreasuryCacheKey({ subscope: "checkpoints", companyId }),
      });
      reasons.push(`Invalidated treasury checkpoints for ${companyId}`);
    }

    const plan: InvalidationPlan = {
      trigger: "manual:treasury_rebalance",
      domains: ["treasury"],
      targets,
      reasons,
      timestamp: Date.now(),
      metadata: { ...options },
    };

    return applyInvalidationPlan(this.cache, plan);
  }

  /**
   * Invalidates cached contract state or configuration.
   */
  async invalidateContract(options: InvalidateContractOptions): Promise<InvalidationResult> {
    const targets: InvalidationTarget[] = [];
    const reasons: string[] = [];
    const contractId = options.contractId.trim();

    targets.push({
      namespace: CacheNamespace.CONTRACT,
      key: buildContractCacheKey({ subscope: "state", contractId }),
    });
    targets.push({
      namespace: CacheNamespace.CONTRACT,
      key: buildContractCacheKey({ subscope: "config", contractId }),
    });
    reasons.push(`Invalidated contract state and config for ${contractId}`);

    if (options.entityId) {
      targets.push({
        namespace: CacheNamespace.CONTRACT,
        key: buildContractCacheKey({
          subscope: "registry",
          contractId,
          entityId: options.entityId,
        }),
      });
      reasons.push(`Invalidated contract registry for entity ${options.entityId}`);
    }

    const plan: InvalidationPlan = {
      trigger: "manual:contract_upgrade",
      domains: ["contract"],
      targets,
      reasons,
      timestamp: Date.now(),
      metadata: { ...options },
    };

    return applyInvalidationPlan(this.cache, plan);
  }

  /**
   * Flushes an entire cache domain.
   */
  async invalidateDomain(domain: CacheDomain): Promise<InvalidationResult> {
    const plan = resolveInvalidationPlan({ trigger: "manual:domain_flush", domain });
    return applyInvalidationPlan(this.cache, plan);
  }

  /**
   * Invalidates a single specific key under an optional namespace.
   */
  async invalidateKey(
    key: string,
    namespace: CacheNamespace = CacheNamespace.PAYROLL
  ): Promise<InvalidationResult> {
    const plan: InvalidationPlan = {
      trigger: "manual:custom",
      domains: ["payroll"],
      targets: [{ namespace, key }],
      reasons: [`Targeted deletion for key ${key}`],
      timestamp: Date.now(),
    };
    return applyInvalidationPlan(this.cache, plan);
  }

  // ── Staleness Detection ────────────────────────────────────────────────────

  isPayrollStale(
    metadata: CacheEntryMetadata,
    options?: StalenessEvaluationOptions
  ): StalenessEvaluationResult {
    return isPayrollStateStale(metadata, options);
  }

  isEmployeeStale(
    metadata: CacheEntryMetadata,
    options?: StalenessEvaluationOptions
  ): StalenessEvaluationResult {
    return isEmployeeStateStale(metadata, options);
  }

  isTreasuryStale(
    metadata: CacheEntryMetadata,
    options?: StalenessEvaluationOptions
  ): StalenessEvaluationResult {
    return isTreasuryStateStale(metadata, options);
  }

  isContractStale(
    metadata: CacheEntryMetadata,
    options?: StalenessEvaluationOptions
  ): StalenessEvaluationResult {
    return isContractStateStale(metadata, options);
  }

  // ── Invalidation Rules Metadata ────────────────────────────────────────────

  getRules(): readonly CacheInvalidationRule[] {
    return PAYROLL_CACHE_INVALIDATION_RULES;
  }

  getRulesForDomain(domain: CacheDomain): readonly CacheInvalidationRule[] {
    return listInvalidationRulesByDomain(domain);
  }
}
