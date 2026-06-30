# Structured Progress Events

Long-running SDK operations can report standardized progress through an `onProgress` callback. The callback receives a typed `PayrollProgressEvent` object instead of positional status arguments.

```ts
import { PayrollService, PayrollProgressEvent } from "@zk-payroll/core";

const onProgress = (event: PayrollProgressEvent) => {
  console.log(event.timestamp, event.operation, event.stage, event.progress);
};

await payroll.processPayment({
  recipient: "G...",
  amount: 1_000_000n,
  asset: "native",
  onProgress,
});
```

## Event shape

```ts
interface PayrollProgressEvent {
  operation: "proof" | "payment";
  stage:
    | "validation"
    | "proof_loading_wasm"
    | "proof_loading_zkey"
    | "proof_generating"
    | "proof_done"
    | "submission_preparing"
    | "submission_submitting"
    | "submission_done";
  message: string;
  progress?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

## Representative sequence

A payment that needs to load proof artifacts generally emits:

1. `payment.validation`
2. `proof.proof_loading_wasm`
3. `proof.proof_loading_zkey`
4. `proof.proof_generating`
5. `proof.proof_done`
6. `payment.submission_preparing`
7. `payment.submission_done`

Consumers should treat `stage` as the stable UI key. `message` is a machine-readable status detail, `progress` is present only when the SDK can estimate completion, and `metadata` never includes sensitive witness fields such as recipient or amount.
