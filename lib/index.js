import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { buildPlatformSeed } from "./compat.host.js";
import crypto from "node:crypto";

const SERVICE_KEY = "messageEditDesktop";
const TURN_END = "turn/end";
const USER_MESSAGE = "user/message";

/** Fallback window in which the client is expected to report the outcome of a rewrite. */
const PENDING_ARCHIVE_MS = 20000;

/** How long to wait for a freshly created child Agent to publish itself in `agents`. */
const CHILD_AGENT_TIMEOUT_MS = 3000;

const MODEL_SELECTION = "model/selection";
const REQUEST_HEADER = "request/header";
const MODEL_SELECTION_PROJECTION = "modelSelection";
const FALLBACK_SELECTION = { provider: "openai", model: "gpt-5.6-luna" };

/**
 * Every Host capability this plugin touches is optional at the call site, so a
 * future DSH build that renames or drops one degrades this plugin instead of
 * failing its activation. The probes below are the only version-sensitive
 * places; the rest of the flow is expressed through them.
 *
 * @param ctx - owning Host context
 * @param name - service key to read
 * @returns the service, or undefined when this build does not provide it
 */
function serviceOf(ctx, name) {
  try {
    return ctx.get(name);
  } catch (_) {
    return undefined;
  }
}

/**
 * Read a method off a service without assuming the object shape.
 *
 * @param service - candidate service, or undefined
 * @param method - method name
 * @returns the bound method, or undefined when absent
 */
function methodOf(service, method) {
  if (service === null || service === undefined) return undefined;
  const value = service[method];
  if (typeof value !== "function") return undefined;
  return value.bind(service);
}

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

  const defaults = serviceOf(ctx, "agentDefaultModel");
  const current = methodOf(defaults, "currentSelection");
  if (current !== undefined) {
    try {
      const fallback = normalizeSelection(current());
      if (fallback !== undefined) return fallback;
    } catch (_) {}
  }

  return FALLBACK_SELECTION;
}

/**
 * Read the child session identity out of whatever a fork command returns.
 *
 * DSH 0.2.1-rc.5 answers `{ sessionId }`; older and future builds may answer the
 * identifier directly or under a differently named field, so accept each shape
 * instead of pinning one.
 *
 * @param value - fork result
 * @returns the child session id, or undefined when the result is unrecognizable
 */
function childIdOf(value) {
  if (typeof value === "string" && value !== "") return value;
  if (value === null || typeof value !== "object") return undefined;
  for (const key of ["sessionId", "childId", "session", "id"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate !== "") return candidate;
  }
  return undefined;
}

/**
 * Wait for a just-created Agent to appear in the registry.
 *
 * @param agents - the `agents` service, or undefined
 * @param childId - session id of the child
 * @returns the live agent, or undefined when the build publishes none
 */
