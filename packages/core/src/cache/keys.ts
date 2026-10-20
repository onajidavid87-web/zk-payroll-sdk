/**
 * Cache Key Definition & Helpers.
 *
 * Provides deterministic, structured key builders and parsers for each
 * supported cache domain (payroll, employee, treasury, contract).
 */

import {
  CacheDomain,
  CacheSubscope,
  PayrollCacheSubscope,
  EmployeeCacheSubscope,
  TreasuryCacheSubscope,
  ContractCacheSubscope,
} from "./invalidationTypes";

// ── Key Building Options ────────────────────────────────────────────────────

export interface PayrollCacheKeyParams {
  readonly subscope?: PayrollCacheSubscope;
  readonly employer?: string;
  readonly runId?: string;
  readonly cycleId?: string | bigint | number;
  readonly draftId?: string;
}

export interface EmployeeCacheKeyParams {
  readonly subscope?: EmployeeCacheSubscope;
  readonly employer?: string;
  readonly employeeId?: string;
}

export interface TreasuryCacheKeyParams {
  readonly subscope?: TreasuryCacheSubscope;
  readonly companyId: string;
  readonly asset?: string;
  readonly reservationId?: string;
}

export interface ContractCacheKeyParams {
  readonly subscope?: ContractCacheSubscope;
  readonly contractId: string;
  readonly entityId?: string;
}

export interface ParsedCacheKey {
  readonly domain: CacheDomain;
  readonly subscope: CacheSubscope;
  readonly segments: readonly string[];
  readonly rawKey: string;
}

// ── Cache Key Builders ──────────────────────────────────────────────────────

/**
 * Builds a canonical cache key for the `payroll` domain.
 *
 * @example
 * ```ts
 * buildPayrollCacheKey({ subscope: "run", employer: "GA...", runId: "run-1" });
 * // => "payroll:run:GA...:run-1"
 * ```
 */
export function buildPayrollCacheKey(params: PayrollCacheKeyParams): string {
  const subscope = params.subscope ?? "run";
  const employer = params.employer ? params.employer.trim() : "";

  switch (subscope) {
    case "run": {
      const runId = params.runId ? params.runId.trim() : "";
      return employer && runId
        ? `payroll:run:${employer}:${runId}`
        : runId
          ? `payroll:run:${runId}`
          : employer
            ? `payroll:run:${employer}`
            : "payroll:run";
    }
    case "cycle": {
      const cycleId = params.cycleId !== undefined ? String(params.cycleId).trim() : "";
      return employer && cycleId
        ? `payroll:cycle:${employer}:${cycleId}`
        : cycleId
          ? `payroll:cycle:${cycleId}`
          : employer
            ? `payroll:cycle:${employer}`
            : "payroll:cycle";
    }
    case "draft": {
      const draftId = params.draftId ? params.draftId.trim() : "";
      return draftId ? `payroll:draft:${draftId}` : "payroll:draft";
    }
    case "review": {
      const runId = params.runId ? params.runId.trim() : "";
      return employer && runId
        ? `payroll:review:${employer}:${runId}`
        : employer
          ? `payroll:review:${employer}`
          : runId
            ? `payroll:review:${runId}`
            : "payroll:review";
    }
    case "status": {
      const runId = params.runId ? params.runId.trim() : "";
      return runId ? `payroll:status:${runId}` : "payroll:status";
    }
    default:
      return "payroll";
  }
}

/**
 * Builds a canonical cache key for the `employee` domain.
 *
 * @example
 * ```ts
 * buildEmployeeCacheKey({ subscope: "eligibility", employer: "GA...", employeeId: "emp-42" });
 * // => "employee:eligibility:GA...:emp-42"
 * ```
 */
