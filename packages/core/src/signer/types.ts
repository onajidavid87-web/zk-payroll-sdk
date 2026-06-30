import { Transaction } from "@stellar/stellar-sdk";

/**
 * Abstract signer contract for Stellar transaction signing.
 *
 * `ISigner` decouples the act of signing a Stellar transaction from the
 * specific signing mechanism (private key, hardware wallet, browser
 * extension, cloud KMS, etc.).  The SDK consumes this interface for ALL
 * signing operations; concrete implementations supply the cryptographic
 * material without the SDK ever holding a raw secret.
 *
 * ## Security boundaries
 *
 * - **SDK responsibility**: building the unsigned transaction, submitting
 *   it to the network, and polling for confirmation.  The SDK never sees
 *   the raw secret key.
 * - **Signer responsibility**: providing the public key (for source-account
 *   lookup) and producing a cryptographic signature over the transaction.
 *   The signer may perform additional user-facing confirmation (e.g. a
 *   hardware-wallet "are you sure?" prompt or a browser-extension approval
 *   dialog) before returning the signed transaction.
 *
 * ## Browser signer expectations
 *
 * Browser wallet implementations (e.g. `WalletSigner`) should:
 * - Call `getPublicKey()` to request the user's Stellar address from the
 *   injected provider (Freighter, Albedo, Lobstr, etc.).
 * - Call `sign(tx)` to present the transaction to the user for approval
 *   in the wallet UI before returning the signed envelope.
 *
 * ## Backend signer expectations
 *
 * Backend / server implementations (e.g. `KeypairSigner`) should:
 * - Resolve the public key from the configured secret (environment
 *   variable, HSM, KMS).
 * - Sign without interactive confirmation (the calling application
 *   controls authorization).
 *
 * ## Extensibility
 *
 * Any object conforming to this interface can be used anywhere the SDK
 * accepts a signer.  Consumers can implement custom signers for:
 * - Cloud KMS (AWS KMS, GCP Cloud KMS, Azure Key Vault)
 * - Hardware security modules (HSM)
 * - Hardware wallets (Ledger via Stellar app)
 * - Threshold / multisig schemes
 * - Test / mock signers in integration test suites
 */
export interface ISigner {
  /**
   * Return the Stellar public key (G...) used as the transaction source
   * account.  This MAY prompt the user for approval in browser wallets.
   */
  getPublicKey(): Promise<string>;

  /**
   * Sign a Stellar transaction and return the signed transaction.
   *
   * The implementation should:
   * 1. Serialize the unsigned transaction envelope
   * 2. Produce a valid Ed25519 signature for the source account
   *    identified by `getPublicKey()`
   * 3. Attach the signature to the envelope
   * 4. Return the signed `Transaction` object
   *
   * The returned transaction is submitted directly to the Stellar RPC;
   * the SDK does not inspect or modify it further.
   *
   * @param tx - The unsigned (or partially signed) transaction
   * @returns A promise that resolves to the fully signed transaction
   */
  sign(tx: Transaction): Promise<Transaction>;
}
