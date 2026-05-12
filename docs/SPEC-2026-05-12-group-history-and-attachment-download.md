# Spec — Group History Backfill + Attachment Download

**Date:** 2026-05-12
**Status:** Approved design; ready for implementation.
**Library target:** Baileys 7.0.0-rc.9 (current pin in `package.json`).

## Background

The CLI side of `wa-cli-mcp` already handles both capabilities:

- **Media download:** `src/messages/media.ts → downloadMedia()` writes to `~/.config/wa-cli-mcp/downloads/`. Used by CLI commands `read`, `read-group`, `fetch-history` when invoked with `--media`.
- **History backfill:** `src/commands/fetch-history.ts` calls `sock.fetchMessageHistory()` for 1:1 chats. JID resolution is phone-only.

The MCP server (`src/mcp-server.ts`) currently does not expose either:

- `whatsapp_read` and `whatsapp_read_group` return JSON metadata only. No media bytes reach disk via the MCP path.
- `whatsapp_fetch_history` exists for phone JIDs only. No group equivalent.

Use case driving this work: a Claude Code agent reads a group thread, pulls a PDF / image / voice note shared in it, and processes the bytes (e.g., ingests a founder's pitch deck into the KG). Today this requires manual download from the WhatsApp app.

## Scope

Two new MCP tools. No changes to existing tools.

### 1. `whatsapp_download_attachment` *(new)*

Download the media bytes for one specific message and return the on-disk file path.

```ts
inputSchema: z.object({
  messageId: z.string()
    .describe("WhatsApp message key.id"),
  jid: z.string().optional()
    .describe(
      "Chat JID (group or phone). Optional if messageId is globally unique " +
      "in the current store; required to disambiguate otherwise."
    ),
})
```

**Behavior:**

- Look up `WAMessage` in the existing `MessageStore` by `key.id` (and `jid` if provided).
- If found and `getMediaType(msg)` returns a media type:
  - Call `downloadMedia(msg)`.
  - Return `{ success: true, filePath, mimeType, mediaType, fileName }`.
- If found but no media:
  - Return `{ success: false, error: "message has no media" }`.
- If not found:
  - Return `{ success: false, error: "message not in store; try whatsapp_read or whatsapp_fetch_history first" }`.

**Security:**

- Output path is always under `~/.config/wa-cli-mcp/downloads/` (already chmod 0o700 by `downloadMedia()`).
- Never accept a caller-supplied output path. Phishing / overwrite risk.

**Implementation note:** `MessageStore` may need a `getMessageById(messageId, jid?)` lookup helper. Check `src/messages/reader.ts` before writing a new one; if a similar lookup exists, reuse it.

### 2. `whatsapp_fetch_group_history` *(new)*

Group equivalent of the existing `whatsapp_fetch_history` tool.

```ts
inputSchema: z.object({
  groupName: z.string()
    .describe("Group name (substring match) or full JID"),
  count: z.number().min(1).max(500).default(50)
    .describe("Number of messages to fetch (max 500, fetched in batches of 50)"),
})
```

**Behavior:** Near-clone of `whatsapp_fetch_history`. Resolves JID via `resolveGroup(sock, groupName)` instead of `resolveJids()`. Same batches-of-50 semantics, same async history-sync delivery, same follow-up note instructing the caller to call `whatsapp_read_group` in a few seconds.

**Returns:**

```json
{
  "success": true,
  "batchesSent": <number>,
  "requestIds": [...],
  "note": "<N> history request(s) sent for <count> messages. Call whatsapp_read_group in a few seconds to see the results."
}
```

## Read tools (`whatsapp_read`, `whatsapp_read_group`) — no change

Considered adding a `download_media: bool` flag to mirror the CLI `--media` behavior, but rejected. Reasons:

- Auto-downloading every attachment on every read is expensive (network + disk + decryption).
- Agents reading a 100-message group thread should not be implicitly pulling 100 attachments.
- Explicit `whatsapp_download_attachment` gives the agent per-message decision control after inspecting metadata.

Agents that want CLI parity can run two calls: `whatsapp_read_group` to list, then per-message `whatsapp_download_attachment` for the attachments worth keeping.

## Out of scope (explicit non-goals)

- **Pre-startup history that has never been seen.** WhatsApp's history sync only delivers messages received after the MCP server started. `fetchMessageHistory()` digs backward from messages already in the store but cannot surface chats that have never appeared in this session. This is a Baileys / WhatsApp protocol limit, not addressable here.
- **Group admin operations** — create, leave, rename, member changes.
- **Reactions or read receipts on attachments.**
- **Inline thumbnails or preview generation.** The downloaded file is the deliverable.

## Acceptance criteria

1. From Claude Code: `whatsapp_read_group("…group…", limit=20)` followed by `whatsapp_download_attachment(messageId="…")` produces a file at `~/.config/wa-cli-mcp/downloads/<type>_<timestamp>.<ext>` that the assistant can subsequently `Read` natively.
2. `whatsapp_fetch_group_history("…group…", count=200)` triggers 4 backfill batches; a follow-up `whatsapp_read_group` after a few seconds returns older messages.
3. All 17 existing MCP tools continue to work unchanged.
4. The MCP server still writes only inside `~/.config/wa-cli-mcp/`.
5. `README.md` updated with one short paragraph per new tool (under the existing MCP tools list).
6. New unit tests in `tests/` for:
   - `whatsapp_download_attachment` success path (mocked `WAMessage` with media + mocked `downloadMedia` writing a stub file).
   - `whatsapp_download_attachment` "not in store" error path.
   - `whatsapp_download_attachment` "no media" error path.
   - `whatsapp_fetch_group_history` success path (mocked `sock.fetchMessageHistory`).

## Implementation pointers

Files likely touched:

- `src/mcp-server.ts` — register two new tools next to lines 198 (`whatsapp_fetch_history`) and 376 (`whatsapp_read_group`).
- `src/messages/reader.ts` — may need `MessageStore.getMessageById()`. Check first.
- `src/messages/media.ts` — likely no changes (already returns file path).
- `tests/mcp-server.test.ts` (or wherever existing MCP tests live) — add new tool tests.
- `README.md` — short doc updates.

No new dependencies required.

## Risks

- **Message ID collision across chats.** `key.id` is generated by WhatsApp and is unique per-chat, not globally. If the store is large and `jid` isn't supplied, the lookup may match the wrong message. Mitigation: when `jid` is omitted and multiple matches exist, return `{ success: false, error: "messageId is ambiguous; please pass jid to disambiguate", candidates: [...] }`.
- **Large media downloads can block the MCP event loop.** `downloadMedia` already uses streams. Confirm during implementation that the MCP handler awaits the stream completion before returning.
- **Decryption errors on old messages.** Baileys occasionally fails to decrypt media after long delays. Tool should return a clear `{ success: false, error: "decryption failed; message may be too old" }` rather than hanging or throwing.
