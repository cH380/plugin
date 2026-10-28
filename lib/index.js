import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { buildPlatformSeed } from "./compat.host.js";
import crypto from "node:crypto";

const SERVICE_KEY = "messageEditDesktop";
const TURN_END = "turn/end";
const USER_MESSAGE = "user/message";

/** Fallback window in which the client is expected to report the outcome of a rewrite. */
const PENDING_ARCHIVE_MS = 20000;

const MODEL_SELECTION = "model/selection";
const REQUEST_HEADER = "request/header";
const MODEL_SELECTION_PROJECTION = "modelSelection";
const FALLBACK_SELECTION = { provider: "openai", model: "gpt-5.6-luna" };

/**
 * DSH 0.2.1-rc.3 replaced `sessionTitle.titleOf(session)` with `titleOf`-less
 * `get(session)` snapshots. Read whichever face the running build exposes.
 *
 * @param sessionTitle - the `sessionTitle` service, or undefined
 * @param session - live session to read the title from
 * @returns the current title string, or undefined when the platform cannot tell
 */
function readSessionTitle(sessionTitle, session) {
  if (sessionTitle === undefined || sessionTitle === null || session === undefined) return undefined;
  try {
    if (typeof sessionTitle.titleOf === "function") return sessionTitle.titleOf(session);
    if (typeof sessionTitle.get === "function") {
      const snapshot = sessionTitle.get(session);
      const title = snapshot && typeof snapshot === "object" ? snapshot.title : snapshot;
      return typeof title === "string" ? title : undefined;
    }
  } catch (_) {}
  return undefined;
}

/** Narrow one stored selection to the provider/model pair AgentOptions accepts. */
function normalizeSelection(value) {
  if (!value || typeof value !== "object") return undefined;
  const provider = typeof value.provider === "string" && value.provider !== "" ? value.provider : undefined;
  const model = typeof value.model === "string" && value.model !== "" ? value.model : undefined;
  if (provider === undefined || model === undefined) return undefined;
  const reasoningEffort =
    typeof value.reasoningEffort === "string" && value.reasoningEffort !== "" ? value.reasoningEffort : undefined;
  return reasoningEffort === undefined ? { provider, model } : { provider, model, reasoningEffort };
}

function sameSelection(left, right) {
  return (
    left !== undefined &&
    right !== undefined &&
    left.provider === right.provider &&
    left.model === right.model &&
    left.reasoningEffort === right.reasoningEffort
  );
}

/**
 * Fold the durable model-selection projection from Session events.
 *
 * Mirrors the host's `applyModelSelectionProjection`: a `model/selection` event
 * records pending intent, and a `request/header` carrying the same config
 * consumes it. The pending intent is what the Session will use next; without
 * one, the last used request config stands.
 */
function selectionFromEvents(events) {
  let lastUsed;
  let pending;
  for (const event of events) {
    if (event.type === MODEL_SELECTION) {
      const picked = normalizeSelection(event.data);
      if (picked !== undefined) pending = picked;
    } else if (event.type === REQUEST_HEADER) {
      const used = normalizeSelection(event.data && event.data.header && event.data.header.config);
      if (used === undefined) continue;
      lastUsed = used;
      if (sameSelection(pending, used)) pending = undefined;
    }
  }
  return pending === undefined ? lastUsed : pending;
}

/**
 * Resolve the model the edited Session is actually on.
 *
 * The Session-local selection is authoritative: an in-session switch updates it
 * immediately, while the global default (`agentDefaultModel`) is only saved in
 * the background, so reading the default yields the session's previous model.
 * Preference order: the live projection, the durable events it derives from, the
 * global default, then a built-in pair.
 */
function resolveSessionSelection(ctx, observed, events) {
  const projected =
    observed && observed.projections && observed.projections.values
      ? observed.projections.values[MODEL_SELECTION_PROJECTION]
      : undefined;
  if (projected && typeof projected === "object") {
    const candidate =
      projected.next !== undefined && projected.next !== null
        ? projected.next
        : projected.pending !== undefined && projected.pending !== null
          ? projected.pending
          : projected.lastUsed;
    const fromProjection = normalizeSelection(candidate);
    if (fromProjection !== undefined) return fromProjection;
  }

  const fromEvents = selectionFromEvents(Array.isArray(events) ? events : []);
  if (fromEvents !== undefined) return fromEvents;

  const defaults = ctx.get("agentDefaultModel");
  if (defaults !== undefined && defaults !== null) {
    const fallback = normalizeSelection(defaults.currentSelection());
    if (fallback !== undefined) return fallback;
  }

  return FALLBACK_SELECTION;
}

