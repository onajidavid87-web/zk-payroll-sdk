import { rpc, xdr, nativeToScVal, Address, Keypair, Networks } from "@stellar/stellar-sdk";
import type { ISigner } from "../signer/types";
import { toISigner } from "../signer/KeypairSigner";
import { BaseContractWrapper } from "../adapters/BaseContractWrapper";
import {
  ClientOptions,
  ExecutePaymentRequest,
  SchedulePaymentRequest,
  ScheduledPayment,
} from "./types";

/**
 * Result returned after successfully submitting a payroll payment.
 */
export interface ExecutePaymentResponse {
  /**
   * Transaction hash of the submitted payment.
   */
  txHash: string;
}

export interface SchedulePaymentResponse {
  paymentId: bigint;
}

export class PaymentExecutorClient extends BaseContractWrapper {
  private readonly networkPassphrase: string;

  constructor(server: rpc.Server, contractId: string, options?: ClientOptions) {
    super(server, contractId);
    this.networkPassphrase = options?.networkPassphrase ?? Networks.TESTNET;
  }

  async execute(
    request: ExecutePaymentRequest,
    signer: Keypair | ISigner,
    network?: string
  ): Promise<ExecutePaymentResponse> {
    const args: xdr.ScVal[] = [
      new Address(request.recipient).toScVal(),
      nativeToScVal(request.amount, { type: "i128" }),
      new Address(request.asset).toScVal(),
      nativeToScVal(request.memo ?? "", { type: "string" }),
    ];

    const result = await this.invoke(
      "execute",
      args,
      toISigner(signer),
      network ?? this.networkPassphrase
    );
    return { txHash: this.scValToHex(result) };
  }

  async schedule(
    request: SchedulePaymentRequest,
    signer: Keypair | ISigner,
    network?: string
  ): Promise<SchedulePaymentResponse> {
    const args: xdr.ScVal[] = [
      new Address(request.recipient).toScVal(),
      nativeToScVal(request.amount, { type: "i128" }),
      new Address(request.asset).toScVal(),
      nativeToScVal(request.executeAt, { type: "u64" }),
      nativeToScVal(request.memo ?? "", { type: "string" }),
    ];

    const result = await this.invoke(
      "schedule",
      args,
      toISigner(signer),
      network ?? this.networkPassphrase
    );
    return { paymentId: this.scValToBigInt(result) };
  }

  async cancel(paymentId: bigint, signer: Keypair, network?: string): Promise<void> {
    const args: xdr.ScVal[] = [nativeToScVal(paymentId, { type: "u64" })];
    await this.invoke("cancel", args, toISigner(signer), network ?? this.networkPassphrase);
  }

  async getScheduledPayment(
    paymentId: bigint,
    signer: Keypair | ISigner,
    network?: string
  ): Promise<ScheduledPayment> {
    const args: xdr.ScVal[] = [nativeToScVal(paymentId, { type: "u64" })];
    const result = await this.invoke(
      "get_scheduled_payment",
      args,
      toISigner(signer),
      network ?? this.networkPassphrase
    );
    return this.decodeScheduledPayment(result);
  }

  async getPendingPayments(
    employer: string,
    start: bigint,
    limit: number,
    signer: Keypair | ISigner,
    network?: string
  ): Promise<ScheduledPayment[]> {
    const args: xdr.ScVal[] = [
      new Address(employer).toScVal(),
      nativeToScVal(start, { type: "u64" }),
      nativeToScVal(limit, { type: "u32" }),
    ];

    const result = await this.invoke(
      "get_pending_payments",
      args,
      toISigner(signer),
      network ?? this.networkPassphrase
    );
    return this.decodeScheduledPaymentVec(result);
  }

  async getPaymentCount(employer: string, signer: Keypair, network?: string): Promise<number> {
    const args: xdr.ScVal[] = [new Address(employer).toScVal()];
    const result = await this.invoke(
      "get_payment_count",
      args,
      toISigner(signer),
      network ?? this.networkPassphrase
    );
    return Number(result.u32());
  }

  private decodeScheduledPayment(scVal: xdr.ScVal): ScheduledPayment {
    const map = scVal.map();
    if (!map) {
      throw new Error("Expected scvMap for ScheduledPayment");
    }

    const entries: Record<string, xdr.ScVal> = {};
    for (const entry of map) {
      const key = entry.key().sym()?.toString() ?? "";
      entries[key] = entry.val();
    }

    return {
      id: this.scValToBigInt(entries.id),
      employer: Address.fromScVal(entries.employer).toString(),
      recipient: Address.fromScVal(entries.recipient).toString(),
      amount: this.scValToBigInt(entries.amount),
      asset: Address.fromScVal(entries.asset).toString(),
      executeAt: Number(this.scValToBigInt(entries.execute_at)),
      memo: entries.memo?.str()?.toString() ?? "",
      executed: entries.executed?.b() ?? false,
      cancelled: entries.cancelled?.b() ?? false,
      createdAt: Number(this.scValToBigInt(entries.created_at)),
    };
  }

  private decodeScheduledPaymentVec(scVal: xdr.ScVal): ScheduledPayment[] {
    const vec = scVal.vec();
    if (!vec) return [];
    return vec.map((v) => this.decodeScheduledPayment(v));
  }

  private scValToHex(scVal: xdr.ScVal): string {
    const bytes = scVal.bytes();
    if (bytes) return Buffer.from(bytes).toString("hex");
    const str = scVal.str();
    if (str) return str.toString();
    return "";
  }

  private scValToBigInt(scVal: xdr.ScVal): bigint {
    const swName = scVal.switch().name;
    if (swName === "scvI128") {
      const i128 = scVal.i128();
      const hi = BigInt(i128.hi().toString());
      const lo = BigInt(i128.lo().toString());
      return (hi << 64n) | lo;
    }
    if (swName === "scvU64") {
      const u64 = scVal.u64();
      return BigInt(u64.toString());
    }
    return 0n;
  }
}
