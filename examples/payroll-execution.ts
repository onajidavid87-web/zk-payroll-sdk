/* eslint-disable no-console */
/**
 * Payroll Execution Example
 *
 * Demonstrates the complete flow of running a private payroll batch with the
 * ZK Payroll SDK:
 *
 *   1. Configure a ZK proof generator (real circuit or demo placeholder).
 *   2. Wire up PayrollService with a contract adapter and signing keypair.
 *   3. Process each employee's payment as a private ZK transaction.
 *   4. Report per-payment results and a summary.
 *
 * The example runs in "demo mode" when real circuit files are not present —
 * it uses a placeholder proof generator and a simulated contract so the
 * full orchestration logic can be exercised locally without a live network.
 *
 * Prerequisites
 * -------------
 * - Node.js 18+
 * - npm install  (run from repo root)
 *
 * Run
 * ---
 *   npx tsx examples/payroll-execution.ts
 *
 * Environment variables
 * -----------------------------------------------------------------------
 *   NETWORK_URL     Soroban RPC endpoint       (default: testnet URL)
 *   CONTRACT_ID     Deployed contract strkey   (required in production)
 *   EMPLOYER_SECRET Employer keypair secret    (required in production)
 *   WASM_URL        URL to the circuit .wasm   (required in production)
 *   ZKEY_URL        URL to the circuit .zkey   (required in production)
 */

import { Keypair, Networks, xdr, rpc } from "@stellar/stellar-sdk";
import {
  PayrollService,
  PayrollContractWrapper,
  SnarkjsProofGenerator,
  MemoryCacheProvider,
  ZkPayrollError,
  NetworkError,
  ContractExecutionError,
  ProofGenerationError,
  PayrollError,
  ValidationError,
} from "../packages/core/src";
import type { IProofGenerator, ProofPayload } from "../packages/core/src";
import type { PaymentParams, PaymentResult } from "../packages/core/src";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const NETWORK_URL =
  process.env.NETWORK_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.CONTRACT_ID ?? "";
const EMPLOYER_SECRET = process.env.EMPLOYER_SECRET ?? "";
const WASM_URL = process.env.WASM_URL ?? "";
const ZKEY_URL = process.env.ZKEY_URL ?? "";

/** True when all production environment variables are present. */
const PRODUCTION_MODE =
  CONTRACT_ID !== "" &&
  EMPLOYER_SECRET !== "" &&
  WASM_URL !== "" &&
  ZKEY_URL !== "";

// ---------------------------------------------------------------------------
// Payroll data
// ---------------------------------------------------------------------------

// In a real system this list would come from your HR or payroll database.
// Amounts are in stroops: 1 XLM = 10 000 000 stroops.
interface Employee {
  name: string;
  address: string;
  amountStroops: bigint;
  department: string;
}

const payrollBatch: Employee[] = [
  {
    name: "Alice Johnson",
    address: "GBPHKZTKNWWWVFQKKZV3MQSXD5MVVJQXMLSIVWFOFGV5RQXR7JVA6YD",
    amountStroops: 5_000_000_000n, // 500 XLM
    department: "Engineering",
  },
  {
    name: "Bob Martinez",
    address: "GCJLMWCKKEWQW5BSVQJYUBYUFJKXFBMMLRJMJQBHQVSYEOLMCXVS7FD5",
    amountStroops: 7_500_000_000n, // 750 XLM
    department: "Product",
  },
  {
    name: "Carol Chen",
    address: "GDZQHVCURMZ7O4AHAAXXYXVZQZ5YC4LYHPHPTLYUJNFAJZDLYQPFGPXZ",
    amountStroops: 3_000_000_000n, // 300 XLM
    department: "Design",
  },
];

// ---------------------------------------------------------------------------
// Demo infrastructure (replaced by real implementations in production)
// ---------------------------------------------------------------------------

/**
 * Placeholder proof generator for local demos.
 *
 * Returns a structurally valid but cryptographically empty proof — enough
 * to exercise the full PayrollService orchestration flow without real
 * circuit files.  In production, replace this with SnarkjsProofGenerator.
 */
