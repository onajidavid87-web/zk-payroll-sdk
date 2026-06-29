# Backend Worker Quickstart

This quickstart shows how to build a small internal payroll automation worker on top of the SDK. The example focuses on the common backend pattern: poll pending jobs, process them with the SDK, retry transient failures, and emit structured events for observability.

## What you will build

A TypeScript worker that:

1. Validates the runtime configuration before it starts processing.
2. Polls a queue or database for pending payroll jobs.
3. Calls the SDK to generate a proof and submit the payment.
4. Retries transient failures with backoff.
5. Emits structured events that can be forwarded to logs, metrics, or Sentry.

## 1. Install and set up the SDK

```bash
npm install @zk-payroll/sdk @stellar/stellar-sdk
```

Create a worker entrypoint such as `src/payroll-worker.ts`.

```ts
import { Keypair, Networks, rpc } from "@stellar/stellar-sdk";
import {
  createHookLogger,
  DEFAULT_CONFIG,
  PayrollContractWrapper,
  PayrollService,
  SnarkjsProofGenerator,
  validateEnvironment,
} from "@zk-payroll/sdk";

const rpcUrl = process.env.RPC_URL ?? DEFAULT_CONFIG.networkUrl;
const contractId = process.env.CONTRACT_ID ?? DEFAULT_CONFIG.contractId;
const wasmUrl = process.env.WASM_URL!;
const zkeyUrl = process.env.ZKEY_URL!;
const signerSecret = process.env.SIGNER_SECRET!;

const logger = createHookLogger((entry) => {
  console.log(JSON.stringify(entry));
});

const server = new rpc.Server(rpcUrl);
const contractWrapper = new PayrollContractWrapper(server, contractId);
const proofGenerator = new SnarkjsProofGenerator({ wasmUrl, zkeyUrl });
const signer = Keypair.fromSecret(signerSecret);

export const payrollService = new PayrollService(
  contractWrapper,
  proofGenerator,
  signer,
  Networks.TESTNET,
  logger
);
```

## 2. Validate the environment before processing

Use the SDK sanity checker before you start your worker loop so that configuration issues surface immediately.

```ts
const sanity = await validateEnvironment(
  {
    networkUrl: rpcUrl,
    contractId,
  },
  {
    wasmUrl,
    zkeyUrl,
  }
);

if (!sanity.isValid) {
  for (const diagnostic of sanity.diagnostics) {
    console.error(`[${diagnostic.component}] ${diagnostic.status}: ${diagnostic.message}`);
  }
  process.exit(1);
}
```

## 3. Poll pending jobs

A worker normally reads jobs from a queue, database table, or API endpoint. The SDK itself does not provide a queue abstraction; your worker should own that integration.

```ts
interface PendingJob {
  id: string;
  recipient: string;
  amount: bigint;
  asset: string;
}

async function fetchPendingJobs(): Promise<PendingJob[]> {
  // Replace this with your own queue or database fetch.
  return [];
}
```

A simple polling loop looks like this:

```ts
async function runLoop(): Promise<void> {
  while (true) {
    const jobs = await fetchPendingJobs();

    for (const job of jobs) {
      await processJob(job);
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}
```

## 4. Process each job with retries

The SDK method `PayrollService.processPayment()` handles proof generation and the contract submission flow. Wrap that call in a retry loop so that transient failures do not permanently fail a job.

```ts
async function processJob(job: PendingJob): Promise<void> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await payrollService.processPayment({
        recipient: job.recipient,
        amount: job.amount,
        asset: job.asset,
      });

      console.log(`job ${job.id} completed`, result.txHash);
      return;
    } catch (error) {
      const shouldRetry = attempt < maxAttempts && isTransientFailure(error);
      if (!shouldRetry) {
        console.error(`job ${job.id} failed permanently`, error);
        return;
      }

      const backoffMs = 2 ** (attempt - 1) * 1_000;
      console.warn(`job ${job.id} failed on attempt ${attempt}; retrying in ${backoffMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

function isTransientFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network|rpc|temporar/i.test(message);
}
```

> Retry only failures that are likely to be transient. Validation failures, malformed recipients, and other input errors should fail fast instead of being retried indefinitely.

## 5. Use structured events for monitoring

`PayrollService` emits lifecycle events through the logger you pass in. That makes it straightforward to forward those events to your existing observability stack.

```ts
const logger = createHookLogger((entry) => {
  if (entry.event === "payment_complete") {
    console.log("payment completed", entry.context);
  }

  if (entry.event === "payment_validation_failed") {
    console.error("payment validation failed", entry.context);
  }
});
```

The SDK currently emits events such as `payment_start`, `payment_complete`, `payment_validation_failed`, and `contract_invocation_start` through the logger interface. You can use those signals to update metrics, emit alerts, or record audit trails for each payroll run.

## 6. Run the worker

```bash
npx tsx src/payroll-worker.ts
```

If you are prototyping locally, keep the worker simple and avoid coupling it to a full orchestration framework. Once the flow is stable, you can move the same logic into a queue consumer, cron job, or service container.

## Related docs

- [Integration Patterns](./INTEGRATION_PATTERNS.md) — architecture guidance for backend and frontend deployments.
- [Worker-Based Proof Generation](./WORKER_PROOF_GENERATION.md) — offload expensive proof work from the main thread when you are building browser-based experiences.
- [ZK Proof Generation Guide](./ZK_PROOF_GENERATION.md) — deeper background on how proofs are generated.
- [Testing Guide](./TESTING.md) — recommended patterns for testing worker logic and SDK integrations.
