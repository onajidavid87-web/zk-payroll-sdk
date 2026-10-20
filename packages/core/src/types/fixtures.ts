import type { BatchPayload, BatchPaymentEntry } from "../batch/BatchPayloadBuilder";
import type { EmployeeProfile } from "../employees/types";
import type { EmployeeEligibilityRecord } from "../eligibility/types";
import type { NormalizedTransactionStatus, PayrollTransactionStatus } from "../transactions/types";
import type {
  TransactionEnvelopeSummary,
  EnvelopeOperationSummary,
} from "../transaction-envelope/types";
import type { PaymentResult } from "./index";
import type { ParsedProofReference } from "../proofs/reference";
import type { NoteHashReference } from "../privacy";
import type {
  ReconciliationDiffResult,
  ReconciliationDiffEntry,
  ReconciliationDiffCategory,
  TotalAmountCheck,
} from "../reconciliation/types";
import type { TreasuryReconciliationReport } from "../reconciliation/report";

/**
 * Deterministic identities and network constants used across SDK test fixtures.
 * Guaranteed to be fixed, synthetic, and valid for Stellar / Soroban primitives.
 */
export interface DeterministicFixtureIdentities {
  readonly EMPLOYER_ADDRESS: string;
  readonly EMPLOYEE_A_ADDRESS: string;
  readonly EMPLOYEE_B_ADDRESS: string;
  readonly EMPLOYEE_C_ADDRESS: string;
  readonly USDC_TOKEN_CONTRACT: string;
  readonly EURC_TOKEN_CONTRACT: string;
  readonly DEFAULT_CIRCUIT_ID: string;
  readonly SAMPLE_PROOF_HASH: string;
  readonly SAMPLE_NOTE_HASH: string;
  readonly SAMPLE_TX_HASH: string;
  readonly DETERMINISTIC_EPOCH_MS: number;
}

/**
 * Options for building a deterministic payroll batch fixture.
 */
export interface DeterministicBatchFixtureOptions {
  entries?: BatchPaymentEntry[];
  totalAmount?: bigint;
}

/**
 * Options for building a deterministic employee profile fixture.
 */
export interface DeterministicEmployeeFixtureOptions {
  employeeId?: string;
  recipient?: string;
  salary?: bigint;
  amount?: bigint;
  asset?: string;
  name?: string;
  department?: string;
  status?: "active" | "inactive" | "suspended" | "terminated" | "pending" | string;
  complianceStatus?: "passed" | "pending" | "failed" | "blocked" | string;
  effectiveDate?: number | string | Date;
  expiryDate?: number | string | Date;
  isBlocked?: boolean;
  isLocked?: boolean;
  payoutMethodConfirmed?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Options for building a deterministic transaction fixture.
 */
export interface DeterministicTransactionFixtureOptions {
  status?: PayrollTransactionStatus;
  rawStatus?: string;
  txHash?: string;
  ledger?: number;
  createdAt?: number;
  errorDetails?: unknown;
}

/**
 * Options for building a deterministic transaction envelope summary fixture.
 */
export interface DeterministicEnvelopeFixtureOptions {
  sourceAccount?: string;
  networkPassphrase?: string;
  fee?: bigint;
  sequenceNumber?: string;
  operations?: EnvelopeOperationSummary[];
  operationCount?: number;
  summaryText?: string;
  hasSensitiveOperations?: boolean;
  timeBounds?: { minTime: string; maxTime: string };
}

/**
 * Options for building a deterministic proof reference fixture.
 */
export interface DeterministicProofReferenceFixtureOptions {
  circuitId?: string;
  proofHash?: string;
  raw?: string;
}

/**
 * Options for building a deterministic reconciliation result fixture.
 */
export interface DeterministicReconciliationFixtureOptions {
  entries?: ReconciliationDiffEntry[];
  counts?: Partial<Record<ReconciliationDiffCategory, number>>;
  isFullyReconciled?: boolean;
  totalAmountCheck?: Partial<TotalAmountCheck>;
  generatedAt?: number;
}

/**
 * Options for building a deterministic treasury reconciliation report fixture.
 */
export interface DeterministicTreasuryReportFixtureOptions {
  totalAllocated?: string;
  totalDisbursed?: string;
  variance?: string;
  isReconciled?: boolean;
  checkpoints?: Array<{
    id: string;
    allocated: string;
    disbursed: string;
    timestamp: number;
    status: "verified" | "discrepancy" | "pending";
  }>;
  generatedAt?: number;
}

/**
 * Domain category for deterministic scenario fixtures.
 */
export type DeterministicScenarioDomain =
  "batch" | "employee" | "transaction" | "proof_reference" | "reconciliation";

/**
 * Encapsulates a valid or invalid test scenario with metadata and expected outcome.
 */
export interface DeterministicScenario<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly domain: DeterministicScenarioDomain;
  readonly description: string;
  readonly isValid: boolean;
  readonly fixture: T;
  readonly expectedErrorOrIssue?: string;
}