async function waitForAgent(agents, childId) {
  const get = methodOf(agents, "get");
  if (get === undefined) return undefined;
  const deadline = Date.now() + CHILD_AGENT_TIMEOUT_MS;
  for (;;) {
    let agent;
    try {
      agent = get(childId);
    } catch (_) {
      agent = undefined;
    }
    if (agent !== undefined && agent !== null) return agent;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
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
   * The fork itself is delegated to the Host whenever it exposes one
   * (`sessionController.fork`), because that command owns seed construction,
   * Agent-preset composition, workspace forking and migration preflight — the
   * exact surfaces this plugin used to reimplement and had to resync on every
   * DSH release. The local reimplementation stays as the fallback for builds
   * without that command.
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

      const sessionQuery = serviceOf(this.ctx, "sessionQuery");
      const observeSession = methodOf(sessionQuery, "observeSession");
      if (observeSession === undefined) return { ok: false, error: "Session query service unavailable" };

      // use observeSession instead of readSession:
      // readSession has an upstream bug in DSH where it calls Session.create instead of Session.fromRestore on seeded sessions
      observed = await observeSession(sessionId);
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

      const agents = serviceOf(this.ctx, "agents");
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
      const newContent = [...nonTextBlocks, { type: "text", text }];

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

      const isFork = boundary !== null;
      const sessionController = serviceOf(this.ctx, "sessionController");
      const hostFork = isFork ? methodOf(sessionController, "fork") : undefined;

      let childId;
      let childAgent;

      if (hostFork !== undefined) {
        // Host-owned fork: the platform builds the seed, composes the Agent
        // preset from the observed Session, inherits its model and forks its
        // workspace. Nothing here needs to track a host release.
        const forked = await hostFork({ sessionId, atSeq: boundary });
        childId = childIdOf(forked);
        if (childId === undefined) return { ok: false, error: "Host fork returned no session id" };
      } else {
        if (agents === undefined || typeof agents.create !== "function") {
          return { ok: false, error: "Agents service unavailable" };
        }
        const childSessionId = `session-${crypto.randomUUID()}`;
        const composition = await this.composeChild(sessionController, observed);

        // Inherit the model this Session is on, not the (lagging) global default.
        const selection = resolveSessionSelection(this.ctx, observed, events);

        await agents.create({
          sessionId: childSessionId,
          ...(isFork ? await seedFor(events, boundary) : {}),
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
        childId = childSessionId;

        const attached = await this.attachToWorkspace(sessionId, childId);
        if (!attached) {
          // Workspace-less profiles stay usable; the session is still reachable.
        }

        // The child is created outside the Session controller, so record the
        // inherited model as its durable selection: the child's own projection
        // and model selector then agree with the model actually used.
        const agent = await waitForAgent(agents, childId);
        if (agent !== undefined) {
          try {
            if (agent.session && typeof agent.session.append === "function") {
              agent.session.append(MODEL_SELECTION, {
                provider: selection.provider,
                model: selection.model,
                ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
              });
            }
          } catch (_) {}
        }
      }

      childAgent = await waitForAgent(agents, childId);
      if (childAgent === undefined) {
        return { ok: false, error: "Child session was created but no Agent is live for it" };
      }

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

      const titles = serviceOf(this.ctx, "sessionTitle");
      const rename = methodOf(titles, "rename");
      if (rename !== undefined && childAgent.session !== undefined) {
        let sourceTitle = readSessionTitle(titles, sourceAgent ? sourceAgent.session : undefined);
        if (!sourceTitle && observed.header && observed.header.title) {
          sourceTitle = observed.header.title;
        }
        if (sourceTitle) {
          try {
            rename(childAgent.session, sourceTitle);
          } catch (_) {}
        }
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

  /**
   * Resolve the Agent preset composition a child Session should inherit.
   *
   * @param sessionController - the `sessionController` service, or undefined
   * @param observed - observation of the source Session
   * @returns `{ agentPreset?, setup? }`; empty when this build cannot compose
   */
  async composeChild(sessionController, observed) {
    const composeAgent = methodOf(sessionController?.agents, "composeAgent");
    const presetForObservation = methodOf(sessionController?.agents, "presetForObservation");
    if (composeAgent === undefined || presetForObservation === undefined) return {};
    try {
      return (await composeAgent(presetForObservation(observed))) || {};
    } catch (_) {
      return {};
    }
  }

  /**
   * Attach a locally created child to the workspace that owns its parent.
   *
   * @param sessionId - parent session id
   * @param childId - child session id
   * @returns whether a workspace accepted the child
   */
  async attachToWorkspace(sessionId, childId) {
    const workspaceRegistry = serviceOf(this.ctx, "workspaceRegistry");
    const list = methodOf(workspaceRegistry, "list");
    if (list === undefined) return false;
    try {
      const workspace = list().find((w) => w.sessionIds && w.sessionIds.includes(sessionId));
      const attachSession = methodOf(workspace, "attachSession");
      if (attachSession === undefined) return false;
      await attachSession(childId);
      return true;
    } catch (_) {
      return false;
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

      const agents = serviceOf(this.ctx, "agents");
      const agent = agents ? agents.get(sessionId) : undefined;
      if (agent && agent.status === "running") {
        try {
          await agent.cancel({ kind: "user" });
        } catch (_) {}
      }

      const workspaceRegistry = serviceOf(this.ctx, "workspaceRegistry");
      const archiveSession = methodOf(workspaceRegistry, "archiveSession");
      if (archiveSession !== undefined) {
        try {
          // DSH 0.2.1-rc.5 refuses to archive a Session whose work is still
          // unwinding unless the caller asks it to stop that work; the extra
          // option is ignored by builds that predate it.
          await archiveSession(sessionId, { stopActivity: true });
        } catch (err) {
          try {
            await archiveSession(sessionId);
          } catch (_) {
            // fallback: detach manually from workspaces if archiveSession fails
            const list = methodOf(workspaceRegistry, "list");
            if (list !== undefined) {
              for (const w of list()) {
                if (w.sessionIds && w.sessionIds.includes(sessionId)) {
                  const detachSession = methodOf(w, "detachSession");
                  if (detachSession !== undefined) await detachSession(sessionId).catch(() => {});
                }
              }
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

/**
 * Build the seed payload for a locally created child.
 *
 * @param events - parent event log
 * @param boundary - inclusive cut seq
 * @returns `{ seed, inheritedEventCount }`
 */
async function seedFor(events, boundary) {
  const { seed, inheritedEventCount } = await buildPlatformSeed(events, boundary);
  return { seed, inheritedEventCount };
}
