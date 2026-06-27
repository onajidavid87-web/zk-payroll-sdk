/* eslint-disable no-console */
/**
 * Employee Onboarding Example
 *
 * Demonstrates the complete flow of onboarding a new employee to the ZK Payroll
 * system: verifying the account does not already exist, funding the payroll
 * account with an initial allocation, and confirming the deposit was recorded.
 *
 * The example runs against the SDK's built-in mock environment so it works
 * out of the box without a live Stellar node.  Switch to the real wiring
 * (marked with "PRODUCTION") once you have a deployed contract.
 *
 * Prerequisites
 * -------------
 * - Node.js 18+
 * - npm install  (run from repo root)
 *
 * Run
 * ---
 *   npx tsx examples/employee-onboarding.ts
 *
 * Environment variables (optional — defaults to demo values when absent)
 * -----------------------------------------------------------------------
 *   NETWORK_URL       Soroban RPC endpoint  (default: testnet)
 *   CONTRACT_ID       Deployed contract strkey (C...)
 *   ADMIN_SECRET      Admin keypair secret used to sign transactions
 *   EMPLOYEE_ADDRESS  Employee Stellar public key (G...)
 */

import {
  MockContractEnvironment,
  MockPayrollContract,
  PayrollError,
  ZkPayrollError,
  ValidationError,
} from "../packages/core/src";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const NETWORK_URL =
  process.env.NETWORK_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.CONTRACT_ID ?? ""; // fill in for a real run

// Demo employee — replace with data from your HR system
const employee = {
  name: "Alice Johnson",
  // A valid Stellar public key (G...) is required in production
  address:
    process.env.EMPLOYEE_ADDRESS ??
    "GBPHKZTKNWWWVFQKKZV3MQSXD5MVVJQXMLSIVWFOFGV5RQXR7JVA6YD",
  // 500 XLM expressed in stroops (1 XLM = 10 000 000 stroops)
  initialAllocationStroops: 5_000_000_000n,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a stroops bigint as a human-readable XLM amount. */
function formatXlm(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toFixed(2)} XLM`;
}

/** Returns an action label so logs read as "[step N/3]". */
function step(n: number, total: number, label: string): void {
  console.log(`\n[${n}/${total}] ${label}`);
}

// ---------------------------------------------------------------------------
// Onboarding function
// ---------------------------------------------------------------------------

async function onboardEmployee(): Promise<void> {
  console.log("━━━ ZK Payroll SDK — Employee Onboarding ━━━\n");
  console.log(`Employee : ${employee.name}`);
  console.log(`Address  : ${employee.address}`);
  console.log(`Network  : ${NETWORK_URL}`);
  console.log(`Contract : ${CONTRACT_ID || "(demo — no contract configured)"}`);

  // ── SDK setup ────────────────────────────────────────────────────────────
  //
  // PRODUCTION: connect to a real Soroban RPC server and your deployed contract.
  //
  //   import { rpc } from "@stellar/stellar-sdk";
  //   import { PayrollContractWrapper, PayrollContract } from "@zk-payroll/core";
  //
  //   const rpcServer = new rpc.Server(NETWORK_URL);
  //   const contractWrapper = new PayrollContractWrapper(rpcServer, CONTRACT_ID);
  //   const contract = new PayrollContract({ networkUrl: NETWORK_URL, contractId: CONTRACT_ID });
  //
  // DEMO: the mock environment intercepts every call so no network is needed.
  //
  const mockEnv = new MockContractEnvironment();
  const contract = new MockPayrollContract(mockEnv);

  // ── Step 1: check for an existing payroll account ────────────────────────

  step(1, 3, "Checking for existing payroll account");

  // Configure what the contract should return for this employee.
  // In production the real contract looks up on-chain state.
  mockEnv.expectInvoke("getBalance").toReturn(0n);

  const existingBalance = await contract.getBalance(employee.address);

  if (existingBalance > 0n) {
    // Idempotency guard: if the employee is already funded, skip onboarding
    // rather than double-depositing.
    console.log(
      `  Employee already has a balance of ${formatXlm(existingBalance)}.`
    );
    console.log("  Nothing to do — onboarding skipped.");
    return;
  }

  console.log("  No existing balance found. Starting onboarding.");

  // ── Step 2: deposit the initial allocation ───────────────────────────────

  step(2, 3, `Depositing initial allocation: ${formatXlm(employee.initialAllocationStroops)}`);

  // Reset the mock so the next expectation is clean.
  mockEnv.reset();
  mockEnv
    .expectInvoke("deposit")
    .toReturn("tx_onboard_abc123ef456");

  // PRODUCTION: the real deposit call signs a Stellar transaction via the
  //             PayrollContractWrapper and returns the transaction hash.
  const txHash = await contract.deposit(employee.initialAllocationStroops);

  console.log(`  Transaction submitted: ${txHash}`);

  // ── Step 3: verify the deposit is reflected in the balance ───────────────

  step(3, 3, "Verifying deposit on-chain");

  mockEnv.reset();
  mockEnv
    .expectInvoke("getBalance")
    .toReturn(employee.initialAllocationStroops);

  const confirmedBalance = await contract.getBalance(employee.address);

  if (confirmedBalance !== employee.initialAllocationStroops) {
    // The balance does not match — this should not happen in production unless
    // there is a race condition or the contract applies fees.
    throw new ZkPayrollError(
      `Balance mismatch after deposit: expected ${employee.initialAllocationStroops}, ` +
        `got ${confirmedBalance}`,
      "ONBOARDING_BALANCE_MISMATCH"
    );
  }

  console.log(`  Confirmed balance: ${formatXlm(confirmedBalance)}`);

  // ── Done ─────────────────────────────────────────────────────────────────

  console.log(
    `\n✓ ${employee.name} successfully onboarded to ZK Payroll.`
  );
  console.log(
    `  They will now receive private payments via PayrollService.processPayment().`
  );
  console.log(`  See examples/payroll-execution.ts for the payment flow.\n`);
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  try {
    await onboardEmployee();
  } catch (error) {
    if (error instanceof ValidationError) {
      // Input problems the caller can fix (bad address format, negative amount, etc.)
      console.error(`\nValidation error on field "${error.field}": ${error.message}`);
      process.exit(1);
    }

    if (error instanceof PayrollError) {
      // Legacy SDK error — code is a number in this branch
      console.error(`\nSDK error (code ${error.code}): ${error.message}`);
      process.exit(1);
    }

    if (error instanceof ZkPayrollError) {
      // All other typed SDK errors (NetworkError, ContractExecutionError, etc.)
      console.error(`\n[${error.code}] ${error.message}`);
      if (Object.keys(error.context ?? {}).length) {
        console.error("Context:", JSON.stringify(error.context, null, 2));
      }
      process.exit(1);
    }

    // Unexpected / untyped errors
    console.error("\nUnexpected error:", error);
    process.exit(1);
  }
}

main();
