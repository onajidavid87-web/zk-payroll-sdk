/**
 * Cache Invalidation Execution & Staleness Analysis.
 *
 * Implements deterministic plan generation and execution against
 * ServerCacheAdapter, CacheProvider, and in-memory backends, along with
 * deep staleness evaluation for payroll, employee, treasury, and contract domains.
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
  InvalidationTriggerType,
  StalenessEvaluationOptions,
  StalenessEvaluationResult,
} from "./invalidationTypes";
import { matchesCachePattern } from "./keys";
import { getInvalidationRule, PAYROLL_CACHE_INVALIDATION_RULES } from "./rules";

// ── Generic Cache Target Type ───────────────────────────────────────────────

export type AnyCacheBackend<T = unknown> =
  ServerCacheAdapter<T> | CacheProvider<T> | Map<string, T>;

// ── Plan Resolution ─────────────────────────────────────────────────────────

export interface ResolvePlanInput {
  readonly trigger?: string;
  readonly type?: string;
  readonly domain?: CacheDomain;
  readonly employer?: string;
  readonly employee?: string;
  readonly companyId?: string;
  readonly asset?: string;
  readonly runId?: string;
  readonly cycleId?: string | bigint | number;
  readonly draftId?: string;
  readonly paymentId?: string | bigint | number;
  readonly contractId?: string;
  readonly txHash?: string;
  readonly [key: string]: unknown;
}

export type InvalidationInput = ResolvePlanInput | object | string;

/**
 * Resolves an actionable InvalidationPlan from an event or manual action input.
 */
export function resolveInvalidationPlan(input: InvalidationInput): InvalidationPlan {
  const payload: Record<string, unknown> =
    typeof input === "string"
      ? { trigger: input }
      : (Object.assign({}, input) as Record<string, unknown>);

  let triggerStr = "";
  if (typeof payload.trigger === "string" && payload.trigger.length > 0) {
    triggerStr = payload.trigger;
  } else if (typeof payload.type === "string" && payload.type.length > 0) {
    triggerStr = payload.type.startsWith("event:") ? payload.type : `event:${payload.type}`;
  } else {
    triggerStr = "manual:custom";
  }

  const rule = getInvalidationRule(triggerStr);
  const timestamp = Date.now();

  if (rule) {
    const targets = rule.resolveTargets(payload);
    const explanation = rule.explanation(payload);

    return {
      trigger: rule.trigger,
      domains: [...rule.domains],
      targets: [...targets],
      reasons: [explanation],
      timestamp,
      metadata: payload,
    };
  }

  // Fallback for custom or direct domain flush
  const targets: InvalidationTarget[] = [];
  const domains: CacheDomain[] = [];
  const reasons: string[] = [];

  if (
    payload.domain &&
    ["payroll", "employee", "treasury", "contract"].includes(String(payload.domain))
  ) {
    const d = payload.domain as CacheDomain;
    domains.push(d);
    const nsMap: Record<CacheDomain, CacheNamespace> = {
      payroll: CacheNamespace.PAYROLL,
      employee: CacheNamespace.EMPLOYEE,
      treasury: CacheNamespace.TREASURY,
      contract: CacheNamespace.CONTRACT,
    };
    targets.push({ namespace: nsMap[d], clearNamespace: true });
    reasons.push(`Flushed domain ${d} via manual trigger`);
  } else if (payload.key && typeof payload.key === "string") {
    // Single key deletion across all relevant namespaces
    targets.push({ namespace: CacheNamespace.PAYROLL, key: payload.key });
    reasons.push(`Targeted manual invalidation for key: ${payload.key}`);
    domains.push("payroll");
  } else {
    reasons.push(`Unrecognized trigger ${triggerStr}; no deterministic targets resolved`);
  }

  return {
    trigger: triggerStr,
    domains,
    targets,
    reasons,
    timestamp,
    metadata: payload,
  };
}

// ── Plan Execution ──────────────────────────────────────────────────────────

