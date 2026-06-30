export {
  ZkPayrollError,
  NetworkError,
  ProofGenerationError,
  ContractExecutionError,
  ValidationError,
  ContractErrorCode,
  mapRpcError,
} from "./core/errors";
export type { ErrorContext, ContractErrorCodeType } from "./core/errors";

// ── Backward-compatible aliases ─────────────────────────────────────────────
import { ZkPayrollError } from "./core/errors";

/** Error codes for PayrollService validation/orchestration failures */
export const PayrollServiceErrorCode = {
  PROOF_GENERATION_FAILED: 2001,
  INVALID_RECIPIENT: 2002,
  INVALID_AMOUNT: 2003,
  INVALID_ASSET: 2004,
} as const;

export type PayrollServiceErrorCode =
  (typeof PayrollServiceErrorCode)[keyof typeof PayrollServiceErrorCode];

/**
 * @deprecated Use `ZkPayrollError` instead.
 */
export class PayrollError extends ZkPayrollError {
  constructor(message: string, code: any, context: Record<string, any> = {}) {
    let sanitizedCode = code;
    if (typeof code === "number" && code < 2000) {
      sanitizedCode = String(code);
    }
    super(message, sanitizedCode, context);
    this.name = "PayrollError";
  }
}

/** @deprecated Use structured error logging instead. */
export function handleApiError(error: unknown): void {
  console.error("API Error:", error);
}