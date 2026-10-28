/**
 * Platform compatibility adapter for DeepSeek Harness (DSH) Host Runtime.
 *
 * Fully synchronous module evaluation (no top-level await) to guarantee clean import
 * across all bundlers, CJS/ESM interop layers, and Node.js environments.
 * Runtime capabilities are memoized lazily on first invocation.
 *
 * Compatibility policy: this plugin must never pin a Host runtime package that the
 * DSH build already ships (`@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-agent`, …).
 * Installing an older copy into the profile shadows the runtime's own package and
 * leaves every plugin that waits on `sessions` unactivated (DSH refuses to start).
 * The one runtime package the plugin genuinely needs is `@deepseek-ai/dsh-typert-protocol`
 * (the Service base class), and its version must track the running DSH build.
 * Everything else is reimplemented here from the Host's published behavior.
 */

let forkSeedPromise = null;

async function getForkSeedBuilder() {
  if (forkSeedPromise) return forkSeedPromise;

  forkSeedPromise = (async () => {
    try {
      const mod = await import("@deepseek-ai/dsh-session/fork");
      return typeof mod.buildForkSeed === "function" ? mod.buildForkSeed : null;
    } catch (err) {
      // The Host runtime package is intentionally NOT a dependency of this plugin.
      // Absence is the normal case; rethrow unexpected bugs/syntax defects.
      if (err?.code !== "ERR_MODULE_NOT_FOUND") {
        throw err;
      }
      return null;
    }
  })();

  return forkSeedPromise;
}

/** Recovery code for an assistant tool request that never reached a recorded call start. */
const TOOL_NOT_STARTED = "TOOL_NOT_STARTED";
/** Recovery code for a recorded tool call whose completed outcome was not durably recorded. */
const TOOL_OUTCOME_UNKNOWN = "TOOL_OUTCOME_UNKNOWN";

/**
 * Model-visible wording of the synthetic error tool results a fork seed appends.
 * Kept byte-compatible with DSH 0.2.1-rc.3 `openTurnClosers(events, { kind: "forked" })`
 * so a locally built seed reads exactly like a Host-built one.
 */
const FORKED_CLOSER_TEXT = {
  started:
    "The history inherited by this branch records this tool call starting but does not include its result. " +
    "The parent session may have completed it after the fork point. Decide whether to retry from the tool semantics: " +
    "retry only if the operation is read-only or idempotent; if it may have side effects, first verify external state " +
    "or ask the user. Do not retry blindly.",
  notStarted:
    "The history inherited by this branch has no record of this tool call starting. " +
    "The parent session may have executed it after the fork point. Decide whether to retry from the tool semantics: " +
    "retry only if the operation is read-only or idempotent; if it may have side effects, first verify external state " +
    "or ask the user. Do not retry blindly.",
};

/** Recursively freeze one plain data value (Host messages are immutable by contract). */
function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Synthetic closers for an open tail turn, built without importing the Host runtime.
 *
 * Mirrors DSH 0.2.1-rc.3 `openTurnClosers`:
 * - unanswered assistant tool calls become synthetic error `tool/result` events first
 *   (Map insertion order preserves transcript order);
 * - an open step then receives `step/end`;
 * - the open turn finally receives `turn/end` with the `forked` reason.
 * Balanced logs produce no closers, and synthetic events reuse the last real
 * timestamp and continue its sequence numbers.
 *
 * @param {Array} events - inherited prefix (already includes the `session/end-seed` marker)
 * @returns {Array} closer events to append after `events`
 */
