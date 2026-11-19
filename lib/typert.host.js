/* Hand-written Typert host face for dsh-message-edit-desktop.
 * Registered automatically by `@deepseek-ai/dsh-typert-loader` because this
 * package exports `./typert`. Keep this in sync with the service methods in
 * `lib/index.js` and the client descriptors in `lib/client.js`.
 *
 * Every `wire` name must also be the name of the corresponding JavaScript
 * parameter in `lib/index.js`. A Host that cannot load this face (loader
 * unavailable, package not resolvable) falls back to reflecting the method
 * signature and accepts exactly those parameter names — a wire name that only
 * exists here would then be rejected as an unexpected argument field. */
import { z } from "zod";
import { strictCodec } from "./compat.host.js";

const resolveResultSchema = z.union([
  z.object({ ok: z.literal(true), mode: z.literal("fork"), childId: z.string(), oldSessionId: z.string() }),
  z.object({ ok: z.literal(true), mode: z.literal("fresh"), childId: z.string(), oldSessionId: z.string() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

const ackResultSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

/**
 * The model the composer shows for the edited session. The Host validates it
 * against the live provider registry before using it, so an absent selection
 * simply lets the Host resolve the model on its own.
 */
const modelSelectionSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    reasoningEffort: z.string().min(1).optional(),
  })
  .nullable()
  .optional();

export const TYPERT = {
  package: "dsh-message-edit-desktop",
  face: "host",
  schemas: [],
  invocations: [
    {
      id: "dsh-message-edit-desktop#messageEditDesktop/resolve",
      service: "messageEditDesktop",
      namespace: "messageEditDesktop",
      method: "resolve",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "sessionId",
          wire: "sessionId",
          source: "json",
          codec: strictCodec("string", () => z.string()),
        },
        {
          name: "seq",
          wire: "seq",
          source: "json",
          codec: strictCodec("number", () => z.number()),
        },
        {
          name: "text",
          wire: "text",
          source: "json",
          codec: strictCodec("string", () => z.string()),
        },
        {
          name: "selection",
          wire: "selection",
          source: "json",
          // The composer may not know the model; the Host then falls back to
          // the Session's own selection.
          acceptsUndefined: true,
          codec: strictCodec("modelSelection", () => modelSelectionSchema),
        },
      ],
      result: strictCodec("dsh-message-edit-desktop#messageEditDesktop/resolve:result", () => resolveResultSchema),
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
    {
      id: "dsh-message-edit-desktop#messageEditDesktop/detach",
      service: "messageEditDesktop",
      namespace: "messageEditDesktop",
      method: "detach",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "sessionId",
          wire: "sessionId",
          source: "json",
          codec: strictCodec("string", () => z.string()),
        },
      ],
      result: strictCodec("dsh-message-edit-desktop#messageEditDesktop/detach:result", () => ackResultSchema),
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
    {
      id: "dsh-message-edit-desktop#messageEditDesktop/keep",
      service: "messageEditDesktop",
      namespace: "messageEditDesktop",
      method: "keep",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "sessionId",
          wire: "sessionId",
          source: "json",
          codec: strictCodec("string", () => z.string()),
        },
      ],
      result: strictCodec("dsh-message-edit-desktop#messageEditDesktop/keep:result", () => ackResultSchema),
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
  ],
  model: { services: [], events: [], objects: [] },
};
