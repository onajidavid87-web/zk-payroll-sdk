import { groth16 } from "snarkjs";
import { CacheProvider } from "../cache/CacheProvider";
import { PayrollError } from "../errors";
import {
  IPreloadableProofGenerator,
  ProofPayload,
  ProofGeneratorConfig,
  PreloadStatus,
} from "./IProofGenerator";
import { SdkLogger } from "../logging/SdkLogger";
import { IArtifactResolver, ArtifactSource } from "./IArtifactResolver";
import { LocalArtifactResolver } from "./LocalArtifactResolver";
import { RemoteArtifactResolver } from "./RemoteArtifactResolver";

/**
 * Determines whether a URL/path string should be treated as a local filesystem
 * reference rather than an HTTP URL.
 *
 * A value is considered local when it:
 *   - Starts with `/` or `./` or `../`  (Unix absolute / relative paths)
 *   - Starts with a Windows drive letter pattern like `C:\` or `D:/`
 *   - Uses the `file://` protocol
 *
 * @internal
 */
function isLocalPath(urlOrPath: string): boolean {
  const trimmed = urlOrPath.trim();
  if (trimmed.startsWith("file://")) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return true;
  // Windows drive letters: C:\ or C:/
  if (/^[a-zA-Z]:[/\\]/.test(trimmed)) return true;
  return false;
}

/**
 * Strips the `file://` protocol prefix from a path, if present.
 * @internal
 */
function normalizeFileUri(urlOrPath: string): string {
  const trimmed = urlOrPath.trim();
  if (trimmed.startsWith("file:///")) return trimmed.slice(8); // file:///C:/foo → C:/foo
  if (trimmed.startsWith("file://")) return trimmed.slice(7);
  return trimmed;
}

/**
 * Builds an {@link IArtifactResolver} from the proof generator configuration.
 *
 * Resolution priority:
 *   1. If explicit `wasmSource` / `zkeySource` are set, use those.
 *   2. Otherwise, auto-detect from the `wasmUrl` / `zkeyUrl` strings.
 *
 * @internal
 */
function buildResolver(config: ProofGeneratorConfig, logger?: SdkLogger): IArtifactResolver {
  const wasmSource: ArtifactSource = config.wasmSource ?? inferSource(config.wasmUrl);
  const zkeySource: ArtifactSource = config.zkeySource ?? inferSource(config.zkeyUrl);

  const wasmIsLocal = wasmSource.type === "local";
  const zkeyIsLocal = zkeySource.type === "local";

  // Both local
  if (wasmIsLocal && zkeyIsLocal) {
    return new LocalArtifactResolver(
      {
        wasmPath: (wasmSource as { type: "local"; path: string }).path,
        zkeyPath: (zkeySource as { type: "local"; path: string }).path,
      },
      logger
    );
  }

  // Both remote
  if (!wasmIsLocal && !zkeyIsLocal) {
    return new RemoteArtifactResolver(
      {
        wasmUrl: (wasmSource as { type: "remote"; url: string }).url,
        zkeyUrl: (zkeySource as { type: "remote"; url: string }).url,
      },
      logger
    );
  }

  // Mixed: resolve each independently and combine
  return {
    async resolve() {
      const localResolver = wasmIsLocal
        ? new LocalArtifactResolver(
            {
              wasmPath: (wasmSource as { type: "local"; path: string }).path,
              zkeyPath: (zkeySource as { type: "local"; path: string }).path,
            },
            logger
          )
        : null;

      const remoteResolver = !wasmIsLocal
        ? new RemoteArtifactResolver(
            {
              wasmUrl: (wasmSource as { type: "remote"; url: string }).url,
              zkeyUrl: (zkeySource as { type: "remote"; url: string }).url,
            },
            logger
          )
        : null;

      // For mixed, we resolve individually
      const wasmResult = wasmIsLocal
        ? new LocalArtifactResolver(
            {
              wasmPath: (wasmSource as { type: "local"; path: string }).path,
              zkeyPath: "placeholder.zkey", // won't be used
            },
            logger
          )
        : new RemoteArtifactResolver(
            {
              wasmUrl: (wasmSource as { type: "remote"; url: string }).url,
              zkeyUrl: "https://placeholder.invalid/placeholder.zkey",
            },
            logger
          );

      const zkeyResult = zkeyIsLocal
        ? new LocalArtifactResolver(
            {
              wasmPath: "placeholder.wasm",
              zkeyPath: (zkeySource as { type: "local"; path: string }).path,
            },
            logger
          )
        : new RemoteArtifactResolver(
            {
              wasmUrl: "https://placeholder.invalid/placeholder.wasm",
              zkeyUrl: (zkeySource as { type: "remote"; url: string }).url,
            },
            logger
          );

      const [wasmResolved, zkeyResolved] = await Promise.all([
        wasmResult.resolve(),
        zkeyResult.resolve(),
      ]);

      return { wasm: wasmResolved.wasm, zkey: zkeyResolved.zkey };
    },
  };
}

