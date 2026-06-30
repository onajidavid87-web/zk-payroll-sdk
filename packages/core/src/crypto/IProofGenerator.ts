import type { PayrollProgressCallback } from "../progress";

export interface IProofGenerator {
  generateProof(
    witness: Record<string, unknown>,
    onProgress?: PayrollProgressCallback
  ): Promise<ProofPayload>;
}

/** Status returned by preload() and getPreloadStatus(). */
export interface PreloadStatus {
  /** Whether the .wasm circuit file has been loaded into memory. */
  wasmLoaded: boolean;
  /** Whether the .zkey proving-key file has been loaded into memory. */
  zkeyLoaded: boolean;
  /** ISO timestamp of when preloading completed, if it has. */
  completedAt?: string;
}

/**
 * Extended interface for proof generators that support artifact preloading.
 * Preloading downloads and caches circuit artifacts before proof generation
 * is needed, eliminating first-run latency.
 */
export interface IPreloadableProofGenerator extends IProofGenerator {
  /**
   * Preloads circuit artifacts (.wasm and .zkey) into memory.
   * Subsequent calls to generateProof() reuse the cached artifacts.
   *
   * @returns Status indicating which artifacts were loaded.
   */
  preload(): Promise<PreloadStatus>;

  /** Returns the current preload status without triggering a download. */
  getPreloadStatus(): PreloadStatus;
}

/** Structured proof payload compatible with Solidity/Soroban verifiers. */
export interface ProofPayload {
  proof: {
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

/** Configuration for proof generation artifacts. */
export interface ProofGeneratorConfig {
  /**
   * URL or path to the circuit .wasm file.
   *
   * Accepts HTTP(S) URLs for remote fetching, or local filesystem paths
   * (absolute, relative, or `file://` URIs) for offline resolution.
   *
   * When {@link wasmSource} is set, this field is ignored.
   */
  wasmUrl: string;
  /**
   * URL or path to the proving key .zkey file.
   *
   * Accepts HTTP(S) URLs for remote fetching, or local filesystem paths
   * (absolute, relative, or `file://` URIs) for offline resolution.
   *
   * When {@link zkeySource} is set, this field is ignored.
   */
  zkeyUrl: string;
  /**
   * Typed artifact source for the .wasm file.
   * When set, this takes precedence over {@link wasmUrl}.
   *
   * @example
   * ```typescript
   * // Local file
   * wasmSource: { type: "local", path: "./circuits/payroll.wasm" }
   * // Remote URL
   * wasmSource: { type: "remote", url: "https://cdn.example.com/payroll.wasm" }
   * ```
   */
  wasmSource?: import("./IArtifactResolver").ArtifactSource;
  /**
   * Typed artifact source for the .zkey file.
   * When set, this takes precedence over {@link zkeyUrl}.
   *
   * @example
   * ```typescript
   * // Local file
   * zkeySource: { type: "local", path: "./circuits/payroll.zkey" }
   * // Remote URL
   * zkeySource: { type: "remote", url: "https://cdn.example.com/payroll.zkey" }
   * ```
   */
  zkeySource?: import("./IArtifactResolver").ArtifactSource;
  /** Optional cache TTL in seconds for downloaded artifacts */
  artifactCacheTTL?: number;
}
