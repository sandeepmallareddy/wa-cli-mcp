---
name: using-wa-cli
description: Use when sending or reading WhatsApp messages from the terminal in the wa-cli-mcp repo — covers the one-time QR auth, every `wa` subcommand and its flags, the 8-character short-message-ID convention, the single-Baileys-connection constraint that conflicts with the MCP server, and recovery from non-deterministic history sync.
---

# Using the `wa` CLI

The `wa` CLI (entry point `src/index.ts`) talks to WhatsApp via Baileys' Linked Devices protocol. It shares its auth state at `~/.config/wa-cli-mcp/auth_state/` with the MCP server in `src/mcp-server.ts` — **only one can hold the WhatsApp socket at a time**.

Each `wa <command>` opens a short-lived socket, runs once, and exits. For real-time chat or to keep a connection warm, use `wa repl` instead.

## Setup (once per machine)

```bash
npm install
npx tsx src/index.ts auth   # scan QR with phone → Settings → Linked Devices
```

Optional alias (recommended):

```bash
alias wa="npx tsx /absolute/path/to/wa-cli-mcp/src/index.ts"
```

All examples below assume the alias is set. Substitute `npx tsx src/index.ts` if not.

## Critical constraint — never run two connections

Baileys only supports one active socket per linked device. If the MCP server (`src/mcp-server.ts`) is connected and you run a CLI command, the Signal session keys corrupt and produce `Bad MAC` errors, forcing a re-scan. Before running CLI commands programmatically, check the lock file:

```bash
[ -f ~/.config/wa-cli-mcp/mcp-server.lock ] && echo "MCP is running — stop it first" && exit 1
```

If corruption already happened:

```bash
rm -rf ~/.config/wa-cli-mcp/auth_state/
npx tsx src/index.ts auth   # re-scan
```

## Command reference

Phone numbers: `+<country><number>`, validated against `^\+?\d{7,15}$`. Non-digit characters are stripped automatically.

| Command | Purpose |
|---|---|
| `wa auth` | Scan QR, link the WhatsApp account |
| `wa send <phone> "text"` | Send a text message |
| `wa send <phone> --file <path> [-m\|--message "caption"]` | Send media (image / video / document / voice note — type sniffed from extension: `.jpg/.png/.webp` → image, `.mp4` → video, `.ogg` → voice note (`ptt:true`), other audio → audio, everything else → document) |
| `wa send <phone> --reply <id> "text"` | Quote-reply to a message |
| `wa send <phone> --react <id> "👍"` | React with an emoji |
| `wa send <phone> --edit <id> "new text"` | Edit a message you sent |
| `wa send <phone> --delete <id>` | Delete for everyone. Only works on **messages you sent**, and only within WhatsApp's delete-for-everyone time window (currently ~2 days). After that, the command appears to succeed but the message stays on recipients' devices. |
| `wa read <phone> [--last N] [--media]` | Read last N messages (default 20). `--media` also downloads attachments. The MCP tools enforce a `limit ≤ 100`; the CLI accepts higher values but is constrained by what was synced |
| `wa fetch-history <phone> --last N [--media]` | Pull older messages from a 1:1 contact, beyond what was synced on connect (batches of 50). **Contact-only — no CLI equivalent exists for groups.** For group backfill, use the MCP tool `whatsapp_fetch_group_history` or stay connected with `wa repl` and let history sync deliver naturally |
| `wa forward <from-phone> <id> <to>` | Forward a message. `<to>` may be a phone, JID, or group name |
| `wa groups` | List all groups with JIDs and member counts |
| `wa send-group <name> "text"` or `--file <path>` | Send to a group by case-insensitive substring match on group name |
| `wa read-group <name> [--last N] [--media]` | Read group messages |
| `wa repl` | Interactive prompt — incoming messages stream live; full command set available at `wa>` |

`<id>` is the **8-character short message ID** printed in parentheses by `wa read` / `wa read-group`, e.g.:

```
[2026-05-12 09:14] (a1b2c3d4) +14155551234: Hey
                    ^^^^^^^^
                    this is <id>
```

Short IDs are matched as a suffix on `key.id` and require ≥4 chars to avoid accidental collisions.

## Common gotchas

- **History sync is non-deterministic.** If `wa read` returns 0 messages or fewer than expected, retry up to 3 times before assuming the contact has no history. **Wait ~5 seconds between retries** so WhatsApp's incremental history sync can deliver more batches and the LID cache can populate. If retries still don't give enough history, use `wa fetch-history <phone> --last N` to explicitly request older messages — it works on a cold socket (doesn't require a prior `wa read`) as long as at least one message for that contact arrived during the current sync.
- **Linked IDs (LIDs).** Incoming messages may be stored under a `@lid` JID rather than `@s.whatsapp.net`. The CLI handles this transparently via two-stage LID resolution (`src/utils/phone.ts:resolveJids`), but the LID cache populates lazily — early reads after a fresh connect can miss messages that show up a few seconds later.
- **Group name resolution.** Case-insensitive substring match. `"fam"` matches `"Family Chat"`. Throws with a "multiple groups match" error if the substring is ambiguous — use a longer name or the full `<id>@g.us` JID.
- **Blocked file paths.** `validateFilePath` in `src/messages/sender.ts` rejects: anything under `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/wa-cli-mcp/auth_state/`, and any file named `.env*`, `creds.json`, `id_rsa`, `id_ed25519`, `id_ecdsa`, `id_dsa`, `.npmrc`, `.pypirc`, `token`, or `secret`. These checks run on the resolved real path, so symlinks don't bypass them.
- **64 MB cap** on media — WhatsApp's own limit.
- **Each command exits the process.** Don't chain `wa send +91... "hi" && wa read +91...` expecting a shared store — the second invocation opens a fresh socket and resyncs.

## When to prefer the MCP server instead

If the user is conversationally asking an AI assistant to handle WhatsApp ("check my messages", "send Alice a note"), prefer the MCP tools (`whatsapp_*`) — the server stays connected, exposes 18 structured tools, and supports subscription-based notifications. Only shell out to `wa` when the user explicitly wants a terminal command, a one-off script, or the MCP server isn't running.
