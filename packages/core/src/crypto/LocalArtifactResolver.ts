/**
 * Local (file-system) artifact resolver for air-gapped and offline development.
 *
 * ## When to use local resolution
 *
 * Use `LocalArtifactResolver` when:
 *   - Running in an **air-gapped** or network-restricted environment.
 *   - You want deterministic, version-pinned artifacts checked into source control.
 *   - **CI pipelines** where artifacts are produced by an earlier build step and
 *     stored on the runner's filesystem rather than fetched from a CDN.
 *   - **Local development** where you compile circuits with `circom` and want to
 *     immediately test proofs without uploading artifacts anywhere.
 *
 * ## Setting up an offline workflow
 *
 * 1. Compile your circuit:
 *    ```bash
 *    circom payroll.circom --wasm --r1cs -o ./circuits/
 *    snarkjs groth16 setup circuits/payroll.r1cs pot_final.ptau circuits/payroll.zkey
 *    ```
 * 2. Reference the local paths in your SDK configuration:
 *    ```typescript
 *    import { SnarkjsProofGenerator } from "@zk-payroll/core";
 *
 *    const generator = new SnarkjsProofGenerator({
 *      wasmUrl: "./circuits/payroll_js/payroll.wasm",
 *      zkeyUrl: "./circuits/payroll.zkey",
 *    });
 *    ```
 * 3. No network access required — the resolver reads directly from disk.
 *
 * ## Validation
 *
 * Before reading file contents, the resolver checks:
 *   - **Existence**: throws {@link ArtifactNotFoundError} if the file is missing.
 *   - **Readability**: throws {@link ArtifactAccessError} on permission errors.
 *   - **Extension**: throws {@link ArtifactCorruptError} if the extension doesn't match.
 *   - **Non-empty**: throws {@link ArtifactCorruptError} for zero-byte files.
 *
 * @module
 */

import * as fs from "fs";
import * as path from "path";
import { IArtifactResolver, ResolvedArtifacts } from "./IArtifactResolver";
import {
  ArtifactNotFoundError,
  ArtifactAccessError,
  ArtifactCorruptError,
} from "./ArtifactErrors";
import { SdkLogger } from "../logging/SdkLogger";

/**
 * Configuration for the local artifact resolver.
 */
export interface LocalArtifactResolverConfig {
  /** Absolute or relative path to the circuit .wasm file. */
  wasmPath: string;
  /** Absolute or relative path to the proving key .zkey file. */
  zkeyPath: string;
}

/**
 * Resolves circuit artifacts from the local filesystem.
 *
 * Performs validation (existence, permissions, extension, non-empty) before
 * returning file contents. All failures produce specific, actionable error
 * subclasses from `ArtifactErrors`.
 *
 * @example
 * ```typescript
 * const resolver = new LocalArtifactResolver({
 *   wasmPath: "./circuits/payroll.wasm",
 *   zkeyPath: "./circuits/payroll.zkey",
 * });
 *
 * const { wasm, zkey } = await resolver.resolve();
 * ```
 */
export class LocalArtifactResolver implements IArtifactResolver {
  private readonly wasmPath: string;
  private readonly zkeyPath: string;

  constructor(
    config: LocalArtifactResolverConfig,
    private readonly logger?: SdkLogger
  ) {
    this.wasmPath = path.resolve(config.wasmPath);
    this.zkeyPath = path.resolve(config.zkeyPath);
  }

  /**
   * Reads and validates both circuit artifact files from disk.
   *
   * @returns Resolved wasm and zkey binary content.
   * @throws {ArtifactNotFoundError} If either file does not exist.
   * @throws {ArtifactAccessError}   If either file cannot be read.
   * @throws {ArtifactCorruptError}  If either file is empty or has a wrong extension.
   */
  async resolve(): Promise<ResolvedArtifacts> {
    this.logger?.info("artifact_load_start", {
      wasmPath: this.wasmPath,
      zkeyPath: this.zkeyPath,
      source: "local",
    });

    const [wasm, zkey] = await Promise.all([
      this.loadFile(this.wasmPath, "wasm"),
      this.loadFile(this.zkeyPath, "zkey"),
    ]);

    this.logger?.info("artifact_load_complete", { source: "local" });

    // Copy into a plain ArrayBuffer to satisfy the ResolvedArtifacts type
    // (Uint8Array.buffer may be SharedArrayBuffer under strict TS targets).
    const wasmBuffer = new ArrayBuffer(wasm.byteLength);
    new Uint8Array(wasmBuffer).set(wasm);

    return {
      wasm: wasmBuffer,
      zkey,
    };
  }

  /**
   * Loads and validates a single artifact file.
   */
  private async loadFile(
    filePath: string,
    artifactType: "wasm" | "zkey"
  ): Promise<Uint8Array> {
    // 1. Validate extension
    const ext = path.extname(filePath).toLowerCase();
    const expectedExt = `.${artifactType}`;
    if (ext !== expectedExt) {
      throw new ArtifactCorruptError(
        filePath,
        artifactType,
        `Expected a "${expectedExt}" file but got "${ext || "(no extension)"}".`
      );
    }

    // 2. Check existence and readability
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (err: unknown) {
      const nodeError = err as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new ArtifactNotFoundError(filePath, artifactType);
      }
      if (nodeError.code === "EACCES" || nodeError.code === "EPERM") {
        throw new ArtifactAccessError(
          filePath,
          artifactType,
          `Permission denied. Run "chmod +r ${filePath}" or check ownership.`
        );
      }
      // Re-throw unexpected errors
      throw new ArtifactAccessError(
        filePath,
        artifactType,
        nodeError.message
      );
    }

    // 3. Read file
    const buffer = await fs.promises.readFile(filePath);

    // 4. Validate non-empty
    if (buffer.byteLength === 0) {
      throw new ArtifactCorruptError(
        filePath,
        artifactType,
        "The file is empty (0 bytes). Ensure the circuit has been compiled correctly."
      );
    }

    return new Uint8Array(buffer);
  }
}
