/**
 * Event-Driven Cache Invalidation Bridge.
 *
 * Connects raw and typed Soroban contract events to cache invalidation helpers,
 * enabling automatic real-time cache purging upon transaction confirmation.
 */

import { TransactionWatcher, ConfirmationResult } from "../events";
import { TypedContractEvent } from "../event-parser";
import {
  AnyCacheBackend,
  applyInvalidationPlan,
  resolveInvalidationPlan,
} from "../cache/invalidation";
import { InvalidationPlan, InvalidationResult } from "../cache/invalidationTypes";
import { PayrollCacheInvalidator } from "../cache/PayrollCacheInvalidator";

export interface EventBridgeOptions {
  readonly onInvalidated?: (
    result: InvalidationResult,
    event?: TypedContractEvent | ConfirmationResult
  ) => void;
  readonly onError?: (error: Error) => void;
}

/**
 * Resolves an InvalidationPlan from a TypedContractEvent.
 */
export function invalidationPlanFromContractEvent(event: TypedContractEvent): InvalidationPlan {
  return resolveInvalidationPlan({
    ...event,
    trigger: `event:${event.type}`,
  });
}

/**
 * Invalidates cache entries from a list of typed contract events.
 */
export async function invalidateFromContractEvents(
  cache: AnyCacheBackend,
  events: readonly TypedContractEvent[]
): Promise<InvalidationResult[]> {
  const results: InvalidationResult[] = [];
  for (const event of events) {
    const plan = invalidationPlanFromContractEvent(event);
    const result = await applyInvalidationPlan(cache, plan);
    results.push(result);
  }
  return results;
}

/**
 * Attaches automatic cache invalidation to a TransactionWatcher instance.
 *
 * Purges cached state whenever transactions confirm with associated event payloads.
 */
export function attachCacheInvalidatorToWatcher(
  watcher: TransactionWatcher,
  cacheOrInvalidator: AnyCacheBackend | PayrollCacheInvalidator,
  options: EventBridgeOptions = {}
): () => void {
  const invalidator =
    cacheOrInvalidator instanceof PayrollCacheInvalidator
      ? cacheOrInvalidator
      : new PayrollCacheInvalidator(cacheOrInvalidator);

  const handler = async (confirmation: ConfirmationResult): Promise<void> => {
    try {
      if (confirmation.status === "SUCCESS") {
        const result = await invalidator.invalidatePayroll({ runId: confirmation.txHash });
        if (options.onInvalidated) {
          options.onInvalidated(result, confirmation);
        }
      }
    } catch (err) {
      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  watcher.on("confirmed", handler);

  return () => {
    watcher.off("confirmed", handler);
  };
}
