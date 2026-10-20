import type { BatchPayload, BatchPaymentEntry } from "../../batch/BatchPayloadBuilder";
import type { EmployeeProfile } from "../../employees/types";
import type { EmployeeEligibilityRecord } from "../../eligibility/types";
import type {
  NormalizedTransactionStatus,
  PayrollTransactionStatus,
} from "../../transactions/types";
import type {
  TransactionEnvelopeSummary,
  EnvelopeOperationSummary,
} from "../../transaction-envelope/types";
import type { PaymentResult } from "../../types";
import type { ParsedProofReference } from "../../proofs/reference";
import type { NoteHashReference } from "../../privacy";
import type {
  ReconciliationDiffResult,
  ReconciliationDiffEntry,
  ReconciliationDiffCategory,
  TotalAmountCheck,
  ObservedPaymentState,
} from "../../reconciliation/types";
import type { TreasuryReconciliationReport } from "../../reconciliation/report";
import type {
  DeterministicFixtureIdentities,
  DeterministicBatchFixtureOptions,
  DeterministicEmployeeFixtureOptions,
  DeterministicTransactionFixtureOptions,
  DeterministicEnvelopeFixtureOptions,
  DeterministicProofReferenceFixtureOptions,
  DeterministicReconciliationFixtureOptions,
  DeterministicTreasuryReportFixtureOptions,
  DeterministicScenario,
  DeterministicScenarioDomain,
} from "../../types/fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Deterministic Identities & Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid, deterministic identities and network constants for Stellar and Soroban.
 * All public keys are mathematically valid Ed25519 addresses derived from fixed seeds.
 */
