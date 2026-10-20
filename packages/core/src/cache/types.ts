/**
 * Cache use-case namespaces for distributed payroll services.
 *
 * These namespaces partition cache entries by concern to prevent key
 * collisions and allow targeted invalidation.  Each namespace maps to a
 * distinct category of cached data that a backend service may wish to
 * manage independently.
 *
 * | Namespace     | Typical cached data                                          |
 * |---------------|--------------------------------------------------------------|
 * | `ARTIFACT`    | Circuit artifacts (`.wasm`, `.zkey` files)                   |
 * | `STATUS`      | Transaction / execution status records                       |
 * | `DRAFT`       | Serialized payroll draft payloads                            |
 * | `PROOF`       | Generated ZK proof results                                   |
 * | `IDEMPOTENCY` | Idempotency keys and their associated outcomes               |
 */
export enum CacheNamespace {
  /** Proving circuit artifacts (`.wasm` binaries, `.zkey` proving keys). */
  ARTIFACT = "artifact",

  /** Transaction or execution status records. */
  STATUS = "status",

  /** Serialised payroll draft payloads (see {@link PayrollDraft}). */
  DRAFT = "draft",

  /** Cached ZK proof outputs (base64-encoded or JSON-serialised proofs). */
  PROOF = "proof",

  /** Idempotency keys and their associated operation results. */
  IDEMPOTENCY = "idempotency",

  /** Payroll configurations and employer-specific settings. */
  CONFIGURATION = "configuration",

  /** Cached payroll execution, batch, and cycle states. */
  PAYROLL = "payroll",

  /** Cached employee registry, eligibility, and destination states. */
  EMPLOYEE = "employee",

  /** Cached treasury balances, reservations, and checkpoint states. */
  TREASURY = "treasury",

  /** Cached contract state, configuration, and registry snapshots. */
  CONTRACT = "contract",
}

/**
 * Describes a single cached entry returned by administrative or scan
 * operations on a {@link ServerCacheAdapter}.
 *
 * @template T The type of the cached value (defaults to `string`).
 */
export interface CacheEntry<T = string> {
  /** The cache entry key (relative within its namespace). */
  key: string;
  /** The cached value. */
  value: T;
  /** The namespace the entry belongs to. */
  namespace: CacheNamespace;
  /** Absolute epoch‑millis expiration timestamp, or `null` if no TTL was set. */
  expiresAt: number | null;
  /** Absolute epoch‑millis timestamp when the entry was stored. */
  storedAt: number;
}

/**
 * Shorthand union of all namespace values for use in generic constraints.
 */
export type CacheNamespaceValue = `${CacheNamespace}`;

/**
 * Shape of a value suitable for the {@link CacheNamespace.STATUS} namespace.
 */
export interface StatusCacheValue {
  /** Current execution status. */
  status: "pending" | "confirmed" | "failed" | "unknown";
  /** Optional transaction hash when confirmed on-chain. */
  txHash?: string;
  /** Human-readable error description when the operation failed. */
  error?: string;
  /** Epoch‑millis timestamp of the last status update. */
  updatedAt: number;
}