/**
 * Infers an {@link ArtifactSource} from a raw URL or path string.
 * @internal
 */
function inferSource(urlOrPath: string): ArtifactSource {
  if (isLocalPath(urlOrPath)) {
    return { type: "local", path: normalizeFileUri(urlOrPath) };
  }
  return { type: "remote", url: urlOrPath };
}

/**
 * Snarkjs-based implementation of IPreloadableProofGenerator.
 * Handles downloading circuit artifacts (.wasm, .zkey) and generating Groth16 proofs.
 *
 * Supports both remote (HTTP) and local (filesystem) artifact resolution.
 * The source is auto-detected from the `wasmUrl`/`zkeyUrl` strings, or can be
 * explicitly set via the `wasmSource`/`zkeySource` configuration options.
 *
 * **Remote resolution** (default for `http://` and `https://` URLs):
 * ```typescript
 * new SnarkjsProofGenerator({
 *   wasmUrl: "https://cdn.example.com/circuit.wasm",
 *   zkeyUrl: "https://cdn.example.com/circuit.zkey",
 * });
 * ```
 *
 * **Local resolution** (auto-detected for filesystem paths):
 * ```typescript
 * new SnarkjsProofGenerator({
 *   wasmUrl: "./circuits/payroll.wasm",
 *   zkeyUrl: "./circuits/payroll.zkey",
 * });
 * ```
 *
 * **Explicit typed sources** (most precise):
 * ```typescript
 * new SnarkjsProofGenerator({
 *   wasmUrl: "",
 *   zkeyUrl: "",
 *   wasmSource: { type: "local", path: "/opt/circuits/payroll.wasm" },
 *   zkeySource: { type: "local", path: "/opt/circuits/payroll.zkey" },
 * });
 * ```
 *
 * Pass an SdkLogger to observe proof generation and artifact lifecycle events.
 * Sensitive data (witness fields, amounts, recipients) is never logged.
 */
export class SnarkjsProofGenerator implements IPreloadableProofGenerator {
  private wasmCache?: ArrayBuffer;
  private zkeyCache?: Uint8Array;
  private preloadStatus: PreloadStatus = { wasmLoaded: false, zkeyLoaded: false };
  private readonly resolver: IArtifactResolver;

  constructor(
    private config: ProofGeneratorConfig,
    private cache?: CacheProvider<string>,
    private logger?: SdkLogger
  ) {
    this.resolver = buildResolver(config, logger);
  }