export const DETERMINISTIC_IDENTITIES: DeterministicFixtureIdentities = {
  EMPLOYER_ADDRESS: "GAK4GWMRWBGW5W7QZU6I4VAQQQYAWHTSKBPM62XAFPTDW56CFABQRFBR",
  EMPLOYEE_A_ADDRESS: "GC3M7UMOI7WGV2VI25NVIYDIDDIMVY374HFKWD4GCSJB2ISGVF64NH3P",
  EMPLOYEE_B_ADDRESS: "GD4LDEFMRKD2KIDVH7IOIT65KOLDRXTTH5CG76LOKIS2PDN7FA3FMG3L",
  EMPLOYEE_C_ADDRESS: "GBT55AFEJQ36QOVJSNCNLP3EAC6EB6RNDYSPQH33JRAKXOZ4ISVECAJC",
  USDC_TOKEN_CONTRACT: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  EURC_TOKEN_CONTRACT: "CCV4Y3QW2J5Y6J2H6WZ3Y7V8H2M3K4L5N6P7Q8R9S0T1U2V3W4X5Y6Z7",
  DEFAULT_CIRCUIT_ID: "payroll-salary-v1",
  SAMPLE_PROOF_HASH: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  SAMPLE_NOTE_HASH: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  SAMPLE_TX_HASH: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
  DETERMINISTIC_EPOCH_MS: 1_700_000_000_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Reusable Fixture Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a single batch payment entry fixture with deterministic defaults.
 */
export function createBatchEntryFixture(
  overrides: Partial<BatchPaymentEntry> = {}
): BatchPaymentEntry {
  return {
    recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
    amount: 5_000_000_000n, // 500 XLM in stroops
    asset: "native",
    ...overrides,
  };
}

/**
 * Creates a deterministic payroll batch payload fixture.
 */
export function createPayrollBatchFixture(
  overrides: Partial<DeterministicBatchFixtureOptions> = {}
): BatchPayload {
  const entries = overrides.entries ?? [
    createBatchEntryFixture({
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: 5_000_000_000n,
      asset: "native",
    }),
    createBatchEntryFixture({
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS,
      amount: 3_000_000_000n,
      asset: "native",
    }),
  ];

  const totalAmount =
    overrides.totalAmount ?? entries.reduce((acc, entry) => acc + entry.amount, 0n);

  return {
    entries,
    totalAmount,
  };
}

/**
 * Creates an employee profile fixture with deterministic defaults.
 */
export function createEmployeeFixture(
  overrides: Partial<DeterministicEmployeeFixtureOptions> = {}
): EmployeeProfile {
  const salary = overrides.salary ?? 5_000_000_000n;
  return {
    employeeId: overrides.employeeId ?? "EMP-001",
    recipient: overrides.recipient ?? DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
    name: overrides.name ?? "Alice Johnson",
    department: overrides.department ?? "Engineering",
    salary,
    amount: overrides.amount ?? salary,
    asset: overrides.asset ?? "native",
    status: overrides.status ?? "active",
    complianceStatus: overrides.complianceStatus ?? "passed",
    effectiveDate:
      overrides.effectiveDate ?? DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS - 86_400_000 * 30,
    isBlocked: overrides.isBlocked ?? false,
    isLocked: overrides.isLocked ?? false,
    payoutMethodConfirmed: overrides.payoutMethodConfirmed ?? true,
    payoutMethods: [
      {
        id: "pm-primary",
        kind: "address",
        asset: overrides.asset ?? "native",
        destination: overrides.recipient ?? DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
        status: "confirmed",
        confirmedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS - 86_400_000 * 10,
      },
    ],
    metadata: {
      tier: "senior",
      employmentType: "full-time",
      ...overrides.metadata,
    },
    ...overrides,
  };
}

/**
 * Creates an employee eligibility record fixture.
 */
export function createEmployeeEligibilityFixture(
  overrides: Partial<EmployeeEligibilityRecord> = {}
): EmployeeEligibilityRecord {
  const emp = createEmployeeFixture(overrides);
  return {
    employeeId: emp.employeeId,
    recipient: emp.recipient,
    salary: emp.salary,
    amount: emp.amount,
    asset: emp.asset,
    name: emp.name,
    department: emp.department,
    status: emp.status,
    complianceStatus: emp.complianceStatus,
    effectiveDate: emp.effectiveDate,
    expiryDate: emp.expiryDate,
    isBlocked: emp.isBlocked,
    isLocked: emp.isLocked,
    metadata: emp.metadata,
  };
}

/**
 * Creates a deterministic transaction status fixture.
 */
export function createTransactionFixture(
  overrides: Partial<DeterministicTransactionFixtureOptions> = {}
): NormalizedTransactionStatus {
  return {
    status: overrides.status ?? "confirmed",
    rawStatus: overrides.rawStatus ?? "SUCCESS",
    txHash: overrides.txHash ?? DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
    ledger: overrides.ledger ?? 12_345_678,
    createdAt: overrides.createdAt ?? DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
    errorDetails: overrides.errorDetails,
  };
}

/**
 * Creates a deterministic transaction envelope summary fixture.
 */
export function createTransactionEnvelopeSummaryFixture(
  overrides: Partial<DeterministicEnvelopeFixtureOptions> = {}
): TransactionEnvelopeSummary {
  const operations: EnvelopeOperationSummary[] = overrides.operations ?? [
    {
      type: "private_pay",
      description: "Disburse 500 XLM to recipient GC3M7UMOI7...",
      sensitive: true,
    },
  ];

  return {
    sourceAccount: overrides.sourceAccount ?? DETERMINISTIC_IDENTITIES.EMPLOYER_ADDRESS,
    networkPassphrase: overrides.networkPassphrase ?? "Test SDF Network ; September 2015",
    fee: overrides.fee ?? 100_000n, // 0.01 XLM
    sequenceNumber: overrides.sequenceNumber ?? "123456789012345",
    operations,
    operationCount: overrides.operationCount ?? operations.length,
    summaryText:
      overrides.summaryText ?? "ZK Payroll Disbursal: 1 operation(s), total fee 0.01 XLM",
    hasSensitiveOperations:
      overrides.hasSensitiveOperations ?? operations.some((op) => op.sensitive),
    timeBounds: overrides.timeBounds ?? {
      minTime: "0",
      maxTime: String(Math.floor(DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS / 1000) + 3600),
    },
  };
}

/**
 * Creates a deterministic PaymentResult fixture.
 */
export function createPaymentResultFixture(overrides: Partial<PaymentResult> = {}): PaymentResult {
  return {
    txHash: overrides.txHash ?? DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
    publicSignals: overrides.publicSignals ?? ["1234567890987654321", "9876543210123456789"],
  };
}

/**
 * Creates a parsed proof reference fixture with canonical formatting.
 */
export function createProofReferenceFixture(
  overrides: Partial<DeterministicProofReferenceFixtureOptions> = {}
): ParsedProofReference & { formatted: string } {
  const circuitId = overrides.circuitId ?? DETERMINISTIC_IDENTITIES.DEFAULT_CIRCUIT_ID;
  const proofHash = overrides.proofHash ?? DETERMINISTIC_IDENTITIES.SAMPLE_PROOF_HASH;
  const raw = overrides.raw ?? `${circuitId}:${proofHash}`;

  return {
    circuitId,
    proofHash,
    raw,
    formatted: raw,
  };
}

/**
 * Creates a deterministic NoteHashReference fixture.
 */
export function createNoteHashReferenceFixture(
  overrides: Partial<NoteHashReference> = {}
): NoteHashReference {
  return {
    noteHash: overrides.noteHash ?? DETERMINISTIC_IDENTITIES.SAMPLE_NOTE_HASH,
    source: overrides.source ?? "generated",
  };
}

/**
 * Creates a deterministic reconciliation diff result fixture.
 */
export function createReconciliationResultFixture(
  overrides: Partial<DeterministicReconciliationFixtureOptions> = {}
): ReconciliationDiffResult {
  const entries: ReconciliationDiffEntry[] = overrides.entries ?? [
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      category: "match",
      expected: {
        amount: 5_000_000_000n,
        asset: "native",
        status: "success",
        txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
      },
      observed: {
        recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
        amount: 5_000_000_000n,
        asset: "native",
        txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
        onChainStatus: "confirmed",
        observedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS + 1000,
      },
      reason: "Payment confirmed on-chain with matching amount and recipient.",
    },
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS,
      category: "match",
      expected: {
        amount: 3_000_000_000n,
        asset: "native",
        status: "success",
        txHash: "5b6f2f5cbb9a0f4b43629b99d42cd98a729e87784f3dd88ba3238c8bafefb44c",
      },
      observed: {
        recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS,
        amount: 3_000_000_000n,
        asset: "native",
        txHash: "5b6f2f5cbb9a0f4b43629b99d42cd98a729e87784f3dd88ba3238c8bafefb44c",
        onChainStatus: "confirmed",
        observedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS + 1200,
      },
      reason: "Payment confirmed on-chain with matching amount and recipient.",
    },
  ];

  const counts: Record<ReconciliationDiffCategory, number> = {
    match: 2,
    missing: 0,
    failed_mismatch: 0,
    amount_mismatch: 0,
    still_pending: 0,
    unexpected: 0,
    ...overrides.counts,
  };

  const isFullyReconciled =
    overrides.isFullyReconciled ??
    (counts.missing === 0 &&
      counts.failed_mismatch === 0 &&
      counts.amount_mismatch === 0 &&
      counts.unexpected === 0);

  const totalAmountCheck: TotalAmountCheck = {
    expectedTotal: 8_000_000_000n,
    observedTotal: 8_000_000_000n,
    isMatching: true,
    difference: 0n,
    reason: "Total amounts match: 8000000000 stroops expected and observed.",
    ...overrides.totalAmountCheck,
  };

  return {
    entries,
    counts,
    isFullyReconciled,
    totalAmountCheck,
    generatedAt: overrides.generatedAt ?? DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
  };
}