export default class MessageEditService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, SERVICE_KEY);
    this.pendingArchives = new Map();
    try {
      ctx.logger?.info?.(`dsh-message-edit-desktop: message editor mounted (service "${SERVICE_KEY}")`);
    } catch (_) {}
  }

  /**
   * Rewrite one past user message: cut the history before its turn, fork a clean
   * child session carrying the edited text, and start the new turn.
   *
   * @param sessionId - session holding the edited message
   * @param seq - anchor seq of the edited user message
   * @param text - replacement text (attachments of the original are preserved)
   * @returns the new session id, or a structured failure
   */
  async resolve(sessionId, seq, text) {
    let observed = undefined;
    try {
      if (
        typeof sessionId !== "string" ||
        typeof seq !== "number" ||
        !Number.isFinite(seq) ||
        seq < 0 ||
        typeof text !== "string"
      ) {
        return { ok: false, error: "Invalid parameters" };
      }
      const targetSeq = Math.floor(seq);

      const sessionQuery = this.ctx.get("sessionQuery");
      if (sessionQuery === undefined) return { ok: false, error: "Session query service unavailable" };

      // use observeSession instead of readSession:
      // readSession has an upstream bug in DSH where it calls Session.create instead of Session.fromRestore on seeded sessions
      observed = await sessionQuery.observeSession(sessionId);
      if (!observed || !Array.isArray(observed.events)) {
        return { ok: false, error: "Session not found or has no events" };
      }
      const events = observed.events;

      const target = events.find(
        (event) =>
          event.seq === targetSeq &&
          event.type === USER_MESSAGE &&
          event.data &&
          event.data.source &&
          event.data.source.kind === "user",
      );
      if (target === undefined) return { ok: false, error: "Target user message not found" };

      const agents = this.ctx.get("agents");
      const sourceAgent = agents ? agents.get(sessionId) : undefined;
      if (sourceAgent && sourceAgent.status === "running") {
        try {
          // DSH 0.2.1-rc.3 takes a closed `AgentCancelCause` object; the old
          // bare string made the loop's cause switch throw during turn teardown.
          await sourceAgent.cancel({ kind: "user" });
        } catch (_) {}
      }

      const originalContent = Array.isArray(target.data && target.data.content) ? target.data.content : [];
      const nonTextBlocks = originalContent.filter((block) => block && block.type !== "text");
      const newContent = [
        ...nonTextBlocks,
        { type: "text", text },
      ];

      // Determine cut boundary:
      // Track turns, completed steps, and user messages to differentiate
      // an initial turn prompt from an in-flight steering message.
      let currentTurn = null;
      let currentTurnStartSeq = null;
      let turnUserMessages = [];
      let lastCompletedTurnEndSeq = null;
      let lastStepEndSeqInTurn = null;

      for (const event of events) {
        if (event.seq > targetSeq) break;

        if (event.type === "turn/start") {
          currentTurn = event.data?.turn;
          currentTurnStartSeq = event.seq;
          turnUserMessages = [];
          lastStepEndSeqInTurn = null;
        } else if (event.type === TURN_END) {
          lastCompletedTurnEndSeq = event.seq;
          currentTurn = null;
          currentTurnStartSeq = null;
          turnUserMessages = [];
          lastStepEndSeqInTurn = null;
        } else if (event.type === "step/end") {
          if (event.seq < targetSeq) {
            lastStepEndSeqInTurn = event.seq;
          }
        } else if (event.type === USER_MESSAGE && event.data?.source?.kind === "user") {
          turnUserMessages.push(event.seq);
        }
      }

      // If target message is the first user message in its turn, we are editing
      // the initial prompt and rewind to before this turn opened.
      // If it is a subsequent user message in the same turn (steering message),
      // we preserve all completed steps in this turn prior to this steering message.
      const isInitialTurnPrompt = turnUserMessages.length <= 1 || turnUserMessages[0] === targetSeq;

      let boundary = null;
      if (isInitialTurnPrompt) {
        boundary = lastCompletedTurnEndSeq;
      } else {
        boundary = lastStepEndSeqInTurn !== null ? lastStepEndSeqInTurn : lastCompletedTurnEndSeq;
      }

      const workspaceRegistry = this.ctx.get("workspaceRegistry");
      const workspace = workspaceRegistry
        ? workspaceRegistry.list().find((w) => w.sessionIds && w.sessionIds.includes(sessionId))
        : undefined;

      const titles = this.ctx.get("sessionTitle");
      let sourceTitle = readSessionTitle(titles, sourceAgent ? sourceAgent.session : undefined);
      if (!sourceTitle && observed.header && observed.header.title) {
        sourceTitle = observed.header.title;
      }

      const sessionController = this.ctx.get("sessionController");
      if (sessionController === undefined) {
        return { ok: false, error: "Session controller unavailable" };
      }

      const isFork = boundary !== null;
      const { seed: cleanSeed, inheritedEventCount } = await buildPlatformSeed(events, boundary);

      const childId = `session-${crypto.randomUUID()}`;
      const composition = await sessionController.agents.composeAgent(
        sessionController.agents.presetForObservation(observed),
      );

      // Inherit the model this Session is on, not the (lagging) global default.
      const selection = resolveSessionSelection(this.ctx, observed, events);

      await agents.create({
        sessionId: childId,
        ...(isFork ? { seed: cleanSeed, inheritedEventCount } : {}),
        meta: {
          ...(observed.header && observed.header.cwd === undefined ? {} : { cwd: observed.header.cwd }),
          parentSession: observed.header ? observed.header.id : sessionId,
          isSeeded: isFork,
          ...(composition.agentPreset === undefined ? {} : { agentPreset: composition.agentPreset }),
        },
        agentOptions: {
          provider: selection.provider,
          model: selection.model,
          ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
        },
        setup: composition.setup,
      });

      if (workspace) {
        try {
          await workspace.attachSession(childId);
        } catch (_) {}
      }

      const childAgent = agents ? agents.get(childId) : undefined;
      if (childAgent) {
        // The child is created outside the Session controller, so record the
        // inherited model as its durable selection: the child's own projection
        // and model selector then agree with the model actually used.
        try {
          if (childAgent.session && typeof childAgent.session.append === "function") {
            childAgent.session.append(MODEL_SELECTION, {
              provider: selection.provider,
              model: selection.model,
              ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
            });
          }
        } catch (_) {}
        const message = {
          id: `msg-${crypto.randomUUID()}`,
          role: "user",
          content: newContent,
          source: {
            kind: "user",
            ...(target.data && target.data.source && target.data.source.clientTimeZone
              ? { clientTimeZone: target.data.source.clientTimeZone }
              : {}),
          },
        };
        childAgent.followup(message);
      }

      if (titles && childAgent && sourceTitle) {
        try {
          titles.rename(childAgent.session, sourceTitle);
        } catch (_) {}
      }

      // fallback archive in case client disconnects before reporting the outcome
      this.scheduleArchive(sessionId);

      return {
        ok: true,
        mode: isFork ? "fork" : "fresh",
        childId,
        oldSessionId: sessionId,
      };
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    } finally {
      if (observed && typeof observed[Symbol.dispose] === "function") {
        try {
          observed[Symbol.dispose]();
        } catch (_) {}
      }
    }
  }

  scheduleArchive(sessionId) {
    if (this.pendingArchives.has(sessionId)) {
      clearTimeout(this.pendingArchives.get(sessionId));
    }
    this.pendingArchives.set(
      sessionId,
      setTimeout(() => {
        this.pendingArchives.delete(sessionId);
        this.archive(sessionId).catch(() => {});
      }, PENDING_ARCHIVE_MS),
    );
  }

  /** Client reported that it archived the superseded session itself. */
  async detach(sessionId) {
    return this.archive(sessionId);
  }

  /**
   * Client reported that it could not switch to the new session: keep the
   * superseded session (and its view) intact instead of archiving it underfoot.
   */
  async keep(sessionId) {
    try {
      if (this.pendingArchives.has(sessionId)) {
        clearTimeout(this.pendingArchives.get(sessionId));
        this.pendingArchives.delete(sessionId);
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    }
  }

  async archive(sessionId) {
    try {
      if (typeof sessionId !== "string" || sessionId === "") return { ok: false, error: "Invalid sessionId" };

      if (this.pendingArchives.has(sessionId)) {
        clearTimeout(this.pendingArchives.get(sessionId));
        this.pendingArchives.delete(sessionId);
      }

      const agents = this.ctx.get("agents");
      const agent = agents ? agents.get(sessionId) : undefined;
      if (agent && agent.status === "running") {
        try {
          await agent.cancel({ kind: "user" });
        } catch (_) {}
      }

      const workspaceRegistry = this.ctx.get("workspaceRegistry");
      if (workspaceRegistry) {
        try {
          await workspaceRegistry.archiveSession(sessionId);
        } catch (err) {
          // fallback: detach manually from workspaces if archiveSession fails
          for (const w of workspaceRegistry.list()) {
            if (w.sessionIds && w.sessionIds.includes(sessionId)) {
              await w.detachSession(sessionId).catch(() => {});
            }
          }
        }
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    }
  }
}
