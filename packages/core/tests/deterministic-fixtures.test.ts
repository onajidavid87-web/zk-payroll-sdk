import { StrKey } from "@stellar/stellar-sdk";
import { validateBatchPayload } from "../src/batch/BatchPayloadBuilder";
import { EmployeeEligibilityEvaluator } from "../src/eligibility/EmployeeEligibilityEvaluator";
import { validatePayoutDestination } from "../src/employees/payoutDestination";
import { parseProofReference } from "../src/proofs/reference";
import { ProofReferenceParsingError } from "../src/proofs/errors";
import { isValidNoteHash } from "../src/privacy";
import {
  DETERMINISTIC_IDENTITIES,
  createBatchEntryFixture,
  createPayrollBatchFixture,
  createEmployeeFixture,
  createEmployeeEligibilityFixture,
  createTransactionFixture,
  createTransactionEnvelopeSummaryFixture,
  createPaymentResultFixture,
  createProofReferenceFixture,
  createNoteHashReferenceFixture,
  createReconciliationResultFixture,
  createTreasuryReconciliationReportFixture,
  FIXTURE_PAYROLL_BATCH_VALID_SINGLE,
  FIXTURE_PAYROLL_BATCH_VALID_MULTI,
  FIXTURE_PAYROLL_BATCH_VALID_CUSTOM_ASSET,
  FIXTURE_PAYROLL_BATCH_INVALID_EMPTY,
  FIXTURE_PAYROLL_BATCH_INVALID_ZERO_AMOUNT,
  FIXTURE_PAYROLL_BATCH_INVALID_NEGATIVE_AMOUNT,
  FIXTURE_PAYROLL_BATCH_INVALID_RECIPIENT,
  FIXTURE_PAYROLL_BATCH_INVALID_DUPLICATE_RECIPIENT,
  FIXTURE_PAYROLL_BATCH_INVALID_MISSING_ASSET,
  FIXTURE_EMPLOYEE_VALID_ACTIVE,
  FIXTURE_EMPLOYEE_VALID_EXECUTIVE,
  FIXTURE_EMPLOYEE_VALID_HOURLY,
  FIXTURE_EMPLOYEE_INVALID_TERMINATED,
  FIXTURE_EMPLOYEE_INVALID_SUSPENDED,
  FIXTURE_EMPLOYEE_INVALID_BLOCKED,
  FIXTURE_EMPLOYEE_INVALID_RECIPIENT_ADDRESS,
  FIXTURE_EMPLOYEE_INVALID_ZERO_SALARY,
  FIXTURE_EMPLOYEE_INVALID_MISSING_ASSET,
  FIXTURE_EMPLOYEE_INVALID_COMPLIANCE_FAILED,
  FIXTURE_TRANSACTION_CONFIRMED,
  FIXTURE_TRANSACTION_PENDING,
  FIXTURE_TRANSACTION_ENVELOPE_VALID,
  FIXTURE_TRANSACTION_PAYMENT_RESULT_VALID,
  FIXTURE_TRANSACTION_FAILED,
  FIXTURE_TRANSACTION_EXPIRED,
  FIXTURE_TRANSACTION_RETRYABLE_TIMEOUT,
  FIXTURE_PROOF_REFERENCE_VALID_COMMITMENT,
  FIXTURE_PROOF_REFERENCE_VALID_SALARY,
  FIXTURE_NOTE_HASH_VALID,
  FIXTURE_PROOF_REFERENCE_INVALID_EMPTY,
  FIXTURE_PROOF_REFERENCE_INVALID_CIRCUIT_ID,
  FIXTURE_PROOF_REFERENCE_INVALID_HASH_LENGTH,
  FIXTURE_PROOF_REFERENCE_INVALID_NON_HEX,
  FIXTURE_PROOF_REFERENCE_INVALID_TOO_LONG,
  FIXTURE_PROOF_REFERENCE_INVALID_MALFORMED_DELIMITER,
  FIXTURE_RECONCILIATION_MATCHED_DIFF,
  FIXTURE_RECONCILIATION_BALANCED_REPORT,
  FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH,
  FIXTURE_RECONCILIATION_DISCREPANT_MISSING_CHAIN,
  FIXTURE_RECONCILIATION_DISCREPANT_STATUS_FAILURE,
  FIXTURE_RECONCILIATION_DISCREPANT_UNEXPECTED,
  FIXTURE_RECONCILIATION_TREASURY_VARIANCE_REPORT,
  DETERMINISTIC_SCENARIOS,
  getDeterministicScenariosByDomain,
  getValidScenarios,
  getInvalidScenarios,
} from "./fixtures/deterministic-fixtures";

