# SDK Payroll Cache Invalidation Helpers

## Overview

The ZK Payroll SDK provides caching mechanisms across multiple domains (`payroll`, `employee`, `treasury`, and `contract`). In distributed environments or long-running client sessions, cached data can become stale as transactions execute and state evolves on-chain.

Stale cache data poses three major operational hazards:
1. **Unsafe Review States**: A reviewer may approve a payroll batch based on outdated employee compensation or after an employee was deactivated/terminated.
2. **Incorrect Warnings**: Stale treasury balances or reservation allocations cause false liquidity shortfall warnings, or omit required reserve alerts.
3. **Confusing Reconciliation Results**: Pre-reveal salary commitments or pre-disbursement checkpoint records cached in local storage cause reconciliation discrepancies against on-chain records.

The cache invalidation module provides predictable, event-driven and manual invalidation helpers, deterministic key builders, staleness detection, and formal invalidation rules.

---

## Cache Domains & Namespaces

The SDK partitions cache entries into four primary domains, mapped to `CacheNamespace`:

| Domain | Namespace | Typical Cached Entities |
|---|---|---|
| `payroll` | `CacheNamespace.PAYROLL` | Payroll runs, cycle summaries, drafts, review states, execution status |
| `employee` | `CacheNamespace.EMPLOYEE` | Employee profiles, eligibility states, payment destinations, employer rosters |
| `treasury` | `CacheNamespace.TREASURY` | Available balances, reservation locks, checkpoint audit records |
| `contract` | `CacheNamespace.CONTRACT` | Global contract state, configurations, registry snapshots |

---

## Cache Keys Architecture

Cache keys follow deterministic, structured colon-delimited patterns:

```
<domain>:<subscope>[:<employer-or-company>][:<entity-id>]
```

### Key Builders

```typescript
import {
  buildPayrollCacheKey,
  buildEmployeeCacheKey,
  buildTreasuryCacheKey,
  buildContractCacheKey,
  parseCacheKey,
} from "@zk-payroll/core";

// Payroll keys
const runKey = buildPayrollCacheKey({ subscope: "run", employer: "GD...", runId: "run-101" });
// => "payroll:run:GD...:run-101"

const cycleKey = buildPayrollCacheKey({ subscope: "cycle", employer: "GD...", cycleId: 42n });
// => "payroll:cycle:GD...:42"

const reviewKey = buildPayrollCacheKey({ subscope: "review", employer: "GD...", runId: "run-101" });
// => "payroll:review:GD...:run-101"

// Employee keys
const rosterKey = buildEmployeeCacheKey({ subscope: "roster", employer: "GD..." });
// => "employee:roster:GD..."

const profileKey = buildEmployeeCacheKey({ subscope: "profile", employer: "GD...", employeeId: "GA..." });
// => "employee:profile:GD...:GA..."

// Treasury keys
const balanceKey = buildTreasuryCacheKey({ subscope: "balance", companyId: "GD...", asset: "USDC" });
// => "treasury:balance:GD...:USDC"

const reservationsKey = buildTreasuryCacheKey({ subscope: "reservations", companyId: "GD..." });
// => "treasury:reservations:GD..."

// Contract keys
const stateKey = buildContractCacheKey({ subscope: "state", contractId: "CA..." });
// => "contract:state:CA..."
```

---

## Documented Invalidation Rules

The SDK maintains an explicit, queryable registry of invalidation rules (`PAYROLL_CACHE_INVALIDATION_RULES`):

