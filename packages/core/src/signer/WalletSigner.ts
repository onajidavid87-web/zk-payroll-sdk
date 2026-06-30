import { Transaction, TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import type { ISigner } from "./types";

/**
 * Configuration for `WalletSigner`.
 */
export interface WalletSignerOptions {
  /**
   * Stellar network passphrase used to deserialize the signed transaction
   * XDR returned by the wallet.  Defaults to `Networks.TESTNET`.
   */
  networkPassphrase?: string;
}

/**
 * Signer implementation for browser-based wallets (Freighter, Albedo,
 * Lobstr, etc.) that expose signing capabilities via `window` globals
 * or injected providers.
 *
 * The caller provides two factory functions — one to retrieve the user's
 * public key, and one to sign a transaction XDR string.  This keeps the
 * SDK agnostic about which specific wallet is in use.
 *
 * @example
 * ```typescript
 * // Freighter wallet integration
 * const signer = new WalletSigner(
 *   () => window.freighter.getPublicKey(),
 *   (txXdr) => window.freighter.signTransaction(txXdr),
 *   { networkPassphrase: Networks.PUBLIC },
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Albedo wallet integration
 * const signer = new WalletSigner(
 *   () => window.albedo.publicKey().then(r => r.publicKey),
 *   (txXdr) => window.albedo.tx({ xdr: txXdr }).then(r => r.signedXdr),
 * );
 * ```
 */
export class WalletSigner implements ISigner {
  private readonly networkPassphrase: string;

  constructor(
    private readonly getPublicKeyFn: () => Promise<string>,
    private readonly signTxFn: (txXdr: string) => Promise<string>,
    options?: WalletSignerOptions
  ) {
    this.networkPassphrase = options?.networkPassphrase ?? Networks.TESTNET;
  }

  async getPublicKey(): Promise<string> {
    return this.getPublicKeyFn();
  }

  async sign(tx: Transaction): Promise<Transaction> {
    const txXdr = tx.toXDR();
    const signedXdr = await this.signTxFn(txXdr);
    const result = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    return result as Transaction;
  }
}