function forkedTurnClosers(events) {
  let openTurn = null;
  let openStep = null;
  let last;
  /** @type {Map<string, { turn: number, step: number, callSeq?: number }>} */
  const pending = new Map();

  for (const event of events) {
    last = { seq: event.seq, time: event.time };
    switch (event.type) {
      case "turn/start":
        pending.clear();
        openTurn = event.data.turn;
        openStep = null;
        break;
      case "turn/end":
        pending.clear();
        openTurn = null;
        openStep = null;
        break;
      case "step/start":
        openStep = event.data.step;
        break;
      case "step/end":
        pending.clear();
        openStep = null;
        break;
      case "assistant/message": {
        const message = event.data && event.data.message;
        const content = message && Array.isArray(message.content) ? message.content : [];
        for (const block of content) {
          if (block && block.type === "tool-call") {
            pending.set(block.id, { turn: event.data.turn, step: event.data.step });
          }
        }
        break;
      }
      case "tool/call": {
        const entry = pending.get(event.data.callId);
        if (entry !== undefined) entry.callSeq = event.seq;
        break;
      }
      case "tool/result": {
        const source = event.data && event.data.message && event.data.message.source;
        const callId = source === undefined ? undefined : source.callId;
        const entry = callId === undefined ? undefined : pending.get(callId);
        if (
          event.surfaceOp === "append" &&
          entry !== undefined &&
          entry.turn === event.data.turn &&
          entry.step === event.data.step
        ) {
          pending.delete(callId);
        }
        break;
      }
      default:
        break;
    }
  }

  if (openTurn === null || last === undefined) return [];

  const closers = [];
  let seq = last.seq + 1;
  const time = last.time;

  for (const [callId, entry] of pending) {
    const started = entry.callSeq !== undefined;
    closers.push({
      type: "tool/result",
      seq,
      time,
      data: {
        turn: entry.turn,
        step: entry.step,
        message: deepFreeze({
          id: `forked-tool-result-${callId}-${seq}`,
          role: "tool",
          toolCallId: callId,
          isError: true,
          source: { kind: "tool", callId },
          content: [{ type: "text", text: started ? FORKED_CLOSER_TEXT.started : FORKED_CLOSER_TEXT.notStarted }],
        }),
        error: started
          ? { name: "ToolOutcomeUnknownError", code: TOOL_OUTCOME_UNKNOWN }
          : { name: "ToolNotStartedError", code: TOOL_NOT_STARTED },
      },
      surfaceOp: "append",
      ...(started ? { sourceEventSeqs: [entry.callSeq] } : {}),
    });
    seq += 1;
  }

  if (openStep !== null) {
    closers.push({ type: "step/end", seq, time, data: { turn: openTurn, step: openStep } });
    seq += 1;
  }
  closers.push({ type: "turn/end", seq, time, data: { turn: openTurn, reason: { kind: "forked" } } });

  return closers;
}

/**
 * Local `buildForkSeed` implementation (DSH 0.2.1-rc.3 semantics).
 *
 * @param {Array} events - committed event log of the parent session
 * @param {number} boundary - inclusive source event seq the child inherits through
 * @returns {Array} seed events: the copied prefix, the inherited marker, and closers
 */
function localForkSeed(events, boundary) {
  const prefix = events.slice(0, boundary + 1);
  const boundaryEvent = events[boundary];
  prefix.push({
    type: "session/end-seed",
    seq: boundary + 1,
    time: boundaryEvent === undefined ? undefined : boundaryEvent.time,
    data: { inherited: true },
  });
  return prefix.concat(forkedTurnClosers(prefix));
}

/**
 * Build a structurally valid session seed for child session initialization across DSH versions.
 *
 * Prefers the Host runtime's own `buildForkSeed` when the package happens to be
 * resolvable, and otherwise uses the equivalent local implementation above.
 *
 * @param {Array} events - Committed event log of parent session
 * @param {number|null} boundary - Target cut event seq
 * @returns {Promise<{ seed: Array, inheritedEventCount: number }>}
 */
export async function buildPlatformSeed(events, boundary) {
  if (boundary === null) {
    return { seed: [], inheritedEventCount: 0 };
  }

  const builder = await getForkSeedBuilder();
  if (typeof builder === "function") {
    // DSH 0.2.x V4 format: seals open turns with synthetic 'forked' closers and inherited marker
    return {
      seed: builder(events, boundary),
      inheritedEventCount: boundary + 1,
    };
  }

  return {
    seed: localForkSeed(events, boundary),
    inheritedEventCount: boundary + 1,
  };
}

/**
 * Strict Typert codec factory with single-instance caching.
 * Satisfies both DSH 0.2 (create factory) and DSH 0.1.x (pre-instantiated schema property).
 *
 * @param {string} typeSymbol
 * @param {() => any} createSchema
 */
export function strictCodec(typeSymbol, createSchema) {
  const schema = createSchema();
  return {
    mode: "strict",
    typeSymbol,
    create: () => schema,
    schema,
  };
}
