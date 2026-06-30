import { Keypair, Transaction } from "@stellar/stellar-sdk";
import type { ISigner } from "./types";

/**
 * Signer implementation that wraps a Stellar SDK `Keypair`.
 *
 * Intended for backend / server-side use where the secret key is available
 * as a `Keypair` instance (loaded from a seed, secret, or environment
 * variable).  This is the zero-overhead adapter that preserves backward
 * compatibility with existing code that constructs `Keypair` objects.
 *
 * @example
 * ```typescript
 * const kp = Keypair.fromSecret("S…");
 * const signer = new KeypairSigner(kp);
 * ```
 */
export class KeypairSigner implements ISigner {
  constructor(private readonly keypair: Keypair) {}

  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey();
  }

  async sign(tx: Transaction): Promise<Transaction> {
    tx.sign(this.keypair);
    return tx;
  }
}

/**
 * Type guard that returns `true` when the given value conforms to `ISigner`.
 * Useful for normalizing `Keypair | ISigner` union types at API boundaries.
 */
export function isISigner(s: unknown): s is ISigner {
  return (
    typeof s === "object" &&
    s !== null &&
    "getPublicKey" in s &&
    typeof (s as ISigner).getPublicKey === "function" &&
    "sign" in s &&
    typeof (s as ISigner).sign === "function"
  );
}

/**
 * Normalize a `Keypair | ISigner` union to an `ISigner`.
 *
 * When a raw `Keypair` is passed (legacy usage), it is wrapped in a
 * `KeypairSigner` so that internal callers always work with `ISigner`.
 */
export function toISigner(signer: Keypair | ISigner): ISigner {
  if (isISigner(signer)) return signer;
  return new KeypairSigner(signer);
}