/**
 * Creates a deterministic treasury reconciliation report fixture.
 */
export function createTreasuryReconciliationReportFixture(
  overrides: Partial<DeterministicTreasuryReportFixtureOptions> = {}
): TreasuryReconciliationReport {
  const checkpoints = overrides.checkpoints ?? [
    {
      id: "cp-001",
      allocated: "10000000000",
      disbursed: "8000000000",
      timestamp: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS - 3600_000,
      status: "verified",
    },
    {
      id: "cp-002",
      allocated: "8000000000",
      disbursed: "8000000000",
      timestamp: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
      status: "verified",
    },
  ];

  return {
    totalAllocated: overrides.totalAllocated ?? "18000000000",
    totalDisbursed: overrides.totalDisbursed ?? "16000000000",
    variance: overrides.variance ?? "2000000000",
    isReconciled: overrides.isReconciled ?? false,
    checkpoints,
    generatedAt: overrides.generatedAt ?? DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pre-built Named Fixtures (Valid & Invalid)
// ─────────────────────────────────────────────────────────────────────────────

// ── Payroll Batches ──────────────────────────────────────────────────────────

/** Valid single-recipient payroll batch. */
export const FIXTURE_PAYROLL_BATCH_VALID_SINGLE: BatchPayload = {
  entries: [
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: 5_000_000_000n,
      asset: "native",
    },
  ],
  totalAmount: 5_000_000_000n,
};

/** Valid multi-recipient payroll batch. */
export const FIXTURE_PAYROLL_BATCH_VALID_MULTI: BatchPayload = {
  entries: [
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: 5_000_000_000n,
      asset: "native",
    },
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS,
      amount: 3_000_000_000n,
      asset: "native",
    },
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_C_ADDRESS,
      amount: 2_500_000_000n,
      asset: "native",
    },
  ],
  totalAmount: 10_500_000_000n,
};

/** Valid custom token asset payroll batch (Soroban contract address). */
export const FIXTURE_PAYROLL_BATCH_VALID_CUSTOM_ASSET: BatchPayload = {
  entries: [
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: 1_000_000_000n,
      asset: DETERMINISTIC_IDENTITIES.USDC_TOKEN_CONTRACT,
    },
  ],
  totalAmount: 1_000_000_000n,
};

