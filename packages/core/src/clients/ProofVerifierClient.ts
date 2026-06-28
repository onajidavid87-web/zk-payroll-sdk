import { rpc, xdr, nativeToScVal, Keypair, Networks } from "@stellar/stellar-sdk";
import { BaseContractWrapper } from "../adapters/BaseContractWrapper";
import { ClientOptions, ProofStruct, VerificationKeyInfo } from "./types";

export class ProofVerifierClient extends BaseContractWrapper {
  private readonly networkPassphrase: string;

  constructor(
    server: rpc.Server,
    contractId: string,
    options?: ClientOptions
  ) {
    super(server, contractId);
    this.networkPassphrase = options?.networkPassphrase ?? Networks.TESTNET;
  }

  async verify(
    proof: ProofStruct,
    publicInputs: string[],
    verificationKeyId: number,
    signer: Keypair,
    network?: string
  ): Promise<boolean> {
    const args: xdr.ScVal[] = [
      this.encodeProofStruct(proof),
      xdr.ScVal.scvVec(
        publicInputs.map((s) => {
          const buf = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0 ? Buffer.from(s, "hex") : Buffer.from(s, "utf-8");
          return nativeToScVal(buf, { type: "bytes" });
        })
      ),
      nativeToScVal(verificationKeyId, { type: "u32" }),
    ];

    const result = await this.invoke("verify", args, signer, network ?? this.networkPassphrase);
    return result.b() === true;
  }

  async addVerificationKey(
    vk: string,
    description: string,
    signer: Keypair,
    network?: string
  ): Promise<number> {
    const vkBuf = /^[0-9a-fA-F]+$/.test(vk) && vk.length % 2 === 0 ? Buffer.from(vk, "hex") : Buffer.from(vk, "utf-8");
    const args: xdr.ScVal[] = [
      nativeToScVal(vkBuf, { type: "bytes" }),
      nativeToScVal(description, { type: "string" }),
    ];

    const result = await this.invoke("add_verification_key", args, signer, network ?? this.networkPassphrase);
    return Number(result.u32());
  }

  async getVerificationKey(
    id: number,
    signer: Keypair,
    network?: string
  ): Promise<string> {
    const args: xdr.ScVal[] = [nativeToScVal(id, { type: "u32" })];
    const result = await this.invoke("get_verification_key", args, signer, network ?? this.networkPassphrase);
    const bytes = result.bytes();
    return bytes ? Buffer.from(bytes).toString("hex") : "";
  }

  async setActiveVerificationKey(
    id: number,
    signer: Keypair,
    network?: string
  ): Promise<void> {
    const args: xdr.ScVal[] = [nativeToScVal(id, { type: "u32" })];
    await this.invoke("set_active_verification_key", args, signer, network ?? this.networkPassphrase);
  }

  async getActiveVerificationKeyId(
    signer: Keypair,
    network?: string
  ): Promise<number> {
    const result = await this.invoke("get_active_verification_key_id", [], signer, network ?? this.networkPassphrase);
    return Number(result.u32());
  }

  async getVerificationKeyCount(
    signer: Keypair,
    network?: string
  ): Promise<number> {
    const result = await this.invoke("get_verification_key_count", [], signer, network ?? this.networkPassphrase);
    return Number(result.u32());
  }

  async getVerificationKeyInfo(
    id: number,
    signer: Keypair,
    network?: string
  ): Promise<VerificationKeyInfo> {
    const args: xdr.ScVal[] = [nativeToScVal(id, { type: "u32" })];
    const result = await this.invoke("get_verification_key_info", args, signer, network ?? this.networkPassphrase);
    return this.decodeVerificationKeyInfo(result);
  }

  private encodeProofStruct(proof: ProofStruct): xdr.ScVal {
    const piA = xdr.ScVal.scvVec(
      proof.pi_a.map((s) => nativeToScVal(s, { type: "string" }))
    );
    const piB = xdr.ScVal.scvVec(
      proof.pi_b.map((pair) =>
        xdr.ScVal.scvVec(pair.map((s) => nativeToScVal(s, { type: "string" })))
      )
    );
    const piC = xdr.ScVal.scvVec(
      proof.pi_c.map((s) => nativeToScVal(s, { type: "string" }))
    );
    const publicSignals = xdr.ScVal.scvVec(
      proof.publicSignals.map((s) => nativeToScVal(s, { type: "string" }))
    );

    return xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: nativeToScVal("pi_a", { type: "symbol" }),
        val: piA,
      }),
      new xdr.ScMapEntry({
        key: nativeToScVal("pi_b", { type: "symbol" }),
        val: piB,
      }),
      new xdr.ScMapEntry({
        key: nativeToScVal("pi_c", { type: "symbol" }),
        val: piC,
      }),
      new xdr.ScMapEntry({
        key: nativeToScVal("public_signals", { type: "symbol" }),
        val: publicSignals,
      }),
    ]);
  }

  private decodeVerificationKeyInfo(scVal: xdr.ScVal): VerificationKeyInfo {
    const map = scVal.map();
    if (!map) {
      throw new Error("Expected scvMap for VerificationKeyInfo");
    }

    const entries: Record<string, xdr.ScVal> = {};
    for (const entry of map) {
      const key = entry.key().sym()?.toString() ?? "";
      entries[key] = entry.val();
    }

    const vkBytes = entries.key?.bytes();
    return {
      id: Number(entries.id?.u32() ?? 0),
      description: entries.description?.str()?.toString() ?? "",
      key: vkBytes ? Buffer.from(vkBytes).toString("hex") : "",
    };
  }
}
