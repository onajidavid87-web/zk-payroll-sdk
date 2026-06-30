/** High-level SDK operations that can report structured progress. */
export type PayrollProgressOperation = "proof" | "payment";

/** Standardized stages emitted by long-running SDK operations. */
export type PayrollProgressStage =
  | "validation"
  | "proof_loading_wasm"
  | "proof_loading_zkey"
  | "proof_generating"
  | "proof_done"
  | "submission_preparing"
  | "submission_submitting"
  | "submission_done";

/** Structured progress event emitted by payroll preparation flows. */
export interface PayrollProgressEvent {
  /** Operation that emitted the event. */
  operation: PayrollProgressOperation;
  /** Current SDK stage. */
  stage: PayrollProgressStage;
  /** Stable machine-readable message for UI mapping and logs. */
  message: string;
  /** Optional completion percentage from 0 to 100 when known. */
  progress?: number;
  /** ISO timestamp for ordering events across async boundaries. */
  timestamp: string;
  /** Additional non-sensitive metadata about the event. */
  metadata?: Record<string, unknown>;
}

/** Callback used by SDK APIs that support structured progress reporting. */
export type PayrollProgressCallback = (event: PayrollProgressEvent) => void;

/** Build a timestamped progress event with a consistent shape. */
export function createPayrollProgressEvent(
  event: Omit<PayrollProgressEvent, "timestamp">
): PayrollProgressEvent {
  return { ...event, timestamp: new Date().toISOString() };
}