/** Invalid batch: empty entries list. */
export const FIXTURE_PAYROLL_BATCH_INVALID_EMPTY: BatchPayload = {
  entries: [],
  totalAmount: 0n,
};

/** Invalid batch: zero amount entry. */
export const FIXTURE_PAYROLL_BATCH_INVALID_ZERO_AMOUNT: BatchPayload = {
  entries: [
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: 0n,
      asset: "native",
    },
  ],
  totalAmount: 0n,
};

/** Invalid batch: negative amount entry. */
export const FIXTURE_PAYROLL_BATCH_INVALID_NEGATIVE_AMOUNT: BatchPayload = {
  entries: [
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: -1_000n,
      asset: "native",
    },
  ],
  totalAmount: -1_000n,
};

/** Invalid batch: malformed recipient address (empty string). */
export const FIXTURE_PAYROLL_BATCH_INVALID_RECIPIENT: BatchPayload = {
  entries: [
    {
      recipient: "",
      amount: 5_000_000_000n,
      asset: "native",
    },
  ],
  totalAmount: 5_000_000_000n,
};

/** Invalid batch: duplicate recipient within same batch. */
export const FIXTURE_PAYROLL_BATCH_INVALID_DUPLICATE_RECIPIENT: BatchPayload = {
  entries: [
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: 2_000_000_000n,
      asset: "native",
    },
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: 3_000_000_000n,
      asset: "native",
    },
  ],
  totalAmount: 5_000_000_000n,
};

/** Invalid batch: missing asset identifier. */
export const FIXTURE_PAYROLL_BATCH_INVALID_MISSING_ASSET: BatchPayload = {
  entries: [
    {
      recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
      amount: 5_000_000_000n,
      asset: "",
    },
  ],
  totalAmount: 5_000_000_000n,
};

// ── Employees ────────────────────────────────────────────────────────────────

/** Valid active employee profile. */
export const FIXTURE_EMPLOYEE_VALID_ACTIVE: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-001",
  recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
  name: "Alice Johnson",
  department: "Engineering",
  salary: 5_000_000_000n,
  status: "active",
  complianceStatus: "passed",
});

/** Valid executive tier employee profile. */
export const FIXTURE_EMPLOYEE_VALID_EXECUTIVE: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-EXEC",
  recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS,
  name: "Robert King",
  department: "Executive",
  salary: 20_000_000_000n,
  status: "active",
  complianceStatus: "passed",
  metadata: { tier: "executive" },
});

/** Valid hourly contractor employee profile. */
export const FIXTURE_EMPLOYEE_VALID_HOURLY: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-CONTRACTOR",
  recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_C_ADDRESS,
  name: "Carol Danvers",
  department: "Operations",
  salary: 1_500_000_000n,
  status: "active",
  complianceStatus: "passed",
  metadata: { employmentType: "contractor" },
});

/** Invalid employee: terminated employment status. */
export const FIXTURE_EMPLOYEE_INVALID_TERMINATED: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-TERM",
  status: "terminated",
});

/** Invalid employee: suspended employment status. */
export const FIXTURE_EMPLOYEE_INVALID_SUSPENDED: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-SUSP",
  status: "suspended",
});

/** Invalid employee: administratively blocked account. */
export const FIXTURE_EMPLOYEE_INVALID_BLOCKED: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-BLOCKED",
  isBlocked: true,
});

/** Invalid employee: malformed recipient address. */
export const FIXTURE_EMPLOYEE_INVALID_RECIPIENT_ADDRESS: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-BAD-ADDR",
  recipient: "NOT_A_VALID_STELLAR_KEY",
});

/** Invalid employee: zero salary. */
export const FIXTURE_EMPLOYEE_INVALID_ZERO_SALARY: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-ZERO-SALARY",
  salary: 0n,
  amount: 0n,
});

/** Invalid employee: missing asset identifier. */
export const FIXTURE_EMPLOYEE_INVALID_MISSING_ASSET: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-NO-ASSET",
  asset: "",
});

/** Invalid employee: failed KYC/compliance check. */
export const FIXTURE_EMPLOYEE_INVALID_COMPLIANCE_FAILED: EmployeeProfile = createEmployeeFixture({
  employeeId: "EMP-KYC-FAIL",
  complianceStatus: "failed",
});

// ── Transactions ─────────────────────────────────────────────────────────────

/** Valid confirmed transaction status. */
export const FIXTURE_TRANSACTION_CONFIRMED: NormalizedTransactionStatus = {
  status: "confirmed",
  rawStatus: "SUCCESS",
  txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
  ledger: 12_345_678,
  createdAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
};

/** Valid pending transaction status. */
export const FIXTURE_TRANSACTION_PENDING: NormalizedTransactionStatus = {
  status: "pending",
  rawStatus: "PENDING",
  txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
  createdAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
};