| Rule ID | Trigger | Affected Domains | Targeted Invalidation | Risk Prevented |
|---|---|---|---|---|
| `RULE-EMP-001-REGISTERED` | `event:registered` | `employee`, `contract` | `employee:roster`, `employee:profile`, `contract:registry` | **Unsafe review states**: Ensures newly hired employees appear in roster and eligibility checks. |
| `RULE-EMP-002-UPDATED` | `event:registry_updated` | `employee`, `payroll` | `employee:profile`, `employee:eligibility`, `payroll:review:*` | **Unsafe review states**: Prevents approving outdated salary or compensation terms. |
| `RULE-EMP-003-DEACTIVATED` | `event:registry_deactivated` | `employee`, `payroll` | `employee:roster`, `employee:profile`, `employee:eligibility`, `payroll:review:*` | **Unsafe review states**: Blocks accidental payouts to deactivated workers. |
| `RULE-PAY-001-COMMITTED` | `event:committed` | `payroll`, `contract` | `payroll:cycle`, `payroll:run:*`, `contract:state` | **Confusing reconciliation**: Locks cycle state to prevent divergent commitment hashes. |
| `RULE-PAY-002-REVEALED` | `event:salary_revealed` | `payroll` | `payroll:cycle`, `payroll:review:*` | **Confusing reconciliation**: Clears pre-reveal estimates so reconciliation uses actual revealed salary. |
| `RULE-TRS-001-EXECUTED` | `event:payment_executed` | `treasury`, `payroll`, `employee` | `treasury:balance`, `treasury:checkpoints`, `treasury:reservations`, `payroll:status`, `employee:destination` | **Incorrect warnings**: Updates available balance and checkpoints immediately after on-chain payout. |
| `RULE-TRS-002-SCHEDULED` | `event:payment_scheduled` | `treasury`, `payroll` | `treasury:reservations`, `treasury:reservation:<id>` | **Incorrect warnings**: Deducts future disbursement from unreserved liquidity calculations. |
| `RULE-TRS-003-CANCELLED` | `event:payment_cancelled` | `treasury`, `payroll` | `treasury:reservations`, `treasury:reservation:<id>` | **Incorrect warnings**: Releases locked funds back to unreserved treasury pool. |
| `RULE-MAN-001-DRAFT` | `manual:payroll_draft_modified`| `payroll` | `payroll:draft:<id>`, `payroll:review:*` | **Unsafe review states**: Forces fresh validation after edits. |
| `RULE-MAN-002-TREASURY-TOPUP` | `manual:treasury_topup` | `treasury` | `treasury:balance` | **Incorrect warnings**: Clears false shortfall alerts after deposit. |
| `RULE-MAN-003-DOMAIN-FLUSH` | `manual:domain_flush` | Any requested domain | Entire namespace (`clearNamespace: true`) | Reset state after ledger rollback or migration. |

---

## High-Level API: `PayrollCacheInvalidator`

The `PayrollCacheInvalidator` class provides an interface that works across `ServerCacheAdapter`, `CacheProvider`, or native `Map` caches.

```typescript
import { PayrollCacheInvalidator, ServerCacheAdapter } from "@zk-payroll/core";

const invalidator = new PayrollCacheInvalidator(serverCache);
```

### 1. Event-Driven Invalidation

Automatically generate and apply invalidation plans from parsed contract events:

```typescript
// Handling an on-chain event
await invalidator.invalidateFromEvent(event);

// Dry-run inspection (inspect what would be invalidated without deleting)
const plan = invalidator.plan(event);
console.log(plan.domains, plan.targets, plan.reasons);
```

### 2. Manual Invalidation

Target specific domain entities without waiting for blockchain events:

```typescript
// Invalidate a specific payroll run or draft
await invalidator.invalidatePayroll({
  employer: "GD...",
  runId: "run-101",
});

// Invalidate employee profile & eligibility
await invalidator.invalidateEmployee({
  employer: "GD...",
  employeeId: "GA...",
  clearRoster: true,
});

// Invalidate treasury balance after an off-chain deposit
await invalidator.invalidateTreasury({
  companyId: "GD...",
  asset: "USDC",
  clearCheckpoints: true,
});

// Purge an entire domain
await invalidator.invalidateDomain("payroll");
```

### 3. Automatic Event Bridge with `TransactionWatcher`

Hook invalidation directly into transaction submission watchers:

```typescript
import { TransactionWatcher, attachCacheInvalidatorToWatcher } from "@zk-payroll/core";

const watcher = new TransactionWatcher(server);
const detach = attachCacheInvalidatorToWatcher(watcher, invalidator, {
  onInvalidated: (result, confirmation) => {
    console.log(`Cache invalidated for tx ${confirmation.txHash}:`, result.invalidatedKeys);
  },
});

// When no longer needed
detach();
```

---

## Staleness Detection Helpers

Inspect entry metadata before relying on cached states:

```typescript
import {
  isPayrollStateStale,
  isEmployeeStateStale,
  isTreasuryStateStale,
  assertFreshPayrollReview,
} from "@zk-payroll/core";

// 1. Check if cached treasury balance is behind current ledger sequence
const treasuryStale = isTreasuryStateStale(
  { storedAt: Date.now() - 60000, ledger: 1045 },
  { currentLedger: 1050 } // On-chain ledger has advanced
);
if (treasuryStale.isStale) {
  console.warn(treasuryStale.reason, treasuryStale.riskCategory);
  // Refetch live balance from RPC
}

// 2. Safeguard review approval against version mismatch
assertFreshPayrollReview(cachedReview, {
  expectedVersion: currentDraft.version,
  maxAgeMs: 300_000, // 5 minutes max
});
```