function isServerCacheAdapter<T>(cache: unknown): cache is ServerCacheAdapter<T> {
  return (
    typeof cache === "object" &&
    cache !== null &&
    "clearNamespace" in cache &&
    typeof (cache as ServerCacheAdapter<T>).clearNamespace === "function" &&
    "del" in cache &&
    typeof (cache as ServerCacheAdapter<T>).del === "function"
  );
}

function isCacheProvider<T>(cache: unknown): cache is CacheProvider<T> {
  return (
    typeof cache === "object" &&
    cache !== null &&
    !(cache instanceof Map) &&
    "get" in cache &&
    typeof (cache as CacheProvider<T>).get === "function" &&
    "set" in cache &&
    typeof (cache as CacheProvider<T>).set === "function"
  );
}

/**
 * Applies an InvalidationPlan against any supported cache backend
 * (ServerCacheAdapter, CacheProvider, or Map).
 */
export async function applyInvalidationPlan<T = unknown>(
  cache: AnyCacheBackend<T>,
  plan: InvalidationPlan
): Promise<InvalidationResult> {
  const invalidatedKeys: string[] = [];
  const clearedNamespaces: CacheNamespace[] = [];
  const errors: Error[] = [];
  const affectedDomainsSet = new Set<CacheDomain>(plan.domains);

  for (const target of plan.targets) {
    try {
      if (isServerCacheAdapter<T>(cache)) {
        if (target.clearNamespace) {
          await cache.clearNamespace(target.namespace);
          clearedNamespaces.push(target.namespace);
        } else if (target.key) {
          await cache.del(target.namespace, target.key);
          invalidatedKeys.push(target.key);
        } else if (target.pattern) {
          // If keys() inspection is supported, find matching entries and delete
          try {
            const allEntries = await cache.keys(target.namespace);
            for (const entry of allEntries) {
              if (matchesCachePattern(entry.key, target.pattern)) {
                await cache.del(target.namespace, entry.key);
                invalidatedKeys.push(entry.key);
              }
            }
          } catch {
            // If keys scan is not implemented or fails, attempt direct key delete
            const cleanedKey = target.pattern.replace(/\*$/, "");
            await cache.del(target.namespace, cleanedKey);
            invalidatedKeys.push(cleanedKey);
          }
        }
      } else if (isCacheProvider<T>(cache)) {
        if (target.clearNamespace) {
          if (typeof cache.clear === "function") {
            await cache.clear();
            clearedNamespaces.push(target.namespace);
          }
        } else if (target.key) {
          if (typeof cache.del === "function") {
            await cache.del(target.key);
          } else {
            // Nullify entry as fallback
            await cache.set(target.key, null as unknown as T, 0);
          }
          invalidatedKeys.push(target.key);
        } else if (target.pattern) {
          const directKey = target.pattern.replace(/\*$/, "");
          if (typeof cache.del === "function") {
            await cache.del(directKey);
          } else {
            await cache.set(directKey, null as unknown as T, 0);
          }
          invalidatedKeys.push(directKey);
        }
      } else if (cache instanceof Map) {
        if (target.clearNamespace) {
          cache.clear();
          clearedNamespaces.push(target.namespace);
        } else if (target.key) {
          cache.delete(target.key);
          invalidatedKeys.push(target.key);
        } else if (target.pattern) {
          for (const key of Array.from(cache.keys())) {
            if (matchesCachePattern(key, target.pattern)) {
              cache.delete(key);
              invalidatedKeys.push(key);
            }
          }
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  const purgedCount = invalidatedKeys.length + clearedNamespaces.length;

  return {
    success: errors.length === 0,
    invalidatedKeys,
    clearedNamespaces,
    affectedDomains: Array.from(affectedDomainsSet),
    errors,
    purgedCount,
  };
}

// ── Staleness Analysis ──────────────────────────────────────────────────────

/**
 * Evaluates whether a cached entry is stale based on TTL, ledger progression,
 * version/checksum mismatch, or recent invalidating events.
 */
export function isCacheEntryStale(
  metadata: CacheEntryMetadata,
  options?: StalenessEvaluationOptions,
  domain: CacheDomain = "payroll"
): StalenessEvaluationResult {
  const now = Date.now();

  // 1. Explicit invalidating event occurred
  if (options?.invalidatingEventOccurred) {
    return {
      isStale: true,
      domain,
      reason: "An explicit on-chain event invalidated this cache domain.",
      riskCategory: domain === "payroll" ? "unsafe_review_state" : "incorrect_warning",
    };
  }

  // 2. Minimum freshness timestamp threshold
  if (
    options?.staleBeforeTimestamp !== undefined &&
    metadata.storedAt < options.staleBeforeTimestamp
  ) {
    return {
      isStale: true,
      domain,
      reason: `Entry stored at ${metadata.storedAt} is older than invalidation watermark ${options.staleBeforeTimestamp}.`,
      riskCategory: "expired_ttl",
    };
  }

  // 3. TTL / Max age elapsed
  if (options?.maxAgeMs !== undefined && options.maxAgeMs > 0) {
    const age = now - metadata.storedAt;
    if (age > options.maxAgeMs) {
      return {
        isStale: true,
        domain,
        reason: `Entry age (${age}ms) exceeds configured maxAgeMs (${options.maxAgeMs}ms).`,
        riskCategory: "expired_ttl",
      };
    }
  }

  // 4. Ledger sequence progression
  if (
    options?.currentLedger !== undefined &&
    metadata.ledger !== undefined &&
    metadata.ledger < options.currentLedger
  ) {
    return {
      isStale: true,
      domain,
      reason: `Cached at ledger sequence ${metadata.ledger}, behind current ledger sequence ${options.currentLedger}.`,
      riskCategory:
        domain === "treasury"
          ? "incorrect_warning"
          : domain === "payroll"
            ? "unsafe_review_state"
            : "confusing_reconciliation",
    };
  }

  // 5. Version / Revision discrepancy
  if (
    options?.expectedVersion !== undefined &&
    metadata.version !== undefined &&
    metadata.version !== options.expectedVersion
  ) {
    return {
      isStale: true,
      domain,
      reason: `Version mismatch: cached version ${metadata.version} does not match current version ${options.expectedVersion}.`,
      riskCategory: "unsafe_review_state",
    };
  }

  // 6. Checksum / Hash discrepancy
  if (
    options?.expectedChecksum !== undefined &&
    metadata.checksum !== undefined &&
    metadata.checksum !== options.expectedChecksum
  ) {
    return {
      isStale: true,
      domain,
      reason: `Checksum mismatch: cached hash ${metadata.checksum} does not match expected hash ${options.expectedChecksum}.`,
      riskCategory: "confusing_reconciliation",
    };
  }

  return {
    isStale: false,
    domain,
    reason: "Cached state is fresh and within operational thresholds.",
  };
}

/**
 * Evaluates whether cached payroll state (drafts, runs, reviews) is stale.
 */
export function isPayrollStateStale(
  metadata: CacheEntryMetadata,
  options?: StalenessEvaluationOptions
): StalenessEvaluationResult {
  return isCacheEntryStale(metadata, options, "payroll");
}

/**
 * Evaluates whether cached employee state (roster, eligibility, destination) is stale.
 */
export function isEmployeeStateStale(
  metadata: CacheEntryMetadata,
  options?: StalenessEvaluationOptions
): StalenessEvaluationResult {
  return isCacheEntryStale(metadata, options, "employee");
}

/**
 * Evaluates whether cached treasury state (balances, reservations, checkpoints) is stale.
 */
export function isTreasuryStateStale(
  metadata: CacheEntryMetadata,
  options?: StalenessEvaluationOptions
): StalenessEvaluationResult {
  return isCacheEntryStale(metadata, options, "treasury");
}

/**
 * Evaluates whether cached contract configuration or registry state is stale.
 */
export function isContractStateStale(
  metadata: CacheEntryMetadata,
  options?: StalenessEvaluationOptions
): StalenessEvaluationResult {
  return isCacheEntryStale(metadata, options, "contract");
}