/** Valid transaction envelope summary. */
export const FIXTURE_TRANSACTION_ENVELOPE_VALID: TransactionEnvelopeSummary =
  createTransactionEnvelopeSummaryFixture();

/** Valid payment result. */
export const FIXTURE_TRANSACTION_PAYMENT_RESULT_VALID: PaymentResult = {
  txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
  publicSignals: ["1234567890987654321", "9876543210123456789"],
};

/** Invalid transaction: failed on-chain execution with revert detail. */
export const FIXTURE_TRANSACTION_FAILED: NormalizedTransactionStatus = {
  status: "failed",
  rawStatus: "FAILED",
  txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
  ledger: 12_345_679,
  createdAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
  errorDetails: { code: "CONTRACT_REVERT", reason: "insufficient_treasury_balance" },
};

/** Invalid transaction: expired submission window. */
export const FIXTURE_TRANSACTION_EXPIRED: NormalizedTransactionStatus = {
  status: "expired",
  rawStatus: "EXPIRED",
  txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
  createdAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS - 86_400_000,
};

/** Invalid transaction: retryable transient RPC failure. */
export const FIXTURE_TRANSACTION_RETRYABLE_TIMEOUT: NormalizedTransactionStatus = {
  status: "retryable",
  rawStatus: "RPC_TIMEOUT",
  txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
  createdAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
  errorDetails: { timeoutMs: 5000, attempt: 3 },
};

/** Invalid transaction: malformed transaction hash. */
export const FIXTURE_TRANSACTION_INVALID_HASH: NormalizedTransactionStatus = {
  status: "failed",
  rawStatus: "MALFORMED_HASH",
  txHash: "bad_hash_xyz",
  createdAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
};

// ── Proof References ─────────────────────────────────────────────────────────

/** Valid commitment proof reference. */
export const FIXTURE_PROOF_REFERENCE_VALID_COMMITMENT = createProofReferenceFixture({
  circuitId: "payroll-commitment-v1",
  proofHash: DETERMINISTIC_IDENTITIES.SAMPLE_PROOF_HASH,
});

/** Valid salary verification proof reference. */
export const FIXTURE_PROOF_REFERENCE_VALID_SALARY = createProofReferenceFixture({
  circuitId: "payroll-salary-v1",
  proofHash: "1111111111111111111111111111111111111111111111111111111111111111",
});

/** Valid note hash reference. */
export const FIXTURE_NOTE_HASH_VALID = createNoteHashReferenceFixture();

/** Invalid proof reference: empty string. */
export const FIXTURE_PROOF_REFERENCE_INVALID_EMPTY = "";

/** Invalid proof reference: malformed circuit id (contains uppercase or illegal symbols). */
export const FIXTURE_PROOF_REFERENCE_INVALID_CIRCUIT_ID =
  "INVALID_CIRCUIT!:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** Invalid proof reference: hash is too short (32 chars instead of 64). */
export const FIXTURE_PROOF_REFERENCE_INVALID_HASH_LENGTH =
  "payroll-salary-v1:e3b0c44298fc1c149afbf4c8996fb924";

/** Invalid proof reference: hash contains non-hex characters. */
export const FIXTURE_PROOF_REFERENCE_INVALID_NON_HEX =
  "payroll-salary-v1:z3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8zz";

/** Invalid proof reference: exceeds maximum allowable string length. */
export const FIXTURE_PROOF_REFERENCE_INVALID_TOO_LONG = `payroll-salary-v1:${"a".repeat(300)}`;

/** Invalid proof reference: missing colon delimiter. */
export const FIXTURE_PROOF_REFERENCE_INVALID_MALFORMED_DELIMITER =
  "payroll-salary-v1_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// ── Reconciliation Results ───────────────────────────────────────────────────

/** Valid balanced reconciliation diff result (all payments match). */
export const FIXTURE_RECONCILIATION_MATCHED_DIFF: ReconciliationDiffResult =
  createReconciliationResultFixture();

/** Valid fully verified treasury reconciliation report (zero variance). */
export const FIXTURE_RECONCILIATION_BALANCED_REPORT: TreasuryReconciliationReport = {
  totalAllocated: "10000000000",
  totalDisbursed: "10000000000",
  variance: "0",
  isReconciled: true,
  checkpoints: [
    {
      id: "cp-001",
      allocated: "10000000000",
      disbursed: "10000000000",
      timestamp: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
      status: "verified",
    },
  ],
  generatedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
};

