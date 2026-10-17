# dsh-message-edit-desktop

in-place message editing for DeepSeek Harness / DSH Desktop

hover any of your messages, click the pencil, edit the text, press **更新** — the
history is rewritten before that turn and the new prompt starts running right away,
**without reloading the page**.

## features

* **seamless update:** the view switches to the new branch in place (`uiWorkspace.openSession`)
  — no full-page reload, no lost scroll position, no flash
* **always clickable update:** even with unchanged text the update button stays
  enabled — clicking it simply reruns that message (regenerate)
* **compact buttons:** the cancel / update pair is sized for the edit box instead of
  the composer (28 px tall)
* **in-place edit:** tweak any past message directly in chat
* **clean branch:** forks history at the target turn // no ghost turns, no corrupted logs
* **keeps attachments:** images and files survive the edit intact
* **auto-archive:** superseded sessions are tucked away into the archive so the sidebar stays clean
* **safe failure:** if the view cannot switch automatically, the superseded session is
  kept (not archived underfoot) and the error is shown inline
* **dsh-native:** blends with the active dark/light theme tokens
* **ime-safe:** won't submit while picking pinyin / kanji characters
* **multilingual:** en // zh // ru auto-detected

## shortcuts

* `Enter` // submit (reruns when the text is unchanged)
* `Shift + Enter` // new line
* `Ctrl + Enter` // quick submit
* `Escape` // cancel

## install (DSH Desktop)

1. open the plugin manager in DSH Desktop and import this folder (`main/`)
2. make sure `dsh-message-edit-desktop` is enabled
3. restart / reload the client once (the plugin bundle is served to the browser client)

The package name is deliberately distinct from the marketplace's `dsh-message-edit`
and `dsh-plugin-message-edit`: it owns the `messageEditDesktop` service and
namespace, so it can coexist with either of them without clashing. If you keep both
installed, only the lowest slot priority renders the editor — this one registers at
`-2`, so its editor wins over the built-in renderer (`0`) and over
`dsh-prompt-edit` (`-1`).

## how it works

1. cuts the session history right before the edited turn
2. spawns a clean child session with your updated message and attachments
3. reveals the child session in place through the client's workspace service
4. archives the old session branch once the view has moved

## license

MIT
