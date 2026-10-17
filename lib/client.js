window.__ModuleLoader__.load({
  id: "dsh-message-edit-desktop",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require("react");

    function codec(schema) {
      return { mode: "strict", typeSymbol: "dsh-message-edit-desktop", schema, create: () => schema };
    }

    const str = {
      parse(value) {
        if (typeof value !== "string") throw new TypeError("expected string");
        return value;
      },
    };
    const num = {
      parse(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("expected number");
        return value;
      },
    };
    const nullable = (inner) => ({
      parse(value) {
        if (value === null) return null;
        return inner.parse(value);
      },
    });
    const literal = (expected) => ({
      parse(value) {
        if (value !== expected) throw new TypeError(`expected ${String(expected)}`);
        return value;
      },
    });
    const oneOf = (values) => ({
      parse(value) {
        if (!values.includes(value)) throw new TypeError("unexpected value");
        return value;
      },
    });
    function obj(shape) {
      return {
        parse(value) {
          if (typeof value !== "object" || value === null || Array.isArray(value)) {
            throw new TypeError("expected object");
          }
          const out = {};
          for (const key of Object.keys(shape)) {
            if (!Object.hasOwn(value, key)) throw new TypeError(`missing field ${key}`);
            out[key] = shape[key].parse(value[key]);
          }
          return out;
        },
      };
    }
    function unionOf(...variants) {
      return {
        parse(value) {
          for (const variant of variants) {
            try {
              return variant.parse(value);
            } catch {
              // try next
            }
          }
          throw new TypeError("no union variant matched");
        },
      };
    }

    const resolveResult = unionOf(
      obj({ ok: literal(true), mode: oneOf(["fork", "fresh"]), childId: str, oldSessionId: str }),
      obj({ ok: literal(false), error: str }),
    );

    const ackResult = unionOf(
      obj({ ok: literal(true) }),
      obj({ ok: literal(false), error: str }),
    );

    const TYPERT_REMOTE = {
      package: "dsh-message-edit-desktop",
      descriptors: [
        {
          id: "dsh-message-edit-desktop#messageEditDesktop/resolve",
          service: "messageEditDesktop",
          namespace: "messageEditDesktop",
          method: "resolve",
          invocation: { kind: "direct" },
          parameters: [
            { name: "sessionId", wire: "sessionId", source: "json", codec: codec(str) },
            { name: "seq", wire: "seq", source: "json", codec: codec(num) },
            { name: "text", wire: "text", source: "json", codec: codec(str) },
          ],
          result: codec(resolveResult),
        },
        {
          id: "dsh-message-edit-desktop#messageEditDesktop/detach",
          service: "messageEditDesktop",
          namespace: "messageEditDesktop",
          method: "detach",
          invocation: { kind: "direct" },
          parameters: [
            { name: "sessionId", wire: "sessionId", source: "json", codec: codec(str) },
          ],
          result: codec(ackResult),
        },
        {
          id: "dsh-message-edit-desktop#messageEditDesktop/keep",
          service: "messageEditDesktop",
          namespace: "messageEditDesktop",
          method: "keep",
          invocation: { kind: "direct" },
          parameters: [
            { name: "sessionId", wire: "sessionId", source: "json", codec: codec(str) },
          ],
          result: codec(ackResult),
        },
        {
          id: "dsh-message-edit-desktop#messageEditDesktop/remove",
          service: "messageEditDesktop",
          namespace: "messageEditDesktop",
          method: "remove",
          invocation: { kind: "direct" },
          parameters: [
            { name: "sessionId", wire: "sessionId", source: "json", codec: codec(str) },
            { name: "seq", wire: "seq", source: "json", codec: codec(nullable(num)) },
            { name: "messageId", wire: "messageId", source: "json", codec: codec(nullable(str)) },
          ],
          result: codec(resolveResult),
        },
      ],
    };

    const DICTIONARY = {
      en: {
        editMessage: "Edit message",
        copy: "Copy",
        copied: "Copied",
        cancel: "Cancel",
        update: "Update",
        updating: "Updating...",
        rerunHint: "Update reruns this message",
        emptyMessage: "Message cannot be empty",
        editPreserved: "preserved in edit",
        imageAttachment: "Image attachment",
        fileAttachment: "File attachment",
        serviceUnavailable: "Edit service unavailable",
        cannotLocate: "Cannot locate message position",
        resolveError: "Cannot resolve edit boundary",
        switchUnavailable: "This build cannot switch sessions in place",
        switchUnavailable: "This build cannot switch sessions in place",
        switchTimeout: "New session created, but the view could not switch automatically — open it from the sidebar",
        deleteMessage: "Delete message",
        deleteAnswer: "Delete this answer",
        deleteConfirm: "Click again to delete",
        deleting: "Deleting...",
        deleteUserHint: "Deletes this message and everything after it",
        deleteAnswerHint: "Deletes this answer and everything after it, keeping the prompt",
        deleteArmedHint: "This deletes the message and everything after it. Click the trash again to confirm.",
        deleteArmedAnswerHint: "This deletes the answer and everything after it. The prompt is kept. Click again to confirm.",
        deleteError: "Cannot delete this message",
      },
      ru: {
        editMessage: "Редактировать сообщение",
        copy: "Копировать",
        copied: "Скопировано",
        cancel: "Отмена",
        update: "Обновить",
        updating: "Обновление...",
        rerunHint: "Обновление перезапускает это сообщение",
        emptyMessage: "Сообщение не может быть пустым",
        editPreserved: "сохраняется при редактировании",
        imageAttachment: "Изображение",
        fileAttachment: "Файл",
        serviceUnavailable: "Сервис редактирования недоступен",
        cannotLocate: "Не удалось определить позицию сообщения",
        resolveError: "Ошибка определения границы редактирования",
        switchUnavailable: "Эта сборка не умеет переключать сессии на месте",
        switchUnavailable: "Эта сборка не умеет переключать сессии на месте",
        switchTimeout: "Новая сессия создана, но переключиться автоматически не удалось — откройте её в списке сессий",
        deleteMessage: "Удалить сообщение",
        deleteAnswer: "Удалить этот ответ",
        deleteConfirm: "Нажмите ещё раз, чтобы удалить",
        deleting: "Удаление...",
        deleteUserHint: "Удаляет это сообщение и всё, что после него",
        deleteAnswerHint: "Удаляет этот ответ и всё, что после него; запрос сохраняется",
        deleteArmedHint: "Будет удалено сообщение и всё после него. Нажмите на корзину ещё раз для подтверждения.",
        deleteArmedAnswerHint: "Будет удалён ответ и всё после него. Запрос сохранится. Нажмите ещё раз для подтверждения.",
        deleteError: "Не удалось удалить это сообщение",
      },
      zh: {
        editMessage: "编辑消息",
        copy: "复制",
        copied: "已复制",
        cancel: "取消",
        update: "更新",
        updating: "更新中...",
        rerunHint: "点击更新将重新运行这条消息",
        emptyMessage: "消息内容不能为空",
        editPreserved: "编辑时保留",
        imageAttachment: "图片附件",
        fileAttachment: "文件附件",
        serviceUnavailable: "编辑服务不可用",
        cannotLocate: "无法定位消息位置",
        resolveError: "无法确定编辑边界",
        switchUnavailable: "当前版本不支持原地切换会话",
        switchUnavailable: "当前版本不支持原地切换会话",
        switchTimeout: "新会话已创建，但界面未能自动切换——请在左侧会话列表中打开它",
        deleteMessage: "删除消息",
        deleteAnswer: "删除这条回答",
        deleteConfirm: "再次点击确认删除",
        deleting: "删除中...",
        deleteUserHint: "删除这条消息及其之后的所有内容",
        deleteAnswerHint: "删除这条回答及其之后的所有内容，保留提问",
        deleteArmedHint: "将删除这条消息及其之后的所有内容，再次点击垃圾桶图标确认。",
        deleteArmedAnswerHint: "将删除这条回答及其之后的所有内容，提问会保留，再次点击确认。",
        deleteError: "无法删除这条消息",
      },
    };

    let activeLocale = "en";
    function detectLocale(ctx) {
      const supported = Object.keys(DICTIONARY);
      let raw = "";
      try {
        if (ctx && ctx.locale && typeof ctx.locale.active === "string") {
          raw = ctx.locale.active.toLowerCase().trim();
        }
      } catch (_) {}
      if (!raw) {
        try {
          if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
            raw = navigator.language.toLowerCase().trim();
          }
        } catch (_) {}
      }
      if (!raw) return "en";

      if (supported.includes(raw)) return raw;
      const lang = raw.split(/[-_]/)[0];
      if (supported.includes(lang)) return lang;
      return "en";
    }

    function t(key) {
      const dict = DICTIONARY[activeLocale] || DICTIONARY.en;
      return dict[key] || DICTIONARY.en[key] || key;
    }

    function parseContentParts(content) {
      const texts = [];
      const attachments = [];
      if (typeof content === "string") {
        texts.push(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (!block) continue;
          if (block.type === "text" && typeof block.text === "string") {
            texts.push(block.text);
          } else if (block.type === "image" || block.type === "file") {
            attachments.push(block);
          }
        }
      }
      return {
        text: texts.join(""),
        attachments,
      };
    }

    async function writeClipboard(text) {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          // fallback
        }
      }
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        el.remove();
        return ok;
      } catch {
        return false;
      }
    }

    const CopyIcon = () =>
      React.createElement(
        "svg",
        {
          width: 15,
          height: 15,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        React.createElement("rect", { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }),
        React.createElement("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }),
      );

    const PencilIcon = () =>
      React.createElement(
        "svg",
        {
          width: 15,
          height: 15,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        React.createElement("path", { d: "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" }),
      );

    const CheckIcon = () =>
      React.createElement(
        "svg",
        {
          width: 15,
          height: 15,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        React.createElement("polyline", { points: "20 6 9 17 4 12" }),
      );

    // The shell seeds the UI primitives package, so the trash icon and the tooltip
    // can be the app's own; both fall back to a local equivalent when a build does
    // not seed them.
    let primitives = null;
    try {
      primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    } catch (_) {
      primitives = null;
    }

    const TrashIcon = (props) => {
      const Native = primitives && primitives.IconTrashOutlineRegular;
      if (typeof Native === "function") return React.createElement(Native, props);
      return React.createElement(
        "svg",
        {
          width: 15,
          height: 15,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        React.createElement("path", { d: "M3 6h18" }),
        React.createElement("path", { d: "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" }),
        React.createElement("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }),
        React.createElement("path", { d: "M10 11v6" }),
        React.createElement("path", { d: "M14 11v6" }),
      );
    };

    /** Tooltip wrapper: the app's Tooltip when seeded, a `title` attribute otherwise. */
    function tip(label, children) {
      const Tooltip = primitives && primitives.Tooltip;
      if (typeof Tooltip === "function") {
        return React.createElement(Tooltip, { label, side: "bottom" }, children);
      }
      return children;
    }

    const STYLE_ID = "dsh-message-edit-desktop-styles";    function ensureStyles() {
      if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
      const styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        .dsh-me-icon-btn {
          appearance: none;
          border: none;
          background: transparent;
          color: var(--dsw-alias-label-tertiary, #9ca3af);
          width: 28px;
          height: 28px;
          border-radius: var(--dsw-radius-sm, 8px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          padding: 0;
        }
        .dsh-me-icon-btn:hover {
          color: var(--dsw-alias-label-primary, #fff) !important;
          background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.2)) !important;
        }
        .dsh-me-icon-btn[data-armed="true"] {
          color: var(--dsw-alias-state-error-primary, #ef4444) !important;
          background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ef4444) 16%, transparent) !important;
        }
        .dsh-me-icon-btn[data-armed="true"]:hover {
          color: #fff !important;
          background: var(--dsw-alias-state-error-primary, #ef4444) !important;
        }
        .dsh-me-inline-error {
          font-size: 12px;
          line-height: 1.4;
          color: var(--dsw-alias-state-error-primary, #ef4444);
          white-space: nowrap;
          align-self: center;
          max-width: 240px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dsh-me-hint {
          font-size: 12px;
          line-height: 1.5;
          color: var(--dsw-alias-state-error-primary, #ef4444);
          align-self: flex-end;
          text-align: right;
          padding-right: 4px;
          max-width: min(640px, 100%);
        }
        .dsh-me-btn {
          appearance: none;
          border: none;
          height: 28px;
          min-width: 0;
          padding: 0 12px;
          border-radius: 14px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          box-sizing: border-box;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, filter 0.15s ease;
        }
        .dsh-me-btn:disabled {
          cursor: default;
          opacity: 0.55;
        }
        .dsh-me-btn-cancel {
          background: transparent;
          color: var(--dsw-alias-label-secondary, #cfd3d6);
        }
        .dsh-me-btn-cancel:hover:not(:disabled) {
          background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08));
          color: var(--dsw-alias-label-primary, #f9fafb);
        }
        .dsh-me-btn-update {
          background: var(--dsw-alias-button-info-fill, #679efe);
          color: #ffffff;
          font-weight: 600;
        }
        .dsh-me-btn-update:hover:not(:disabled) {
          background: var(--dsw-alias-button-info-hover, #518ef8);
          filter: brightness(1.05);
        }
      `;
      document.head.appendChild(styleEl);
    }

    const style = {
      row: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        minWidth: 0,
        width: "100%",
        position: "relative",
      },
      bubble: {
        maxWidth: "min(640px, 100%)",
        background: "var(--dsw-alias-bg-module-platform, rgba(127,127,127,.14))",
        borderRadius: 20,
        padding: "10px 18px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: "inherit",
        fontSize: 15,
        lineHeight: 1.6,
      },
      actions: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 2,
        paddingRight: 4,
      },
      editBubble: {
        width: "min(640px, 100%)",
        border: "1.5px solid var(--dsw-alias-button-info-fill, #679efe)",
        borderRadius: 24,
        padding: "12px 18px",
        background: "var(--dsw-alias-bg-module-platform, #353638)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      },
      textarea: {
        width: "100%",
        boxSizing: "border-box",
        resize: "none",
        minHeight: 48,
        background: "transparent",
        color: "var(--dsw-alias-label-primary, #f9fafb)",
        border: "none",
        outline: "none",
        fontFamily: "inherit",
        fontSize: 15,
        lineHeight: 1.6,
        padding: 0,
        margin: 0,
      },
      editActionsRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 8,
        paddingRight: 2,
        alignSelf: "flex-end",
      },
      status: {
        fontSize: 12,
        color: "var(--dsw-alias-label-tertiary, #adb2b8)",
        marginTop: 4,
        alignSelf: "flex-end",
        paddingRight: 4,
      },
      error: {
        fontSize: 12,
        color: "var(--dsw-alias-state-error-primary, #ef4444)",
        marginTop: 4,
        alignSelf: "flex-end",
        paddingRight: 4,
        maxWidth: "min(640px, 100%)",
        textAlign: "right",
      },
    };

    function renderAttachmentsList(items, isEditing) {
      if (!items || items.length === 0) return null;
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignSelf: "flex-end",
            marginBottom: 4,
          },
        },
        items.map((block, idx) => {
          const isImg = block.type === "image";
          const att = block.attachment || block;
          const defaultLabel = isImg ? t("imageAttachment") : t("fileAttachment");
          const name = att.name || defaultLabel;
          return React.createElement(
            "span",
            {
              key: idx,
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 12,
                background: "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08))",
                fontSize: 12,
                color: isEditing
                  ? "var(--dsw-alias-button-info-fill, #679efe)"
                  : "var(--dsw-alias-label-secondary, #cfd3d6)",
                border: isEditing ? "1px solid rgba(103,158,254,0.3)" : "1px solid rgba(255,255,255,0.1)",
                maxWidth: 260,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
              title: name + (isEditing ? ` (${t("editPreserved")})` : ""),
            },
            (isImg ? "📷 " : "📄 ") + name + (isEditing ? " ✓" : ""),
          );
        }),
      );
    }

    /**
     * Run one host rewrite (edit or delete) and move the view to the session it
     * created. A full page navigation is intentionally never used here: the switch
     * goes through the client's workspace service, and a failed switch keeps the
     * superseded session instead of archiving it underfoot.
     *
     * @param options.invoke - the host call producing the child session
     * @param options.openSession - in-place session reveal
     * @param options.keep - tells the host the superseded session must survive
     * @param options.detach - archives the superseded session after the switch
     * @param options.sessionId - the session being rewritten
     * @returns `{ ok: true }` or `{ ok: false, error }`
     */
    async function runRewrite({ invoke, openSession, keep, detach, sessionId }) {
      let oldSessionId = null;
      let switched = false;
      try {
        const result = await invoke();
        if (!result || result.ok !== true || result.value === undefined) {
          const detail = result && result.error;
          throw new Error((detail && (detail.message || detail)) || t("resolveError"));
        }
        const outcome = result.value;
        if (outcome.ok !== true) throw new Error(outcome.error || t("resolveError"));

        const childId = outcome.childId;
        if (!childId) throw new Error(t("resolveError"));
        oldSessionId = outcome.oldSessionId || sessionId;

        if (typeof openSession !== "function") throw new Error(t("switchUnavailable"));
        await openSession(childId);
        switched = true;
      } catch (error) {
        if (oldSessionId && typeof keep === "function") {
          try {
            await keep(oldSessionId);
          } catch (_) {}
        }
        return { ok: false, error: String((error && error.message) || error) };
      }

      // The superseded session is archived only after the view actually moved.
      if (switched && oldSessionId && typeof detach === "function") {
        detach(oldSessionId).catch(() => {});
      }
      return { ok: true };
    }

    function MessageEditUserNode(props) {
      const node = props.node;
      const sessionId = props.sessionId;
      const resolve = props.resolve;
      const remove = props.remove;
      const detach = props.detach;
      const keep = props.keep;
      const openSession = props.openSession;

      const content = node && node.data && node.data.content;
      const { text, attachments } = parseContentParts(content);

      const targetSeq =
        node && typeof node.anchorSeq === "number"
          ? node.anchorSeq
          : node && node.data && typeof node.data.seq === "number"
            ? node.data.seq
            : null;

      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft] = React.useState(text);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [copied, setCopied] = React.useState(false);
      const [armed, setArmed] = React.useState(false);
      const textareaRef = React.useRef(null);
      const mounted = React.useRef(true);
      const copyTimer = React.useRef(null);
      const deleteTimer = React.useRef(null);

      React.useEffect(
        () => () => {
          mounted.current = false;
          if (copyTimer.current !== null) {
            window.clearTimeout(copyTimer.current);
            copyTimer.current = null;
          }
          if (deleteTimer.current !== null) {
            window.clearTimeout(deleteTimer.current);
            deleteTimer.current = null;
          }
        },
        [],
      );

      React.useEffect(() => {
        setDraft(text);
      }, [text]);

      React.useEffect(() => {
        if (editing && textareaRef.current) {
          const ta = textareaRef.current;
          ta.style.height = "auto";
          ta.style.height = ta.scrollHeight + "px";
          ta.focus();
          const len = ta.value.length;
          ta.setSelectionRange(len, len);
        }
      }, [editing]);

      const handleInput = (e) => {
        const val = e.target.value;
        setDraft(val);
        e.target.style.height = "auto";
        e.target.style.height = e.target.scrollHeight + "px";
      };

      const copy = async () => {
        if (copied || copyTimer.current !== null) return;
        const ok = await writeClipboard(text);
        if (!mounted.current || !ok) return;
        setCopied(true);
        copyTimer.current = window.setTimeout(() => {
          copyTimer.current = null;
          if (mounted.current) setCopied(false);
        }, 1200);
      };

      const begin = () => {
        disarmDelete();
        setError(null);
        setDraft(text);
        setEditing(true);
      };

      const cancel = () => {
        setError(null);
        setDraft(text);
        setEditing(false);
      };

      // Update is always available: submitting the unchanged text simply reruns it.
      const confirmEdit = async () => {
        if (busy) return;
        const next = draft;
        if (typeof next !== "string" || next.trim() === "") {
          setError(t("emptyMessage"));
          return;
        }
        if (typeof targetSeq !== "number") {
          setError(t("cannotLocate"));
          return;
        }
        if (!resolve) {
          setError(t("serviceUnavailable"));
          return;
        }

        setBusy(true);
        setError(null);
        const result = await runRewrite({
          invoke: () => resolve(targetSeq, next),
          openSession,
          keep,
          detach,
          sessionId,
        });
        if (!mounted.current) return;
        setBusy(false);
        if (!result.ok) setError(result.error || t("resolveError"));
      };

      const disarmDelete = () => {
        if (deleteTimer.current !== null) {
          window.clearTimeout(deleteTimer.current);
          deleteTimer.current = null;
        }
        setArmed(false);
      };

      const armDelete = () => {
        if (busy) return;
        setError(null);
        setArmed(true);
        if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
        deleteTimer.current = window.setTimeout(() => {
          deleteTimer.current = null;
          if (mounted.current) setArmed(false);
        }, 5000);
      };

      // Deleting rewrites the history: the message and everything after it are cut
      // away and the view moves to the truncated session.
      const confirmDelete = async () => {
        if (busy) return;
        disarmDelete();
        if (typeof targetSeq !== "number") {
          setError(t("cannotLocate"));
          return;
        }
        if (typeof remove !== "function") {
          setError(t("serviceUnavailable"));
          return;
        }

        setBusy(true);
        setError(null);
        const result = await runRewrite({
          invoke: () => remove(sessionId, targetSeq, null),
          openSession,
          keep,
          detach,
          sessionId,
        });
        if (!mounted.current) return;
        setBusy(false);
        if (!result.ok) setError(result.error || t("deleteError"));
      };

      if (editing) {
        return React.createElement(
          "div",
          { style: style.row },
          renderAttachmentsList(attachments, true),
          React.createElement(
            "div",
            { style: style.editBubble },
            React.createElement("textarea", {
              ref: textareaRef,
              style: style.textarea,
              value: draft,
              disabled: busy,
              onChange: handleInput,
              onKeyDown: (e) => {
                if (e.key === "Enter" && e.shiftKey) return;
                if (e.key === "Enter") {
                  // ignore enter while IME composition is active (cjk input)
                  if (e.nativeEvent && e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  confirmEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  if (!busy) cancel();
                }
              },
            }),
          ),
          React.createElement(
            "div",
            { key: "edit-actions", style: style.editActionsRow },
            React.createElement(
              "button",
              {
                key: "btn-cancel",
                type: "button",
                className: "dsh-me-btn dsh-me-btn-cancel",
                disabled: busy,
                onClick: cancel,
              },
              t("cancel"),
            ),
            React.createElement(
              "button",
              {
                key: "btn-update",
                type: "button",
                className: "dsh-me-btn dsh-me-btn-update",
                title: t("rerunHint"),
                disabled: busy,
                onClick: confirmEdit,
              },
              busy ? t("updating") : t("update"),
            ),
          ),
          error ? React.createElement("div", { key: "err", style: style.error }, error) : null,
        );
      }

      return React.createElement(
        "div",
        {
          style: style.row,
          onMouseEnter: (e) => {
            const actions = e.currentTarget.querySelector(".dsh-me-actions");
            if (actions) actions.style.opacity = "1";
          },
          onMouseLeave: (e) => {
            const actions = e.currentTarget.querySelector(".dsh-me-actions");
            if (actions) actions.style.opacity = "0.4";
          },
        },
        renderAttachmentsList(attachments, false),
        React.createElement("div", { key: "bubble", style: style.bubble }, text),
        React.createElement(
          "div",
          {
            key: "normal-actions",
            className: "dsh-me-actions",
            style: { ...style.actions, opacity: 0.4, transition: "opacity 0.15s ease" },
          },
          React.createElement(
            "button",
            {
              key: "btn-copy",
              type: "button",
              className: "dsh-me-icon-btn",
              title: copied ? t("copied") : t("copy"),
              onClick: copy,
            },
            copied ? React.createElement(CheckIcon) : React.createElement(CopyIcon),
          ),
          React.createElement(
            "button",
            {
              key: "btn-pencil",
              type: "button",
              className: "dsh-me-icon-btn",
              title: t("editMessage"),
              onClick: (e) => {
                if (e.currentTarget && typeof e.currentTarget.blur === "function") {
                  e.currentTarget.blur();
                }
                begin();
              },
            },
            React.createElement(PencilIcon),
          ),
          React.createElement(
            "button",
            {
              key: "btn-delete",
              type: "button",
              className: "dsh-me-icon-btn",
              "data-armed": armed ? "true" : undefined,
              title: busy ? t("deleting") : armed ? t("deleteConfirm") : t("deleteMessage"),
              "aria-label": armed ? t("deleteConfirm") : t("deleteMessage"),
              disabled: busy,
              onClick: armed ? confirmDelete : armDelete,
            },
            React.createElement(TrashIcon),
          ),
        ),
        armed
          ? React.createElement(
              "div",
              { key: "delete-hint", className: "dsh-me-hint" },
              t("deleteArmedHint"),
            )
          : null,
        !armed && error
          ? React.createElement("div", { key: "err", style: style.error }, error)
          : null,
      );
    }

    /**
     * Delete entry rendered in the assistant action strip, right of the built-in
     * copy / branch icons. It only knows the message id, so the host resolves the
     * position from the session log.
     */
    function MessageDeleteAction(props) {
      const sessionId = props.sessionId;
      const messageId = props.messageId;
      const remove = props.remove;
      const detach = props.detach;
      const keep = props.keep;
      const openSession = props.openSession;

      const [armed, setArmed] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const mounted = React.useRef(true);
      const armTimer = React.useRef(null);

      React.useEffect(
        () => () => {
          mounted.current = false;
          if (armTimer.current !== null) {
            window.clearTimeout(armTimer.current);
            armTimer.current = null;
          }
        },
        [],
      );

      const disarm = () => {
        if (armTimer.current !== null) {
          window.clearTimeout(armTimer.current);
          armTimer.current = null;
        }
        setArmed(false);
      };

      const arm = () => {
        if (busy) return;
        setError(null);
        setArmed(true);
        if (armTimer.current !== null) window.clearTimeout(armTimer.current);
        armTimer.current = window.setTimeout(() => {
          armTimer.current = null;
          if (mounted.current) setArmed(false);
        }, 5000);
      };

      const confirm = async () => {
        if (busy) return;
        disarm();
        if (typeof remove !== "function" || typeof messageId !== "string" || messageId === "") {
          setError(t("deleteError"));
          return;
        }

        setBusy(true);
        setError(null);
        const result = await runRewrite({
          invoke: () => remove(sessionId, null, messageId),
          openSession,
          keep,
          detach,
          sessionId,
        });
        if (!mounted.current) return;
        setBusy(false);
        if (!result.ok) setError(result.error || t("deleteError"));
      };

      const label = busy ? t("deleting") : armed ? t("deleteConfirm") : t("deleteAnswer");
      return React.createElement(
        React.Fragment,
        null,
        tip(
          label,
          React.createElement(
            "button",
            {
              type: "button",
              className: "dsh-me-icon-btn",
              "data-armed": armed ? "true" : undefined,
              "aria-label": armed ? t("deleteConfirm") : t("deleteAnswer"),
              title: label,
              disabled: busy,
              onClick: armed ? confirm : arm,
            },
            React.createElement(TrashIcon),
          ),
        ),
        error ? React.createElement("span", { className: "dsh-me-inline-error" }, error) : null,
      );
    }

    const sleep = (ms) => new Promise((resolveSleep) => window.setTimeout(resolveSleep, ms));

    function safeGet(ctx, name) {
      try {
        return ctx.get(name);
      } catch (_) {
        return undefined;
      }
    }

    /**
     * In-place session switching. The child session is created by the host; this
     * navigates the client's main view to it through `uiWorkspace.openSession`,
     * retrying while the session list catches up. It never falls back to
     * `window.location` (a whole-page reload) — on failure it reports and leaves
     * the caller free to show an error.
     */
    function createSessionRevealer(ctx) {
      const services = { uiWorkspace: undefined, sessions: undefined };

      try {
        ctx.inject(["sessions", "uiWorkspace"], (scope) => {
          services.uiWorkspace = scope.get("uiWorkspace");
          services.sessions = scope.get("sessions");
          return () => {
            services.uiWorkspace = undefined;
            services.sessions = undefined;
          };
        });
      } catch (_) {
        // Older client runtimes: fall back to lazy ctx.get on every attempt.
      }

      const uiWorkspaceOf = () => services.uiWorkspace || safeGet(ctx, "uiWorkspace");
      const sessionsOf = () => services.sessions || safeGet(ctx, "sessions");

      const isKnown = (childId) => {
        const sessions = sessionsOf();
        try {
          const snapshot = sessions && sessions.list && sessions.list.getSnapshot();
          return !!(snapshot && snapshot.byId && snapshot.byId[childId] !== undefined);
        } catch (_) {
          return false;
        }
      };

      return async function openSession(childId) {
        if (typeof childId !== "string" || childId === "") throw new Error(t("switchTimeout"));
        const startedAt = Date.now();
        const knownDeadline = startedAt + 4000;
        const deadline = startedAt + 12000;
        let lastError = null;
        let sawWorkspace = false;

        while (Date.now() < deadline) {
          const uiWorkspace = uiWorkspaceOf();
          if (uiWorkspace && typeof uiWorkspace.openSession === "function") {
            sawWorkspace = true;
            // Prefer opening once the client session list reports the child, so
            // `sessions.retain` resolves it; afterwards try anyway and let the
            // call itself decide.
            if (isKnown(childId) || Date.now() > knownDeadline) {
              try {
                uiWorkspace.openSession(childId);
                return true;
              } catch (error) {
                lastError = error;
              }
            }
          }
          await sleep(120);
        }

        if (!sawWorkspace) throw new Error(t("switchUnavailable"));
        if (lastError && lastError.message) {
          console.warn("message-edit-desktop: session switch failed", lastError);
        }
        throw new Error(t("switchTimeout"));
      };
    }

    const inject = ["slots", "remote"];

    async function apply(ctx) {
      ensureStyles();
      activeLocale = detectLocale(ctx);
      const openSession = createSessionRevealer(ctx);

      try {
        if (ctx && ctx.locale && typeof ctx.locale.subscribe === "function") {
          ctx.effect(() => {
            return ctx.locale.subscribe(() => {
              activeLocale = detectLocale(ctx);
            });
          }, "message-edit-desktop: locale");
        }
      } catch (_) {}

      let remote = undefined;
      try {
        const dispose = await ctx.remote.$mount(TYPERT_REMOTE);
        remote = ctx.get("remote.messageEditDesktop");
        ctx.effect(() => async () => {
          remote = undefined;
          await dispose();
        }, "message-edit-desktop: remote");
      } catch (err) {
        console.error("message-edit-desktop: remote mount failed", err);
      }

      const api = () => {
        const r = remote || ctx.get("remote.messageEditDesktop");
        if (r === undefined) throw new Error("messageEditDesktop remote is not mounted yet");
        return r;
      };

      const registerChatNode = (key) =>
        ctx.slots.inject(
          "conversation.chat.node",
          () =>
            ctx.slots.register(
              {
                name: "conversation.chat.node",
                key,
                // Lowest priority renders: this shadows the built-in renderer (0)
                // and any other edit plugin registered above it.
                priority: -2,
                inject: (sessionId) => ({
                  sessionId,
                  resolve: (seq, text) => api().resolve(sessionId, seq, text),
                  remove: (sid, seq, messageId) => api().remove(sid, seq, messageId),
                  detach: (sid) => api().detach(sid),
                  keep: (sid) => api().keep(sid),
                  openSession,
                }),
              },
              MessageEditUserNode,
            ),
        );

      registerChatNode("user");
      registerChatNode("steering");

      // Assistant answers: one delete entry in the built-in action strip, so it
      // sits right of the copy / branch icons the same way the row's delete sits
      // right of the pencil.
      ctx.slots.inject(
        "conversation.chat.assistant-actions",
        () =>
          ctx.slots.register(
            {
              name: "conversation.chat.assistant-actions",
              id: "message-edit-delete",
              order: 20,
              inject: (sessionId) => ({
                sessionId,
                remove: (sid, seq, messageId) => api().remove(sid, seq, messageId),
                detach: (sid) => api().detach(sid),
                keep: (sid) => api().keep(sid),
                openSession,
              }),
            },
            MessageDeleteAction,
          ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
