# SDK Deterministic Test Fixtures

The ZK Payroll SDK provides deterministic, reproducible test fixtures for core payroll objects across both internal test suites and downstream SDK consumers.

## Why This Matters

1. **Test Stability & Reliability**: Non-deterministic data (such as `Date.now()`, `Math.random()`, or network calls) causes flaky test suites that fail intermittently in CI environments.
2. **Reproducibility**: Contributors and SDK consumers can reproduce difficult edge states (such as reconciliation variances, invalid proof references, or contract reverts) with zero setup.
3. **Privacy Safety**: Every identity, address, amount, and hash is synthetic. No real employee identifiers, private notes, or secret keys leak into test logs or git history.
4. **Valid & Invalid Coverage**: Ready-to-use fixtures cover both happy paths and negative validation paths for all core payroll domains.

---

## Core Domains Covered

| Domain | Fixture Type | Factory Builder | Pre-built Constants |
| :--- | :--- | :--- | :--- |
| **Payroll Batches** | `BatchPayload`, `BatchPaymentEntry` | `createPayrollBatchFixture()`, `createBatchEntryFixture()` | `FIXTURE_PAYROLL_BATCH_VALID_SINGLE`, `FIXTURE_PAYROLL_BATCH_VALID_MULTI`, `FIXTURE_PAYROLL_BATCH_INVALID_EMPTY`, `FIXTURE_PAYROLL_BATCH_INVALID_DUPLICATE_RECIPIENT` |
| **Employees** | `EmployeeProfile`, `EmployeeEligibilityRecord` | `createEmployeeFixture()`, `createEmployeeEligibilityFixture()` | `FIXTURE_EMPLOYEE_VALID_ACTIVE`, `FIXTURE_EMPLOYEE_VALID_EXECUTIVE`, `FIXTURE_EMPLOYEE_INVALID_TERMINATED`, `FIXTURE_EMPLOYEE_INVALID_BLOCKED` |
| **Transactions** | `NormalizedTransactionStatus`, `TransactionEnvelopeSummary` | `createTransactionFixture()`, `createTransactionEnvelopeSummaryFixture()` | `FIXTURE_TRANSACTION_CONFIRMED`, `FIXTURE_TRANSACTION_PENDING`, `FIXTURE_TRANSACTION_FAILED`, `FIXTURE_TRANSACTION_EXPIRED` |
| **Proof References** | `ParsedProofReference`, `NoteHashReference` | `createProofReferenceFixture()`, `createNoteHashReferenceFixture()` | `FIXTURE_PROOF_REFERENCE_VALID_COMMITMENT`, `FIXTURE_PROOF_REFERENCE_INVALID_HASH_LENGTH`, `FIXTURE_NOTE_HASH_VALID` |
| **Reconciliation Results** | `ReconciliationDiffResult`, `TreasuryReconciliationReport` | `createReconciliationResultFixture()`, `createTreasuryReconciliationReportFixture()` | `FIXTURE_RECONCILIATION_MATCHED_DIFF`, `FIXTURE_RECONCILIATION_BALANCED_REPORT`, `FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH` |

---

## Quickstart

### 1. Importing Fixtures & Builders

```typescript
import {
  createPayrollBatchFixture,
  createEmployeeFixture,
  createTransactionFixture,
  createProofReferenceFixture,
  createReconciliationResultFixture,
  FIXTURE_PAYROLL_BATCH_VALID_MULTI,
  FIXTURE_EMPLOYEE_VALID_ACTIVE,
  FIXTURE_PROOF_REFERENCE_VALID_COMMITMENT,
  DETERMINISTIC_IDENTITIES,
} from "@zk-payroll/core";
```

Internal SDK tests can also import directly from `./fixtures`:

```typescript
import {
  createPayrollBatchFixture,
  FIXTURE_PAYROLL_BATCH_INVALID_EMPTY,
} from "./fixtures";
```

---

## Usage Examples

### 1. Payroll Batch Fixtures

```typescript
import {
  createPayrollBatchFixture,
  createBatchEntryFixture,
  validateBatchPayload,
  FIXTURE_PAYROLL_BATCH_VALID_MULTI,
  FIXTURE_PAYROLL_BATCH_INVALID_EMPTY,
} from "@zk-payroll/core";

// 1. Using pre-built valid multi-entry batch
const validBatch = FIXTURE_PAYROLL_BATCH_VALID_MULTI;
const errors = validateBatchPayload(validBatch.entries);
expect(errors).toHaveLength(0);

// 2. Customizing entries with partial overrides
const customBatch = createPayrollBatchFixture({
  entries: [
    createBatchEntryFixture({
      recipient: "GC3M7UMOI7WGV2VI25NVIYDIDDIMVY374HFKWD4GCSJB2ISGVF64NH3P",
      amount: 10_000_000_000n, // 1,000 XLM
    }),
  ],
});
expect(customBatch.totalAmount).toBe(10_000_000_000n);

// 3. Testing negative scenarios
const emptyBatchErrors = validateBatchPayload(FIXTURE_PAYROLL_BATCH_INVALID_EMPTY.entries);
expect(emptyBatchErrors[0].code).toBe("EMPTY_BATCH");
```

---

