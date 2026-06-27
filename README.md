# ZK Payroll SDK

TypeScript SDK for interacting with the ZK Payroll smart contracts.

## Installation

```bash
npm install @zk-payroll/sdk
```

## Usage

```typescript
import { PayrollService, DEFAULT_CONFIG } from "@zk-payroll/sdk";

// Initialize service
const service = new PayrollService(DEFAULT_CONFIG);

// Process a private payment
await service.processPayment(
  "G...", // Recipient Stellar address
  1000n   // Amount
);
```

## Features

- **Contract Wrappers**: Typed interfaces for Soroban contracts.
- **ZK Proof Generation**: Client-side proof generation using snarkjs for privacy.
- **Caching**: Built-in caching for proofs and circuit artifacts.
- **Error Handling**: Robust error typing and management.
- **Mock Testing Environment**: Comprehensive testing utilities for unit tests without a live network.

## Zero-Knowledge Proof Generation

The SDK includes production-ready ZK proof generation using snarkjs:

```typescript
import { SnarkjsProofGenerator, MemoryCacheProvider } from "@zk-payroll/sdk";

// Configure circuit artifacts
const config = {
  wasmUrl: "https://cdn.example.com/payroll_circuit.wasm",
  zkeyUrl: "https://cdn.example.com/payroll_circuit.zkey",
  artifactCacheTTL: 86400, // 24 hours
};

// Create generator with caching
const cache = new MemoryCacheProvider<string>();
const generator = new SnarkjsProofGenerator(config, cache);

// Generate proof
const witness = {
  recipient: "GDZQHV...",
  amount: 1000000n,
  nullifier: 123456789n,
  secret: 987654321n,
};

const proof = await generator.generateProof(witness);
```

See [ZK Proof Generation Guide](./docs/ZK_PROOF_GENERATION.md) for detailed documentation.

## Testing

The SDK includes a powerful mock testing environment for writing unit tests:

```typescript
import { MockContractEnvironment, MockPayrollContract } from "@zk-payroll/sdk";

const mockEnv = new MockContractEnvironment();
mockEnv.expectInvoke("deposit").toReturn("tx_hash_123");

const mockContract = new MockPayrollContract(mockEnv);
const txHash = await mockContract.deposit(1000n);
```

See the [Testing Guide](docs/TESTING.md) for complete documentation.

## Examples

Runnable examples covering two core use cases are in the [`examples/`](./examples/) directory.
Each example works out of the box in demo mode (no Stellar node required) and switches to a
live network automatically when the relevant environment variables are set.

### Employee Onboarding

[`examples/employee-onboarding.ts`](./examples/employee-onboarding.ts)

Shows how to onboard a new employee: verify they have no existing payroll account, fund it
with an initial allocation, and confirm the deposit was recorded.

```bash
npx tsx examples/employee-onboarding.ts
```

### Payroll Execution

[`examples/payroll-execution.ts`](./examples/payroll-execution.ts)

Shows how to run a full private payroll batch: configure `SnarkjsProofGenerator` with circuit
artifacts and caching, wire up `PayrollService`, process multiple payments, and report results.

```bash
npx tsx examples/payroll-execution.ts
```

### Configuration

Copy the environment variable template and fill in your values to run against a live network:

```bash
cp examples/.env.example examples/.env
# edit examples/.env
source examples/.env && npx tsx examples/payroll-execution.ts
```

See [`examples/.env.example`](./examples/.env.example) for all available variables.

## Documentation

- [API Reference](./docs/API.md) - Complete API documentation
- [ZK Proof Generation](./docs/ZK_PROOF_GENERATION.md) - Detailed proof generation guide

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```