/** Invalid reconciliation diff: amount mismatch between client expected and on-chain observed. */
export const FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH: ReconciliationDiffResult =
  createReconciliationResultFixture({
    entries: [
      {
        recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
        category: "amount_mismatch",
        expected: {
          amount: 5_000_000_000n,
          asset: "native",
          status: "success",
          txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
        },
        observed: {
          recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
          amount: 4_000_000_000n, // Discrepancy: 100 XLM less
          asset: "native",
          txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
          onChainStatus: "confirmed",
          observedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS + 1000,
        },
        reason: "Observed amount differs from expected amount.",
      },
    ],
    counts: { match: 0, amount_mismatch: 1 },
    isFullyReconciled: false,
    totalAmountCheck: {
      expectedTotal: 5_000_000_000n,
      observedTotal: 4_000_000_000n,
      isMatching: false,
      difference: 1_000_000_000n,
      reason: "Expected total exceeds observed total by 1000000000 stroops.",
    },
  });

/** Invalid reconciliation diff: expected payment missing from on-chain history. */
export const FIXTURE_RECONCILIATION_DISCREPANT_MISSING_CHAIN: ReconciliationDiffResult =
  createReconciliationResultFixture({
    entries: [
      {
        recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS,
        category: "missing",
        expected: {
          amount: 3_000_000_000n,
          asset: "native",
          status: "success",
          txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
        },
        observed: {
          recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS,
          onChainStatus: "not_found",
          observedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS + 1000,
        },
        reason: "No on-chain transaction found for expected payment.",
      },
    ],
    counts: { match: 0, missing: 1 },
    isFullyReconciled: false,
  });

/** Invalid reconciliation diff: expected success failed on chain. */
export const FIXTURE_RECONCILIATION_DISCREPANT_STATUS_FAILURE: ReconciliationDiffResult =
  createReconciliationResultFixture({
    entries: [
      {
        recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
        category: "failed_mismatch",
        expected: {
          amount: 5_000_000_000n,
          asset: "native",
          status: "success",
          txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
        },
        observed: {
          recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
          amount: 5_000_000_000n,
          asset: "native",
          txHash: DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH,
          onChainStatus: "failed",
          observedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS + 1000,
        },
        reason: "Expected successful payment failed on-chain.",
      },
    ],
    counts: { match: 0, failed_mismatch: 1 },
    isFullyReconciled: false,
  });

/** Invalid reconciliation diff: unexpected on-chain transaction observed with no prior draft. */
export const FIXTURE_RECONCILIATION_DISCREPANT_UNEXPECTED: ReconciliationDiffResult =
  createReconciliationResultFixture({
    entries: [
      {
        recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_C_ADDRESS,
        category: "unexpected",
        observed: {
          recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_C_ADDRESS,
          amount: 2_500_000_000n,
          asset: "native",
          txHash: "8888888888888888888888888888888888888888888888888888888888888888",
          onChainStatus: "confirmed",
          observedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS + 2000,
        },
        reason: "Observed transaction has no matching client-side record.",
      },
    ],
    counts: { match: 0, unexpected: 1 },
    isFullyReconciled: false,
  });

