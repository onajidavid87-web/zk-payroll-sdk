import { Keypair, Networks } from "@stellar/stellar-sdk";
import type { ISigner } from "./signer/types";
import { toISigner } from "./signer/KeypairSigner";
import { PayrollContractWrapper } from "./adapters/PayrollContractWrapper";
import { IProofGenerator, ProofPayload } from "./crypto/IProofGenerator";
import { PayrollError, PayrollServiceErrorCode } from "./errors";
import { PaymentParams, PaymentResult } from "./types";
import { SdkLogger } from "./logging/SdkLogger";
import { IdempotencyRegistry, createPaymentIdempotencyKey } from "./core/idempotency";
import { createPayrollProgressEvent } from "./progress";

export interface Transaction {
  amount: bigint;
  [key: string]: unknown;
}

export interface FilterCriteria {
  minAmount: bigint;
}

/**
 * PayrollService — API layer for private payroll payments.
 *
 * Orchestrates ZK proof generation and contract invocation through
 * injected dependencies (IProofGenerator and PayrollContractWrapper).
 *
 * Pass an SdkLogger to observe payment lifecycle events without patching internals.
 * Sensitive fields (recipient, amount, asset) are never written to the log.
 */
export class PayrollService {
  private readonly signer: ISigner;
  private readonly paymentIdempotency = new IdempotencyRegistry<PaymentResult>();

  constructor(
    private readonly contractWrapper: PayrollContractWrapper,
    private readonly proofGenerator: IProofGenerator,
    signer: Keypair | ISigner,
    private readonly network: string = Networks.TESTNET,
    private readonly logger?: SdkLogger
  ) {
    this.signer = toISigner(signer);
  }

  /**
   * Process a private payment by generating a ZK proof and submitting
   * the transaction to the Soroban contract.
   */
  async processPayment(params: PaymentParams): Promise<PaymentResult> {
    const explicitKey = params.idempotencyKey?.trim();
    if (!explicitKey) {
      return this.processPaymentInternal(params);
    }

    return this.paymentIdempotency.execute(explicitKey, async () => {
      return this.processPaymentInternal(params);
    });
  }

  /**
   * Build a deterministic idempotency key from payment data.
   */
  static createIdempotencyKey(
    params: Pick<PaymentParams, "recipient" | "amount" | "asset">
  ): string {
    return createPaymentIdempotencyKey(params);
  }

  private async processPaymentInternal(params: PaymentParams): Promise<PaymentResult> {
    const { recipient, amount, asset } = params;

    this.logger?.info("payment_start");

    // 1. Validate inputs
    params.onProgress?.(
      createPayrollProgressEvent({
        operation: "payment",
        stage: "validation",
        message: "validation_started",
        progress: 0,
      })
    );
    try {
      this.validatePaymentParams(params);
      params.onProgress?.(
        createPayrollProgressEvent({
          operation: "payment",
          stage: "validation",
          message: "validation_completed",
          progress: 100,
        })
      );
    } catch (error) {
      this.logger?.warn("payment_validation_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // 2. Generate ZK proof
    const witness: Record<string, unknown> = {
      recipient,
      amount: amount.toString(),
      asset,
    };

    let proof: ProofPayload;
    try {
      proof = await this.proofGenerator.generateProof(witness, params.onProgress);
    } catch (error) {
      if (error instanceof PayrollError) {
        throw error;
      }
      throw new PayrollError(
        `Proof generation failed: ${error instanceof Error ? error.message : String(error)}`,
        PayrollServiceErrorCode.PROOF_GENERATION_FAILED
      );
    }

    // 3. Invoke contract
    params.onProgress?.(
      createPayrollProgressEvent({
        operation: "payment",
        stage: "submission_preparing",
        message: "submission_preparing",
        progress: 0,
        metadata: { method: "private_pay" },
      })
    );
    this.logger?.info("contract_invocation_start", { method: "private_pay" });

    const resultXdr = await this.contractWrapper.privatePay(
      recipient,
      amount,
      asset,
      proof,
      this.signer,
      this.network,
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
    );

    params.onProgress?.(
      createPayrollProgressEvent({
        operation: "payment",
        stage: "submission_done",
        message: "submission_done",
        progress: 100,
        metadata: { method: "private_pay" },
      })
    );

    const result: PaymentResult = {
      txHash: resultXdr.toXDR("hex"),
      publicSignals: proof.publicSignals,
    };

    this.logger?.info("payment_complete", { txHash: result.txHash });

    return result;
  }

  filterTransactions(transactions: Transaction[], criteria: FilterCriteria): Transaction[] {
    return transactions.filter((t) => t.amount > criteria.minAmount);
  }

  private validatePaymentParams(params: PaymentParams): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PayrollValidation } = require("./core/validation");
    const result = PayrollValidation.validatePaymentParams(params);
    if (!result.isValid) {
      // Map to backward-compatible PayrollError
      const firstError = result.errors[0];
      let code = 0;
      if (firstError.field === "recipient") code = PayrollServiceErrorCode.INVALID_RECIPIENT;
      else if (firstError.field === "amount") code = PayrollServiceErrorCode.INVALID_AMOUNT;
      else if (firstError.field === "asset") code = PayrollServiceErrorCode.INVALID_ASSET;

      throw new PayrollError(firstError.message, code);
    }
  }
}