export function buildEmployeeCacheKey(params: EmployeeCacheKeyParams): string {
  const subscope = params.subscope ?? "profile";
  const employer = params.employer ? params.employer.trim() : "";
  const employeeId = params.employeeId ? params.employeeId.trim() : "";

  switch (subscope) {
    case "profile":
      return employer && employeeId
        ? `employee:profile:${employer}:${employeeId}`
        : employeeId
          ? `employee:profile:${employeeId}`
          : employer
            ? `employee:profile:${employer}`
            : "employee:profile";
    case "eligibility":
      return employer && employeeId
        ? `employee:eligibility:${employer}:${employeeId}`
        : employeeId
          ? `employee:eligibility:${employeeId}`
          : employer
            ? `employee:eligibility:${employer}`
            : "employee:eligibility";
    case "destination":
      return employeeId ? `employee:destination:${employeeId}` : "employee:destination";
    case "roster":
      return employer ? `employee:roster:${employer}` : "employee:roster";
    default:
      return "employee";
  }
}

/**
 * Builds a canonical cache key for the `treasury` domain.
 *
 * @example
 * ```ts
 * buildTreasuryCacheKey({ subscope: "balance", companyId: "GA...", asset: "USDC" });
 * // => "treasury:balance:GA...:USDC"
 * ```
 */
export function buildTreasuryCacheKey(params: TreasuryCacheKeyParams): string {
  const subscope = params.subscope ?? "balance";
  const companyId = params.companyId ? params.companyId.trim() : "";
  const asset = params.asset ? params.asset.trim() : "";
  const reservationId = params.reservationId ? params.reservationId.trim() : "";

  switch (subscope) {
    case "balance":
      return companyId && asset
        ? `treasury:balance:${companyId}:${asset}`
        : companyId
          ? `treasury:balance:${companyId}`
          : "treasury:balance";
    case "reservations":
      return companyId ? `treasury:reservations:${companyId}` : "treasury:reservations";
    case "reservation":
      return reservationId
        ? `treasury:reservation:${reservationId}`
        : companyId
          ? `treasury:reservation:${companyId}`
          : "treasury:reservation";
    case "checkpoints":
      return companyId ? `treasury:checkpoints:${companyId}` : "treasury:checkpoints";
    default:
      return "treasury";
  }
}

/**
 * Builds a canonical cache key for the `contract` domain.
 *
 * @example
 * ```ts
 * buildContractCacheKey({ subscope: "registry", contractId: "C123...", entityId: "emp-1" });
 * // => "contract:registry:C123...:emp-1"
 * ```
 */
export function buildContractCacheKey(params: ContractCacheKeyParams): string {
  const subscope = params.subscope ?? "state";
  const contractId = params.contractId ? params.contractId.trim() : "";
  const entityId = params.entityId ? params.entityId.trim() : "";

  switch (subscope) {
    case "state":
      return contractId ? `contract:state:${contractId}` : "contract:state";
    case "config":
      return contractId ? `contract:config:${contractId}` : "contract:config";
    case "registry":
      return contractId && entityId
        ? `contract:registry:${contractId}:${entityId}`
        : contractId
          ? `contract:registry:${contractId}`
          : "contract:registry";
    default:
      return "contract";
  }
}

// ── Parsing & Pattern Matching ──────────────────────────────────────────────

/**
 * Parses a canonical cache key string into domain, subscope, and segments.
 */
export function parseCacheKey(key: string): ParsedCacheKey | null {
  if (!key || typeof key !== "string") return null;
  const parts = key.split(":");
  if (parts.length < 2) return null;

  const [domainStr, subscopeStr, ...segments] = parts;
  if (!["payroll", "employee", "treasury", "contract"].includes(domainStr)) {
    return null;
  }

  return {
    domain: domainStr as CacheDomain,
    subscope: subscopeStr as CacheSubscope,
    segments,
    rawKey: key,
  };
}

/**
 * Evaluates whether a given cache key matches an invalidation pattern or prefix.
 *
 * Supports trailing wildcard `*` (e.g. `payroll:run:emp-1:*` or `employee:profile:*`).
 */
export function matchesCachePattern(key: string, pattern: string): boolean {
  if (!key || !pattern) return false;
  if (key === pattern) return true;

  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return key.startsWith(prefix);
  }

  return false;
}