/** Invalid treasury report: non-zero variance and discrepancy checkpoint. */
export const FIXTURE_RECONCILIATION_TREASURY_VARIANCE_REPORT: TreasuryReconciliationReport = {
  totalAllocated: "10000000000",
  totalDisbursed: "8000000000",
  variance: "2000000000",
  isReconciled: false,
  checkpoints: [
    {
      id: "cp-err",
      allocated: "10000000000",
      disbursed: "8000000000",
      timestamp: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
      status: "discrepancy",
    },
  ],
  generatedAt: DETERMINISTIC_IDENTITIES.DETERMINISTIC_EPOCH_MS,
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Structured Scenarios Collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Curated collection of deterministic scenarios covering all 5 core objects
 * across valid and invalid states for table-driven test suites.
 */
export const DETERMINISTIC_SCENARIOS: readonly DeterministicScenario[] = [
  // ── Batch Scenarios ──
  {
    id: "SCN-BATCH-001-VALID-SINGLE",
    name: "Valid Single-Entry Batch",
    domain: "batch",
    description: "Standard payroll batch with one valid recipient and positive stroop amount.",
    isValid: true,
    fixture: FIXTURE_PAYROLL_BATCH_VALID_SINGLE,
  },
  {
    id: "SCN-BATCH-002-VALID-MULTI",
    name: "Valid Multi-Entry Batch",
    domain: "batch",
    description: "Multi-employee batch with three distinct recipients and verified sum.",
    isValid: true,
    fixture: FIXTURE_PAYROLL_BATCH_VALID_MULTI,
  },
  {
    id: "SCN-BATCH-003-VALID-TOKEN",
    name: "Valid Custom Token Batch",
    domain: "batch",
    description: "Batch settling in Soroban contract token (USDC) rather than native XLM.",
    isValid: true,
    fixture: FIXTURE_PAYROLL_BATCH_VALID_CUSTOM_ASSET,
  },
  {
    id: "SCN-BATCH-004-INVALID-EMPTY",
    name: "Invalid Empty Batch",
    domain: "batch",
    description: "Batch payload contains 0 payment entries.",
    isValid: false,
    fixture: FIXTURE_PAYROLL_BATCH_INVALID_EMPTY,
    expectedErrorOrIssue: "EMPTY_BATCH",
  },
  {
    id: "SCN-BATCH-005-INVALID-ZERO",
    name: "Invalid Zero Amount Batch",
    domain: "batch",
    description: "Payment entry contains 0 stroops.",
    isValid: false,
    fixture: FIXTURE_PAYROLL_BATCH_INVALID_ZERO_AMOUNT,
    expectedErrorOrIssue: "INVALID_AMOUNT",
  },
  {
    id: "SCN-BATCH-006-INVALID-RECIPIENT",
    name: "Invalid Recipient Address Batch",
    domain: "batch",
    description: "Payment entry contains malformed recipient string.",
    isValid: false,
    fixture: FIXTURE_PAYROLL_BATCH_INVALID_RECIPIENT,
    expectedErrorOrIssue: "INVALID_RECIPIENT",
  },
  {
    id: "SCN-BATCH-007-INVALID-DUPLICATE",
    name: "Invalid Duplicate Recipient Batch",
    domain: "batch",
    description: "Batch contains multiple entries for the same recipient address.",
    isValid: false,
    fixture: FIXTURE_PAYROLL_BATCH_INVALID_DUPLICATE_RECIPIENT,
    expectedErrorOrIssue: "DUPLICATE_RECIPIENT",
  },

  // ── Employee Scenarios ──
  {
    id: "SCN-EMP-001-VALID-ACTIVE",
    name: "Valid Active Employee Profile",
    domain: "employee",
    description: "Fully onboarded employee with active status and passed compliance.",
    isValid: true,
    fixture: FIXTURE_EMPLOYEE_VALID_ACTIVE,
  },
  {
    id: "SCN-EMP-002-INVALID-TERMINATED",
    name: "Invalid Terminated Employee",
    domain: "employee",
    description: "Employee lifecycle status marked as terminated.",
    isValid: false,
    fixture: FIXTURE_EMPLOYEE_INVALID_TERMINATED,
    expectedErrorOrIssue: "EMPLOYEE_TERMINATED",
  },
  {
    id: "SCN-EMP-003-INVALID-BLOCKED",
    name: "Invalid Administratively Blocked Employee",
    domain: "employee",
    description: "Employee record explicitly flagged as isBlocked.",
    isValid: false,
    fixture: FIXTURE_EMPLOYEE_INVALID_BLOCKED,
    expectedErrorOrIssue: "COMPLIANCE_BLOCKED",
  },
  {
    id: "SCN-EMP-004-INVALID-ZERO-SALARY",
    name: "Invalid Zero Salary Employee",
    domain: "employee",
    description: "Employee record with non-positive salary value.",
    isValid: false,
    fixture: FIXTURE_EMPLOYEE_INVALID_ZERO_SALARY,
    expectedErrorOrIssue: "ZERO_OR_NEGATIVE_SALARY",
  },
  {
    id: "SCN-EMP-005-INVALID-COMPLIANCE",
    name: "Invalid Failed Compliance Employee",
    domain: "employee",
    description: "Employee with complianceStatus set to failed.",
    isValid: false,
    fixture: FIXTURE_EMPLOYEE_INVALID_COMPLIANCE_FAILED,
    expectedErrorOrIssue: "COMPLIANCE_BLOCKED",
  },

  // ── Transaction Scenarios ──
  {
    id: "SCN-TX-001-VALID-CONFIRMED",
    name: "Valid Confirmed Transaction",
    domain: "transaction",
    description: "Successfully finalized transaction with known inclusion ledger.",
    isValid: true,
    fixture: FIXTURE_TRANSACTION_CONFIRMED,
  },
  {
    id: "SCN-TX-002-INVALID-FAILED",
    name: "Invalid Failed Transaction",
    domain: "transaction",
    description: "Transaction aborted on-chain due to contract revert.",
    isValid: false,
    fixture: FIXTURE_TRANSACTION_FAILED,
    expectedErrorOrIssue: "CONTRACT_REVERT",
  },
  {
    id: "SCN-TX-003-INVALID-EXPIRED",
    name: "Invalid Expired Transaction",
    domain: "transaction",
    description: "Transaction submission timed out past valid ledger boundary.",
    isValid: false,
    fixture: FIXTURE_TRANSACTION_EXPIRED,
    expectedErrorOrIssue: "EXPIRED",
  },

  // ── Proof Reference Scenarios ──
  {
    id: "SCN-PRF-001-VALID-COMMITMENT",
    name: "Valid Commitment Proof Reference",
    domain: "proof_reference",
    description: "Canonical <circuitId>:<proofHash> reference with valid 64-hex digest.",
    isValid: true,
    fixture: FIXTURE_PROOF_REFERENCE_VALID_COMMITMENT,
  },
  {
    id: "SCN-PRF-002-INVALID-EMPTY",
    name: "Invalid Empty Proof Reference",
    domain: "proof_reference",
    description: "Empty string passed to proof reference parser.",
    isValid: false,
    fixture: FIXTURE_PROOF_REFERENCE_INVALID_EMPTY,
    expectedErrorOrIssue: "Proof reference must not be empty",
  },
  {
    id: "SCN-PRF-003-INVALID-CIRCUIT",
    name: "Invalid Circuit ID in Proof Reference",
    domain: "proof_reference",
    description: "Circuit id contains uppercase letters or forbidden characters.",
    isValid: false,
    fixture: FIXTURE_PROOF_REFERENCE_INVALID_CIRCUIT_ID,
    expectedErrorOrIssue: "Invalid circuit id",
  },
  {
    id: "SCN-PRF-004-INVALID-HASH-LENGTH",
    name: "Invalid Proof Hash Length",
    domain: "proof_reference",
    description: "Proof hash has fewer than 64 hex characters.",
    isValid: false,
    fixture: FIXTURE_PROOF_REFERENCE_INVALID_HASH_LENGTH,
    expectedErrorOrIssue: "Invalid proof hash",
  },

  // ── Reconciliation Scenarios ──
  {
    id: "SCN-REC-001-VALID-MATCHED",
    name: "Valid Matched Reconciliation Diff",
    domain: "reconciliation",
    description: "All client expected outcomes match on-chain verified records exactly.",
    isValid: true,
    fixture: FIXTURE_RECONCILIATION_MATCHED_DIFF,
  },
  {
    id: "SCN-REC-002-VALID-BALANCED-REPORT",
    name: "Valid Balanced Treasury Report",
    domain: "reconciliation",
    description: "Allocated equals disbursed with zero variance and verified checkpoints.",
    isValid: true,
    fixture: FIXTURE_RECONCILIATION_BALANCED_REPORT,
  },
  {
    id: "SCN-REC-003-INVALID-AMOUNT-MISMATCH",
    name: "Invalid Amount Mismatch Diff",
    domain: "reconciliation",
    description: "Observed on-chain disbursement differs from expected batch amount.",
    isValid: false,
    fixture: FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH,
    expectedErrorOrIssue: "amount_mismatch",
  },
  {
    id: "SCN-REC-004-INVALID-MISSING-CHAIN",
    name: "Invalid Missing On-Chain Diff",
    domain: "reconciliation",
    description: "Expected payment has no confirmed receipt in ledger history.",
    isValid: false,
    fixture: FIXTURE_RECONCILIATION_DISCREPANT_MISSING_CHAIN,
    expectedErrorOrIssue: "missing",
  },
  {
    id: "SCN-REC-005-INVALID-TREASURY-VARIANCE",
    name: "Invalid Treasury Variance Report",
    domain: "reconciliation",
    description: "Treasury allocations and disbursements diverge with flagged discrepancy.",
    isValid: false,
    fixture: FIXTURE_RECONCILIATION_TREASURY_VARIANCE_REPORT,
    expectedErrorOrIssue: "discrepancy",
  },
];

/**
 * Filter scenarios by domain.
 */
export function getDeterministicScenariosByDomain(
  domain: DeterministicScenarioDomain
): readonly DeterministicScenario[] {
  return DETERMINISTIC_SCENARIOS.filter((s) => s.domain === domain);
}

/**
 * Return only valid scenarios (optionally filtered by domain).
 */
export function getValidScenarios(
  domain?: DeterministicScenarioDomain
): readonly DeterministicScenario[] {
  return DETERMINISTIC_SCENARIOS.filter(
    (s) => s.isValid && (domain === undefined || s.domain === domain)
  );
}

/**
 * Return only invalid scenarios (optionally filtered by domain).
 */
export function getInvalidScenarios(
  domain?: DeterministicScenarioDomain
): readonly DeterministicScenario[] {
  return DETERMINISTIC_SCENARIOS.filter(
    (s) => !s.isValid && (domain === undefined || s.domain === domain)
  );
}
