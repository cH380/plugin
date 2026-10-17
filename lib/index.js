import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { buildPlatformSeed } from "./compat.host.js";
import crypto from "node:crypto";

const SERVICE_KEY = "messageEditDesktop";
const TURN_END = "turn/end";
const USER_MESSAGE = "user/message";

/** Events that belong to an assistant answer rather than to the prompt that asked for it. */
const ANSWER_EVENT_TYPES = new Set([
  "assistant/message",
  "assistant/attempt",
  "tool/call",
  "tool/result",
  "step/start",
  "step/end",
  "request/header",
  "request/context",
]);

/** Fallback window in which the client is expected to report the outcome of a rewrite. */
const PENDING_ARCHIVE_MS = 20000;

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
      if (typeof text !== "string") return { ok: false, error: "Invalid parameters" };

      const located = await this.locate(sessionId, seq, null);
      if (located.error !== undefined) return { ok: false, error: located.error };
      observed = located.observed;
      const events = located.events;
      const targetSeq = located.targetSeq;
      const target = events[targetSeq];

      if (target.type !== USER_MESSAGE || target.data?.source?.kind !== "user") {
        return { ok: false, error: "Target user message not found" };
      }

      await this.stopSourceAgent(sessionId);

      const originalContent = Array.isArray(target.data && target.data.content) ? target.data.content : [];
      const nonTextBlocks = originalContent.filter((block) => block && block.type !== "text");
      const newContent = [
        ...nonTextBlocks,
        { type: "text", text },
      ];

      const boundary = this.editBoundary(events, targetSeq);
      const created = await this.createChild({
        observed,
        sessionId,
        boundary,
        sourceTitle: this.sourceTitle(observed, sessionId),
      });
      if (created.error !== undefined) return { ok: false, error: created.error };

      if (created.childAgent) {
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
        created.childAgent.followup(message);
      }

      // fallback archive in case client disconnects before reporting the outcome
      this.scheduleArchive(sessionId);

      return {
        ok: true,
        mode: created.isFork ? "fork" : "fresh",
        childId: created.childId,
        oldSessionId: sessionId,
      };
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    } finally {
      this.disposeObservation(observed);
    }
  }

  /**
   * Delete one message and everything after it: cut the history right before the
   * message, fork a clean child session from that prefix, and let the client move
   * the view there. Nothing is re-sent, so the child simply ends at the cut.
   *
   * A user message rewinds to before its turn (a clean turn boundary); an
   * assistant answer keeps the prompt that asked for it and drops the answer.
   *
   * @param sessionId - session holding the deleted message
   * @param seq - anchor seq of the message, when the caller has one
   * @param messageId - message id, for callers that only know the message identity
   * @returns the new session id, or a structured failure
   */
  async remove(sessionId, seq, messageId) {
    let observed = undefined;
    try {
      const located = await this.locate(sessionId, seq, messageId);
      if (located.error !== undefined) return { ok: false, error: located.error };
      observed = located.observed;
      const events = located.events;
      const targetSeq = located.targetSeq;
      const target = events[targetSeq];

      await this.stopSourceAgent(sessionId);

      const boundary =
        target.type === USER_MESSAGE && target.data?.source?.kind === "user"
          ? this.editBoundary(events, targetSeq)
          : this.answerBoundary(events, targetSeq);

      const created = await this.createChild({
        observed,
        sessionId,
        boundary,
        sourceTitle: this.sourceTitle(observed, sessionId),
      });
      if (created.error !== undefined) return { ok: false, error: created.error };

      // fallback archive in case client disconnects before reporting the outcome
      this.scheduleArchive(sessionId);

      return {
        ok: true,
        mode: created.isFork ? "fork" : "fresh",
        childId: created.childId,
        oldSessionId: sessionId,
      };
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    } finally {
      this.disposeObservation(observed);
    }
  }

  /**
   * Read the session and resolve the target message to one event seq, either from
   * the given seq or from the message identity carried by the event payload.
   *
   * @param sessionId - session to read
   * @param seq - candidate anchor seq
   * @param messageId - candidate message id
   * @returns the observation and target seq, or a structured failure
   */
  async locate(sessionId, seq, messageId) {
    if (typeof sessionId !== "string" || sessionId === "") return { error: "Invalid parameters" };

    const wantsSeq = typeof seq === "number" && Number.isFinite(seq) && seq >= 0;
    const wantsId = typeof messageId === "string" && messageId !== "";
    if (!wantsSeq && !wantsId) return { error: "Invalid parameters" };

    const sessionQuery = this.ctx.get("sessionQuery");
    if (sessionQuery === undefined) return { error: "Session query service unavailable" };

    // use observeSession instead of readSession:
    // readSession has an upstream bug in DSH where it calls Session.create instead of Session.fromRestore on seeded sessions
    let observed;
    try {
      observed = await sessionQuery.observeSession(sessionId);
    } catch (error) {
      return { error: String((error && error.message) || error) };
    }
    if (!observed || !Array.isArray(observed.events)) {
      this.disposeObservation(observed);
      return { error: "Session not found or has no events" };
    }
    const events = observed.events;

    let targetSeq = wantsSeq ? Math.floor(seq) : null;
    if (targetSeq !== null && events[targetSeq]?.seq !== targetSeq) {
      this.disposeObservation(observed);
      return { error: `event ${String(targetSeq)} does not exist in session "${sessionId}"` };
    }
    if (targetSeq === null) {
      const found = events.find((event) => {
        const data = event?.data;
        if (data === undefined || data === null) return false;
        if (data.id === messageId) return true;
        const message = data.message;
        return message !== undefined && message !== null && message.id === messageId;
      });
      if (found === undefined) {
        this.disposeObservation(observed);
        return { error: "Target message not found" };
      }
      targetSeq = found.seq;
    }

    return { observed, events, targetSeq };
  }

  /**
   * Cut boundary that rewinds history to just before the turn of one user message.
   * A steering message keeps the steps completed before it; an initial prompt
   * rewinds to the previous turn end (`null` = the session had no earlier turn).
   *
   * @param events - committed event log
   * @param targetSeq - seq of the target user message
   * @returns the inclusive cut seq, or null for an empty prefix
   */
  editBoundary(events, targetSeq) {
    let turnUserMessages = [];
    let lastCompletedTurnEndSeq = null;
    let lastStepEndSeqInTurn = null;

    for (const event of events) {
      if (event.seq > targetSeq) break;

      if (event.type === "turn/start") {
        turnUserMessages = [];
        lastStepEndSeqInTurn = null;
      } else if (event.type === TURN_END) {
        lastCompletedTurnEndSeq = event.seq;
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
    if (isInitialTurnPrompt) return lastCompletedTurnEndSeq;
    return lastStepEndSeqInTurn !== null ? lastStepEndSeqInTurn : lastCompletedTurnEndSeq;
  }

  /**
   * Cut boundary that drops the answer of one turn while keeping the prompt:
   * the last event of the enclosing turn that is not answer content.
   *
   * @param events - committed event log
   * @param targetSeq - seq of the target answer event
   * @returns the inclusive cut seq, or null for an empty prefix
   */
  answerBoundary(events, targetSeq) {
    let turnStartSeq = null;
    for (const event of events) {
      if (event.seq > targetSeq) break;
      if (event.type === "turn/start") turnStartSeq = event.seq;
    }

    let boundary = null;
    for (const event of events) {
      if (event.seq > targetSeq) break;
      if (turnStartSeq !== null && event.seq < turnStartSeq) continue;
      if (ANSWER_EVENT_TYPES.has(event.type)) continue;
      if (event.seq >= targetSeq) break;
      boundary = event.seq;
    }
    return boundary;
  }

  /**
   * Fork (or freshly create) the child session that carries the truncated prefix.
   *
   * @param options.observed - source session observation
   * @param options.sessionId - source session id
   * @param options.boundary - inclusive cut seq, or null for an empty child
   * @param options.sourceTitle - title to keep on the child
   * @returns the child id and agent, or a structured failure
   */
  async createChild({ observed, sessionId, boundary, sourceTitle }) {
    const sessionController = this.ctx.get("sessionController");
    if (sessionController === undefined) return { error: "Session controller unavailable" };
    const agents = this.ctx.get("agents");
    if (agents === undefined) return { error: "Agent service unavailable" };

    const isFork = boundary !== null;
    const { seed, inheritedEventCount } = await buildPlatformSeed(observed.events, boundary);

    const childId = `session-${crypto.randomUUID()}`;
    const composition = await sessionController.agents.composeAgent(
      sessionController.agents.presetForObservation(observed),
    );

    const agentDefaultModel = this.ctx.get("agentDefaultModel");
    const selection = agentDefaultModel
      ? agentDefaultModel.currentSelection()
      : { provider: "openai", model: "gpt-5.6-luna" };

    await agents.create({
      sessionId: childId,
      ...(isFork ? { seed, inheritedEventCount } : {}),
      meta: {
        ...(observed.header && observed.header.cwd === undefined ? {} : { cwd: observed.header.cwd }),
        parentSession: observed.header ? observed.header.id : sessionId,
        isSeeded: isFork,
        ...(composition.agentPreset === undefined ? {} : { agentPreset: composition.agentPreset }),
      },
      agentOptions: {
        provider: selection.provider,
        model: selection.model,
      },
      setup: composition.setup,
    });

    const workspaceRegistry = this.ctx.get("workspaceRegistry");
    const workspace = workspaceRegistry
      ? workspaceRegistry.list().find((w) => w.sessionIds && w.sessionIds.includes(sessionId))
      : undefined;
    if (workspace) {
      try {
        await workspace.attachSession(childId);
      } catch (_) {}
    }

    const childAgent = agents.get(childId);
    if (childAgent && sourceTitle) {
      const titles = this.ctx.get("sessionTitle");
      if (titles) {
        try {
          titles.rename(childAgent.session, sourceTitle);
        } catch (_) {}
      }
    }

    return { childId, childAgent, isFork };
  }

  /** The title the child keeps from its source session, when one is known. */
  sourceTitle(observed, sessionId) {
    const titles = this.ctx.get("sessionTitle");
    const agents = this.ctx.get("agents");
    const sourceAgent = agents ? agents.get(sessionId) : undefined;
    if (titles && sourceAgent) {
      try {
        const title = titles.titleOf(sourceAgent.session);
        if (title) return title;
      } catch (_) {}
    }
    if (observed.header && observed.header.title) return observed.header.title;
    return undefined;
  }

  /** Stop a running source turn: its work belongs to the branch being replaced. */
  async stopSourceAgent(sessionId) {
    const agents = this.ctx.get("agents");
    const sourceAgent = agents ? agents.get(sessionId) : undefined;
    if (sourceAgent && sourceAgent.status === "running") {
      try {
        await sourceAgent.cancel({ kind: "user" });
      } catch (_) {}
    }
  }

  disposeObservation(observed) {
    if (observed && typeof observed[Symbol.dispose] === "function") {
      try {
        observed[Symbol.dispose]();
      } catch (_) {}
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