  async generateProof(witness: Record<string, unknown>): Promise<ProofPayload> {
    this.logger?.info("proof_generation_start", { wasmUrl: this.config.wasmUrl });

    try {
      if (this.cache) {
        const cacheKey = this.witnessKey(witness);
        const cached = await this.cache.get(cacheKey);
        if (cached !== null) {
          this.logger?.info("proof_cache_hit");
          return JSON.parse(cached);
        }
        this.logger?.info("proof_cache_miss");
      }

      const [wasm, zkey] = await Promise.all([this.fetchWasm(), this.fetchZkey()]);

      const { proof, publicSignals } = await groth16.fullProve(witness, wasm, zkey);

      const payload = this.formatProofPayload(proof, publicSignals);

      if (this.cache) {
        const cacheKey = this.witnessKey(witness);
        const ttl = this.config.artifactCacheTTL;
        await this.cache.set(cacheKey, JSON.stringify(payload), ttl);
      }

      this.logger?.info("proof_generation_complete");
      return payload;
    } catch (error) {
      this.logger?.error("proof_generation_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new PayrollError(
        `Proof generation failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Preloads the .wasm and .zkey circuit artifacts into memory so that
   * the first generateProof() call incurs no download latency.
   *
   * Reuses artifacts already cached from a previous preload or generateProof() call.
   */
  async preload(): Promise<PreloadStatus> {
    this.logger?.info("artifact_preload_start", {
      wasmUrl: this.config.wasmUrl,
      zkeyUrl: this.config.zkeyUrl,
    });

    await Promise.all([this.fetchWasm(), this.fetchZkey()]);

    this.preloadStatus = {
      wasmLoaded: true,
      zkeyLoaded: true,
      completedAt: new Date().toISOString(),
    };

    this.logger?.info("artifact_preload_complete");
    return this.preloadStatus;
  }

  /** Returns the current preload status without triggering any downloads. */
  getPreloadStatus(): PreloadStatus {
    return { ...this.preloadStatus };
  }

  private resolvePromise?: Promise<{ wasm: ArrayBuffer; zkey: Uint8Array }>;

  /**
   * Ensures a single resolver.resolve() call even when fetchWasm() and
   * fetchZkey() are invoked concurrently via Promise.all.
   */
  private ensureResolved(): Promise<{ wasm: ArrayBuffer; zkey: Uint8Array }> {
    if (this.wasmCache && this.zkeyCache) {
      return Promise.resolve({ wasm: this.wasmCache, zkey: this.zkeyCache });
    }
    if (!this.resolvePromise) {
      this.resolvePromise = this.resolver.resolve().then((resolved) => {
        this.wasmCache = resolved.wasm;
        this.zkeyCache = resolved.zkey;
        this.preloadStatus = { ...this.preloadStatus, wasmLoaded: true, zkeyLoaded: true };
        this.resolvePromise = undefined;
        return resolved;
      });
    }
    return this.resolvePromise;
  }

  private async fetchWasm(): Promise<ArrayBuffer> {
    if (this.wasmCache) {
      return this.wasmCache;
    }
    const resolved = await this.ensureResolved();
    return resolved.wasm;
  }

  private async fetchZkey(): Promise<Uint8Array> {
    if (this.zkeyCache) {
      return this.zkeyCache;
    }
    const resolved = await this.ensureResolved();
    return resolved.zkey;
  }

  private formatProofPayload(
    proof: {
      pi_a: string[];
      pi_b: string[][];
      pi_c: string[];
      protocol?: string;
      curve?: string;
    },
    publicSignals: string[]
  ): ProofPayload {
    return {
      proof: {
        pi_a: [proof.pi_a[0], proof.pi_a[1]],
        pi_b: [
          [proof.pi_b[0][1], proof.pi_b[0][0]],
          [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        pi_c: [proof.pi_c[0], proof.pi_c[1]],
        protocol: proof.protocol || "groth16",
        curve: proof.curve || "bn128",
      },
      publicSignals,
    };
  }

  private witnessKey(witness: Record<string, unknown>): string {
    return `proof:${JSON.stringify(witness, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )}`;
  }

  clearArtifactCache(): void {
    this.wasmCache = undefined;
    this.zkeyCache = undefined;
    this.resolvePromise = undefined;
    this.preloadStatus = { wasmLoaded: false, zkeyLoaded: false };
  }
}
