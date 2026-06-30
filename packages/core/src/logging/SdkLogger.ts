import { redactObject } from "../redaction/RedactionEngine";

export type LogLevel = "info" | "warn" | "error";

export interface LogEvent {
  event: string;
  level: LogLevel;
  context?: Record<string, unknown>;
  timestamp: string;
}

export type LoggerHook = (entry: LogEvent) => void;

/** Opt-in structured logger interface for SDK observability. */
export interface SdkLogger {
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
}

/**
 * Creates an SdkLogger backed by a user-supplied callback.
 * The hook receives every log entry as a structured LogEvent.
 *
 * @example
 * const logger = createHookLogger((entry) => console.log(entry));
 */
export function createHookLogger(hook: LoggerHook): SdkLogger {
  function emit(level: LogLevel, event: string, context?: Record<string, unknown>): void {
    hook({ event, level, context, timestamp: new Date().toISOString() });
  }
  return {
    info: (event, context) => emit("info", event, context),
    warn: (event, context) => emit("warn", event, context),
    error: (event, context) => emit("error", event, context),
  };
}

/**
 * Returns a shallow copy of `context` with sensitive field values replaced by `"[redacted]"`.
 * Safe to call on any context object before passing to a logger.
 *
 * Delegates to the redaction module so the sensitive-field list stays in one place.
 */
export function redactSensitive(context: Record<string, unknown>): Record<string, unknown> {
  return redactObject(context).redacted as Record<string, unknown>;
}