const demoProofGenerator: IProofGenerator = {
  async generateProof(witness: Record<string, unknown>): Promise<ProofPayload> {
    // Simulate the time a real Groth16 proof takes (~1–3 s on typical hardware)
    await new Promise((r) => setTimeout(r, 80));
    return {
      proof: {
        pi_a: ["1", "2"],
        pi_b: [
          ["3", "4"],
          ["5", "6"],
        ],
        pi_c: ["7", "8"],
        protocol: "groth16",
        curve: "bn128",
      },
      // Public signals mirror the payment fields so the verifier can check them
      publicSignals: [
        String(witness["recipient"]),
        String(witness["amount"]),
        String(witness["asset"]),
      ],
    };
  },
};

/**
 * Simulated contract adapter for local demos.
 *
 * Duck-typed to match PayrollContractWrapper's interface without requiring
 * a live rpc.Server.  The `as unknown as PayrollContractWrapper` cast tells
 * TypeScript to treat it as the full wrapper class so PayrollService accepts it.
 *
 * In production, use a real PayrollContractWrapper instance instead.
 */
function createDemoContractWrapper(): PayrollContractWrapper {
  return {
    async privatePay(
      recipient: string,
      amount: bigint,
      asset: string,
      _proof: ProofPayload,
      _signer: Keypair,
      _network: string
    ): Promise<xdr.ScVal> {
      // Simulate network round-trip latency
      await new Promise((r) => setTimeout(r, 60));
      console.log(
        `    [demo contract] private_pay(${recipient.slice(0, 8)}…, ${formatXlm(amount)} ${asset})`
      );
      // Return void — PayrollService.processPayment converts this to a hex hash
      return xdr.ScVal.scvVoid();
    },
  } as unknown as PayrollContractWrapper;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatXlm(stroops: bigint): string {
  return `${(Number(stroops) / 10_000_000).toFixed(2)} XLM`;
}

function classifyError(error: unknown): string {
  if (error instanceof ValidationError) return `Validation: ${error.message} (field: ${error.field})`;
  if (error instanceof ProofGenerationError) return `Proof generation: ${error.message}`;
  if (error instanceof ContractExecutionError) return `Contract [${error.code}]: ${error.message}`;
  if (error instanceof NetworkError) return `Network: ${error.message}`;
  if (error instanceof PayrollError) return `SDK error (${error.code}): ${error.message}`;
  if (error instanceof ZkPayrollError) return `[${error.code}] ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

// ---------------------------------------------------------------------------
// Payroll execution
// ---------------------------------------------------------------------------

interface PayrollOutcome {
  employee: Employee;
  result?: PaymentResult;
  error?: string;
  durationMs: number;
}

async function executePayrollRun(): Promise<void> {
  console.log("━━━ ZK Payroll SDK — Payroll Execution ━━━\n");
  console.log(`Mode     : ${PRODUCTION_MODE ? "PRODUCTION" : "demo (set env vars to switch)"}`);
  console.log(`Network  : ${NETWORK_URL}`);
  console.log(`Contract : ${CONTRACT_ID || "(demo — null contract)"}`);
  console.log(`Employees: ${payrollBatch.length}`);

  // ── 1. Configure the ZK proof generator ─────────────────────────────────
  //
  // The proof generator downloads circuit artifacts (.wasm and .zkey) the
  // first time it runs, then caches them in memory to avoid repeated downloads
  // on subsequent payments in the same process.
  //
  // PRODUCTION: point to your compiled circuit files.
  //
  //   const proofGenerator = new SnarkjsProofGenerator(
  //     {
  //       wasmUrl: WASM_URL,
  //       zkeyUrl: ZKEY_URL,
  //       artifactCacheTTL: 86_400, // re-download artifacts at most once per day
  //     },
  //     new MemoryCacheProvider<string>() // proof cache — avoids duplicate work
  //   );
  //
  // DEMO: placeholder that exercises the full orchestration path.
  //
  const proofGenerator: IProofGenerator = PRODUCTION_MODE
    ? new SnarkjsProofGenerator(
        { wasmUrl: WASM_URL, zkeyUrl: ZKEY_URL, artifactCacheTTL: 86_400 },
        new MemoryCacheProvider<string>()
      )
    : demoProofGenerator;

  // ── 2. Wire up the contract adapter ────────────────────────────────────
  //
  // PayrollContractWrapper translates typed method calls into XDR-encoded
  // Soroban contract invocations, handles transaction assembly, signing,
  // submission, and polling for confirmation.
  //
  // PRODUCTION:
  //
  //   const rpcServer = new rpc.Server(NETWORK_URL);
  //   const contractWrapper = new PayrollContractWrapper(rpcServer, CONTRACT_ID);
  //
  const contractWrapper: PayrollContractWrapper = PRODUCTION_MODE
    ? new PayrollContractWrapper(new rpc.Server(NETWORK_URL), CONTRACT_ID)
    : createDemoContractWrapper();

  // ── 3. Resolve the signing keypair ──────────────────────────────────────
  //
  // The employer keypair authorises every transaction.  Keep the secret key
  // in an environment variable — never hard-code it in source.
  //
  const signer: Keypair = PRODUCTION_MODE
    ? Keypair.fromSecret(EMPLOYER_SECRET)
    : Keypair.random(); // ephemeral keypair for demo

  // ── 4. Initialise PayrollService ────────────────────────────────────────
  //
  // PayrollService.processPayment() orchestrates three steps automatically:
  //   a. Validate the payment parameters.
  //   b. Call proofGenerator.generateProof() with the payment witness.
  //   c. Call contractWrapper.privatePay() with the resulting proof.
  //
  const payrollService = new PayrollService(
    contractWrapper,
    proofGenerator,
    signer,
    Networks.TESTNET
  );

  // ── 5. Process each payment ─────────────────────────────────────────────

  console.log("\nProcessing payments…\n");

  const outcomes: PayrollOutcome[] = [];

  for (const employee of payrollBatch) {
    const params: PaymentParams = {
      recipient: employee.address,
      amount: employee.amountStroops,
      asset: "native", // "native" = XLM; use a contract address for custom tokens
    };

    const start = Date.now();

    try {
      console.log(
        `  → ${employee.name} (${employee.department}): ${formatXlm(employee.amountStroops)}`
      );

      const result = await payrollService.processPayment(params);

      const durationMs = Date.now() - start;

      console.log(`     ✓ tx: ${result.txHash.slice(0, 16)}…  (${durationMs} ms)`);

      outcomes.push({ employee, result, durationMs });
    } catch (error) {
      const durationMs = Date.now() - start;
      const msg = classifyError(error);

      console.error(`     ✗ ${msg}`);

      outcomes.push({ employee, error: msg, durationMs });

      // Continue processing the remaining employees rather than aborting the
      // entire run — one failed payment should not block others.
    }
  }

  // ── 6. Print summary ────────────────────────────────────────────────────

  const succeeded = outcomes.filter((o) => o.result !== undefined);
  const failed = outcomes.filter((o) => o.error !== undefined);
  const totalPaid = succeeded.reduce((sum, o) => sum + o.employee.amountStroops, 0n);

  console.log("\n━━━ Payroll Run Summary ━━━\n");
  console.log(`  Payments processed : ${outcomes.length}`);
  console.log(`  Succeeded          : ${succeeded.length}`);
  console.log(`  Failed             : ${failed.length}`);
  console.log(`  Total disbursed    : ${formatXlm(totalPaid)}`);

  if (failed.length > 0) {
    console.log("\n  Failed payments:");
    failed.forEach((o) => {
      console.log(`    • ${o.employee.name}: ${o.error}`);
    });
  }

  console.log(
    failed.length === 0
      ? "\n✓ Payroll run completed successfully.\n"
      : `\n⚠ Payroll run completed with ${failed.length} failure(s).\n`
  );

  // Exit with a non-zero code if any payment failed so CI pipelines can detect it.
  if (failed.length > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  try {
    await executePayrollRun();
  } catch (error) {
    // Top-level catch for unexpected / unrecoverable errors
    console.error("\nFatal error during payroll run:");
    console.error(classifyError(error));
    process.exit(1);
  }
}

main();