### 2. Employee Profile & Eligibility Fixtures

```typescript
import {
  createEmployeeFixture,
  EmployeeEligibilityEvaluator,
  FIXTURE_EMPLOYEE_VALID_ACTIVE,
  FIXTURE_EMPLOYEE_INVALID_TERMINATED,
  FIXTURE_EMPLOYEE_INVALID_BLOCKED,
} from "@zk-payroll/core";

const evaluator = new EmployeeEligibilityEvaluator();

// 1. Valid active employee evaluation
const activeResult = evaluator.evaluate(FIXTURE_EMPLOYEE_VALID_ACTIVE);
expect(activeResult.isEligible).toBe(true);

// 2. Terminated employee rejection
const terminatedResult = evaluator.evaluate(FIXTURE_EMPLOYEE_INVALID_TERMINATED);
expect(terminatedResult.isEligible).toBe(false);
expect(terminatedResult.reasons[0].code).toBe("EMPLOYEE_TERMINATED");

// 3. Overriding specific fields for edge case testing
const customEmployee = createEmployeeFixture({
  salary: 50_000_000_000n,
  department: "Security Operations",
  complianceStatus: "failed",
});
const complianceResult = evaluator.evaluate(customEmployee);
expect(complianceResult.isEligible).toBe(false);
```

---

### 3. Transaction & Envelope Fixtures

```typescript
import {
  createTransactionFixture,
  createTransactionEnvelopeSummaryFixture,
  FIXTURE_TRANSACTION_CONFIRMED,
  FIXTURE_TRANSACTION_FAILED,
} from "@zk-payroll/core";

// 1. Confirmed transaction
expect(FIXTURE_TRANSACTION_CONFIRMED.status).toBe("confirmed");
expect(FIXTURE_TRANSACTION_CONFIRMED.ledger).toBe(12_345_678);

// 2. Simulating contract revert error
const failedTx = createTransactionFixture({
  status: "failed",
  errorDetails: { code: "CONTRACT_REVERT", reason: "insufficient_treasury" },
});
expect(failedTx.status).toBe("failed");

// 3. Testing wallet envelope prompts
const envelope = createTransactionEnvelopeSummaryFixture();
expect(envelope.fee).toBe(100_000n);
expect(envelope.hasSensitiveOperations).toBe(true);
```

---

### 4. Proof Reference Fixtures

```typescript
import {
  parseProofReference,
  createProofReferenceFixture,
  FIXTURE_PROOF_REFERENCE_VALID_COMMITMENT,
  FIXTURE_PROOF_REFERENCE_INVALID_CIRCUIT_ID,
} from "@zk-payroll/core";

// 1. Parsing canonical formatted proof reference string
const parsed = parseProofReference(FIXTURE_PROOF_REFERENCE_VALID_COMMITMENT.formatted);
expect(parsed.circuitId).toBe("payroll-commitment-v1");
expect(parsed.proofHash).toBeDefined();

// 2. Invalid circuit identifier validation
expect(() => parseProofReference(FIXTURE_PROOF_REFERENCE_INVALID_CIRCUIT_ID)).toThrow();
```

---

### 5. Reconciliation Result Fixtures

```typescript
import {
  createReconciliationResultFixture,
  createTreasuryReconciliationReportFixture,
  FIXTURE_RECONCILIATION_MATCHED_DIFF,
  FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH,
  FIXTURE_RECONCILIATION_BALANCED_REPORT,
} from "@zk-payroll/core";

// 1. Balanced reconciliation check
expect(FIXTURE_RECONCILIATION_MATCHED_DIFF.isFullyReconciled).toBe(true);
expect(FIXTURE_RECONCILIATION_MATCHED_DIFF.totalAmountCheck.isMatching).toBe(true);

// 2. Discrepancy scenario: amount mismatch between client expected and on-chain
expect(FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH.isFullyReconciled).toBe(false);
expect(FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH.counts.amount_mismatch).toBe(1);

// 3. Treasury report reconciliation check
expect(FIXTURE_RECONCILIATION_BALANCED_REPORT.isReconciled).toBe(true);
expect(FIXTURE_RECONCILIATION_BALANCED_REPORT.variance).toBe("0");
```

---

## Table-Driven Scenarios

The SDK provides `DETERMINISTIC_SCENARIOS` containing curated scenarios across all 5 domains for table-driven testing:

```typescript
import {
  getDeterministicScenariosByDomain,
  getValidScenarios,
  getInvalidScenarios,
} from "@zk-payroll/core";

describe("Table-driven batch validation", () => {
  const batchScenarios = getDeterministicScenariosByDomain("batch");

  it.each(batchScenarios)("$name: valid=$isValid", ({ fixture, isValid }) => {
    const errors = validateBatchPayload(fixture.entries);
    expect(errors.length === 0).toBe(isValid);
  });
});
```

---

## Contributor Guidelines

1. **Always use deterministic values**: Never inject `Date.now()`, `Math.random()`, or dynamic network payloads into fixtures.
2. **Reuse `DETERMINISTIC_IDENTITIES`**: Reference `DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS` or `DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH` for standard Stellar accounts and hashes.
3. **Maintain privacy standards**: Never commit real employer keys, employee personal data, or private circuit note strings.