describe("Deterministic Test Fixtures", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Deterministic Identities & Invariants
  // ──────────────────────────────────────────────────────────────────────────
  describe("Identities & Invariants", () => {
    it("provides valid Stellar Ed25519 public keys for all actors", () => {
      expect(StrKey.isValidEd25519PublicKey(DETERMINISTIC_IDENTITIES.EMPLOYER_ADDRESS)).toBe(true);
      expect(StrKey.isValidEd25519PublicKey(DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS)).toBe(
        true
      );
      expect(StrKey.isValidEd25519PublicKey(DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS)).toBe(
        true
      );
      expect(StrKey.isValidEd25519PublicKey(DETERMINISTIC_IDENTITIES.EMPLOYEE_C_ADDRESS)).toBe(
        true
      );
    });

    it("ensures all actor addresses are distinct", () => {
      const addresses = [
        DETERMINISTIC_IDENTITIES.EMPLOYER_ADDRESS,
        DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS,
        DETERMINISTIC_IDENTITIES.EMPLOYEE_B_ADDRESS,
        DETERMINISTIC_IDENTITIES.EMPLOYEE_C_ADDRESS,
      ];
      const unique = new Set(addresses);
      expect(unique.size).toBe(addresses.length);
    });

    it("provides valid hex digests for sample proof, note, and tx hashes", () => {
      expect(DETERMINISTIC_IDENTITIES.SAMPLE_PROOF_HASH).toMatch(/^[a-f0-9]{64}$/);
      expect(DETERMINISTIC_IDENTITIES.SAMPLE_NOTE_HASH).toMatch(/^[a-f0-9]{64}$/);
      expect(DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH).toMatch(/^[a-f0-9]{64}$/);
      expect(isValidNoteHash(DETERMINISTIC_IDENTITIES.SAMPLE_NOTE_HASH)).toBe(true);
    });

    it("yields identical fixtures across consecutive invocations (pure functions)", () => {
      const batch1 = createPayrollBatchFixture();
      const batch2 = createPayrollBatchFixture();
      expect(batch1).toEqual(batch2);

      const emp1 = createEmployeeFixture();
      const emp2 = createEmployeeFixture();
      expect(emp1).toEqual(emp2);

      const tx1 = createTransactionFixture();
      const tx2 = createTransactionFixture();
      expect(tx1).toEqual(tx2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Payroll Batch Fixtures
  // ──────────────────────────────────────────────────────────────────────────
  describe("Payroll Batch Fixtures", () => {
    it("builds a default batch payload with matching totalAmount", () => {
      const batch = createPayrollBatchFixture();
      expect(batch.entries.length).toBeGreaterThan(0);
      const computedSum = batch.entries.reduce((sum, e) => sum + e.amount, 0n);
      expect(batch.totalAmount).toBe(computedSum);
    });

    it("allows customizing entries and totalAmount via overrides", () => {
      const customEntry = createBatchEntryFixture({
        recipient: DETERMINISTIC_IDENTITIES.EMPLOYEE_C_ADDRESS,
        amount: 7_500_000_000n,
      });
      const batch = createPayrollBatchFixture({
        entries: [customEntry],
        totalAmount: 7_500_000_000n,
      });

      expect(batch.entries).toHaveLength(1);
      expect(batch.entries[0].recipient).toBe(DETERMINISTIC_IDENTITIES.EMPLOYEE_C_ADDRESS);
      expect(batch.totalAmount).toBe(7_500_000_000n);
    });

    it("validates valid batches with validateBatchPayload (0 errors)", () => {
      expect(validateBatchPayload(FIXTURE_PAYROLL_BATCH_VALID_SINGLE.entries)).toEqual([]);
      expect(validateBatchPayload(FIXTURE_PAYROLL_BATCH_VALID_MULTI.entries)).toEqual([]);
      expect(validateBatchPayload(FIXTURE_PAYROLL_BATCH_VALID_CUSTOM_ASSET.entries)).toEqual([]);
    });

    it("catches empty batch invalidation with EMPTY_BATCH code", () => {
      const errors = validateBatchPayload(FIXTURE_PAYROLL_BATCH_INVALID_EMPTY.entries);
      expect(errors.some((err) => err.code === "EMPTY_BATCH")).toBe(true);
    });

    it("catches non-positive amount with INVALID_AMOUNT code", () => {
      const zeroErrors = validateBatchPayload(FIXTURE_PAYROLL_BATCH_INVALID_ZERO_AMOUNT.entries);
      expect(zeroErrors.some((err) => err.code === "INVALID_AMOUNT")).toBe(true);

      const negErrors = validateBatchPayload(FIXTURE_PAYROLL_BATCH_INVALID_NEGATIVE_AMOUNT.entries);
      expect(negErrors.some((err) => err.code === "INVALID_AMOUNT")).toBe(true);
    });

    it("catches malformed recipient with INVALID_RECIPIENT code", () => {
      const errors = validateBatchPayload(FIXTURE_PAYROLL_BATCH_INVALID_RECIPIENT.entries);
      expect(errors.some((err) => err.code === "INVALID_RECIPIENT")).toBe(true);
    });

    it("catches duplicate recipients with DUPLICATE_RECIPIENT code", () => {
      const errors = validateBatchPayload(
        FIXTURE_PAYROLL_BATCH_INVALID_DUPLICATE_RECIPIENT.entries
      );
      expect(errors.some((err) => err.code === "DUPLICATE_RECIPIENT")).toBe(true);
    });

    it("catches missing asset with MISSING_ASSET code", () => {
      const errors = validateBatchPayload(FIXTURE_PAYROLL_BATCH_INVALID_MISSING_ASSET.entries);
      expect(errors.some((err) => err.code === "MISSING_ASSET")).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Employee Profile & Eligibility Fixtures
  // ──────────────────────────────────────────────────────────────────────────
  describe("Employee Profile & Eligibility Fixtures", () => {
    const evaluator = new EmployeeEligibilityEvaluator();

    it("builds a default active employee profile with confirmed payout method", () => {
      const emp = createEmployeeFixture();
      expect(emp.employeeId).toBe("EMP-001");
      expect(emp.status).toBe("active");
      expect(emp.complianceStatus).toBe("passed");
      expect(emp.payoutMethodConfirmed).toBe(true);
      expect(emp.payoutMethods).toHaveLength(1);
    });

    it("creates an EmployeeEligibilityRecord with createEmployeeEligibilityFixture", () => {
      const record = createEmployeeEligibilityFixture({
        employeeId: "EMP-CUSTOM",
        salary: 10_000_000_000n,
      });
      expect(record.employeeId).toBe("EMP-CUSTOM");
      expect(record.salary).toBe(10_000_000_000n);
      expect(record.recipient).toBe(DETERMINISTIC_IDENTITIES.EMPLOYEE_A_ADDRESS);
    });

    it("validates valid employee profiles as eligible in EmployeeEligibilityEvaluator", () => {
      const resActive = evaluator.evaluate(FIXTURE_EMPLOYEE_VALID_ACTIVE);
      expect(resActive.isEligible).toBe(true);
      expect(resActive.status).toBe("eligible");

      const resExec = evaluator.evaluate(FIXTURE_EMPLOYEE_VALID_EXECUTIVE);
      expect(resExec.isEligible).toBe(true);

      const resHourly = evaluator.evaluate(FIXTURE_EMPLOYEE_VALID_HOURLY);
      expect(resHourly.isEligible).toBe(true);
    });

    it("rejects terminated and suspended employees with status reason codes", () => {
      const resTerm = evaluator.evaluate(FIXTURE_EMPLOYEE_INVALID_TERMINATED);
      expect(resTerm.isEligible).toBe(false);
      expect(resTerm.reasons.some((r) => r.code === "EMPLOYEE_TERMINATED")).toBe(true);

      const resSusp = evaluator.evaluate(FIXTURE_EMPLOYEE_INVALID_SUSPENDED);
      expect(resSusp.isEligible).toBe(false);
      expect(resSusp.reasons.some((r) => r.code === "EMPLOYEE_SUSPENDED")).toBe(true);
    });

    it("rejects blocked accounts with COMPLIANCE_BLOCKED code", () => {
      const resBlocked = evaluator.evaluate(FIXTURE_EMPLOYEE_INVALID_BLOCKED);
      expect(resBlocked.isEligible).toBe(false);
      expect(resBlocked.reasons.some((r) => r.code === "COMPLIANCE_BLOCKED")).toBe(true);
    });

    it("rejects zero salary with non-positive salary reason code", () => {
      const resZero = evaluator.evaluate(FIXTURE_EMPLOYEE_INVALID_ZERO_SALARY);
      expect(resZero.isEligible).toBe(false);
      expect(resZero.reasons.some((r) => r.code === "ZERO_OR_NEGATIVE_SALARY")).toBe(true);
    });

    it("rejects failed compliance check with COMPLIANCE_BLOCKED code", () => {
      const resKyc = evaluator.evaluate(FIXTURE_EMPLOYEE_INVALID_COMPLIANCE_FAILED);
      expect(resKyc.isEligible).toBe(false);
      expect(resKyc.reasons.some((r) => r.code === "COMPLIANCE_BLOCKED")).toBe(true);
    });

    it("validates payout destination with validatePayoutDestination", () => {
      const validDest = validatePayoutDestination(FIXTURE_EMPLOYEE_VALID_ACTIVE.recipient);
      expect(validDest.ok).toBe(true);
      if (validDest.ok) {
        expect(validDest.kind).toBe("account");
      }

      const invalidDest = validatePayoutDestination(
        FIXTURE_EMPLOYEE_INVALID_RECIPIENT_ADDRESS.recipient
      );
      expect(invalidDest.ok).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Transaction Fixtures
  // ──────────────────────────────────────────────────────────────────────────
  describe("Transaction Fixtures", () => {
    it("creates a default confirmed transaction", () => {
      const tx = createTransactionFixture();
      expect(tx.status).toBe("confirmed");
      expect(tx.txHash).toBe(DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH);
      expect(tx.ledger).toBe(12_345_678);
    });

    it("supports custom status overrides (pending, failed, retryable, expired)", () => {
      expect(FIXTURE_TRANSACTION_CONFIRMED.status).toBe("confirmed");
      expect(FIXTURE_TRANSACTION_PENDING.status).toBe("pending");
      expect(FIXTURE_TRANSACTION_FAILED.status).toBe("failed");
      expect(FIXTURE_TRANSACTION_EXPIRED.status).toBe("expired");
      expect(FIXTURE_TRANSACTION_RETRYABLE_TIMEOUT.status).toBe("retryable");
    });

    it("builds a complete TransactionEnvelopeSummary fixture", () => {
      const envelope = createTransactionEnvelopeSummaryFixture();
      expect(envelope.sourceAccount).toBe(DETERMINISTIC_IDENTITIES.EMPLOYER_ADDRESS);
      expect(envelope.fee).toBe(100_000n);
      expect(envelope.operations).toHaveLength(1);
      expect(envelope.hasSensitiveOperations).toBe(true);
      expect(envelope.summaryText).toContain("ZK Payroll Disbursal");
    });

    it("builds a PaymentResult fixture", () => {
      const result = createPaymentResultFixture();
      expect(result.txHash).toBe(DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH);
      expect(result.publicSignals).toHaveLength(2);
      expect(FIXTURE_TRANSACTION_PAYMENT_RESULT_VALID.txHash).toBe(
        DETERMINISTIC_IDENTITIES.SAMPLE_TX_HASH
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Proof Reference Fixtures
  // ──────────────────────────────────────────────────────────────────────────
  describe("Proof Reference Fixtures", () => {
    it("creates a canonical formatted proof reference string", () => {
      const prf = createProofReferenceFixture();
      expect(prf.circuitId).toBe("payroll-salary-v1");
      expect(prf.proofHash).toBe(DETERMINISTIC_IDENTITIES.SAMPLE_PROOF_HASH);
      expect(prf.formatted).toBe(`payroll-salary-v1:${DETERMINISTIC_IDENTITIES.SAMPLE_PROOF_HASH}`);
    });

    it("parses valid proof references successfully via parseProofReference", () => {
      const parsedCommitment = parseProofReference(
        FIXTURE_PROOF_REFERENCE_VALID_COMMITMENT.formatted
      );
      expect(parsedCommitment.circuitId).toBe("payroll-commitment-v1");
      expect(parsedCommitment.proofHash).toBe(DETERMINISTIC_IDENTITIES.SAMPLE_PROOF_HASH);

      const parsedSalary = parseProofReference(FIXTURE_PROOF_REFERENCE_VALID_SALARY.formatted);
      expect(parsedSalary.circuitId).toBe("payroll-salary-v1");
    });

    it("throws ProofReferenceParsingError for invalid proof reference cases", () => {
      // Empty string
      expect(() => parseProofReference(FIXTURE_PROOF_REFERENCE_INVALID_EMPTY)).toThrow(
        ProofReferenceParsingError
      );

      // Invalid circuit ID
      expect(() => parseProofReference(FIXTURE_PROOF_REFERENCE_INVALID_CIRCUIT_ID)).toThrow(
        ProofReferenceParsingError
      );

      // Invalid hash length
      expect(() => parseProofReference(FIXTURE_PROOF_REFERENCE_INVALID_HASH_LENGTH)).toThrow(
        ProofReferenceParsingError
      );

      // Non-hex characters
      expect(() => parseProofReference(FIXTURE_PROOF_REFERENCE_INVALID_NON_HEX)).toThrow(
        ProofReferenceParsingError
      );

      // Length exceeds limit
      expect(() => parseProofReference(FIXTURE_PROOF_REFERENCE_INVALID_TOO_LONG)).toThrow(
        ProofReferenceParsingError
      );

      // Missing delimiter
      expect(() =>
        parseProofReference(FIXTURE_PROOF_REFERENCE_INVALID_MALFORMED_DELIMITER)
      ).toThrow(ProofReferenceParsingError);
    });

    it("creates and verifies valid NoteHashReference fixtures", () => {
      const noteRef = createNoteHashReferenceFixture();
      expect(isValidNoteHash(noteRef.noteHash)).toBe(true);
      expect(noteRef.source).toBe("generated");
      expect(isValidNoteHash(FIXTURE_NOTE_HASH_VALID.noteHash)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Reconciliation Result Fixtures
  // ──────────────────────────────────────────────────────────────────────────
  describe("Reconciliation Result Fixtures", () => {
    it("builds a fully matched reconciliation diff fixture", () => {
      const res = createReconciliationResultFixture();
      expect(res.isFullyReconciled).toBe(true);
      expect(res.counts.match).toBe(2);
      expect(res.counts.missing).toBe(0);
      expect(res.totalAmountCheck.isMatching).toBe(true);
      expect(res.totalAmountCheck.difference).toBe(0n);
    });

    it("builds a balanced treasury reconciliation report", () => {
      const report = createTreasuryReconciliationReportFixture({
        totalAllocated: "10000000000",
        totalDisbursed: "10000000000",
        variance: "0",
        isReconciled: true,
      });
      expect(report.isReconciled).toBe(true);
      expect(report.variance).toBe("0");
      expect(report.checkpoints.every((c) => c.status === "verified")).toBe(true);
    });

    it("accurately represents discrepant reconciliation states", () => {
      // Amount mismatch
      expect(FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH.isFullyReconciled).toBe(false);
      expect(FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH.counts.amount_mismatch).toBe(1);
      expect(FIXTURE_RECONCILIATION_DISCREPANT_AMOUNT_MISMATCH.totalAmountCheck.isMatching).toBe(
        false
      );

      // Missing on chain
      expect(FIXTURE_RECONCILIATION_DISCREPANT_MISSING_CHAIN.isFullyReconciled).toBe(false);
      expect(FIXTURE_RECONCILIATION_DISCREPANT_MISSING_CHAIN.counts.missing).toBe(1);

      // Status failure
      expect(FIXTURE_RECONCILIATION_DISCREPANT_STATUS_FAILURE.isFullyReconciled).toBe(false);
      expect(FIXTURE_RECONCILIATION_DISCREPANT_STATUS_FAILURE.counts.failed_mismatch).toBe(1);

      // Unexpected on chain
      expect(FIXTURE_RECONCILIATION_DISCREPANT_UNEXPECTED.isFullyReconciled).toBe(false);
      expect(FIXTURE_RECONCILIATION_DISCREPANT_UNEXPECTED.counts.unexpected).toBe(1);

      // Treasury variance
      expect(FIXTURE_RECONCILIATION_TREASURY_VARIANCE_REPORT.isReconciled).toBe(false);
      expect(FIXTURE_RECONCILIATION_TREASURY_VARIANCE_REPORT.variance).toBe("2000000000");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Structured Scenario Collections & Helpers
  // ──────────────────────────────────────────────────────────────────────────
  describe("Scenario Collections & Query Helpers", () => {
    it("contains test scenarios for all 5 core domains", () => {
      const domains = new Set(DETERMINISTIC_SCENARIOS.map((s) => s.domain));
      expect(domains.has("batch")).toBe(true);
      expect(domains.has("employee")).toBe(true);
      expect(domains.has("transaction")).toBe(true);
      expect(domains.has("proof_reference")).toBe(true);
      expect(domains.has("reconciliation")).toBe(true);
    });

    it("filters scenarios by domain via getDeterministicScenariosByDomain", () => {
      const batchScenarios = getDeterministicScenariosByDomain("batch");
      expect(batchScenarios.length).toBeGreaterThan(0);
      expect(batchScenarios.every((s) => s.domain === "batch")).toBe(true);

      const empScenarios = getDeterministicScenariosByDomain("employee");
      expect(empScenarios.every((s) => s.domain === "employee")).toBe(true);
    });

    it("filters valid vs invalid scenarios via getValidScenarios and getInvalidScenarios", () => {
      const valid = getValidScenarios();
      expect(valid.every((s) => s.isValid)).toBe(true);

      const invalid = getInvalidScenarios();
      expect(invalid.every((s) => !s.isValid)).toBe(true);

      const validBatches = getValidScenarios("batch");
      expect(validBatches.every((s) => s.isValid && s.domain === "batch")).toBe(true);

      const invalidEmployees = getInvalidScenarios("employee");
      expect(invalidEmployees.every((s) => !s.isValid && s.domain === "employee")).toBe(true);
    });
  });
});
