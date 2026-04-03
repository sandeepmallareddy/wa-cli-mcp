# wa - WhatsApp CLI + MCP Server

A command-line tool and MCP server to interact with your WhatsApp account programmatically. Send and receive messages, media, reactions, and more — from your terminal or through Claude Code.

Built with [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web API) and TypeScript.

## What Can It Do?

- **Send messages** — text, images, videos, documents, voice notes
- **Read messages** — view conversation history with any contact
- **Reply & React** — quote-reply to messages, add emoji reactions
- **Edit & Delete** — modify or remove sent messages
- **Forward** — forward messages to other contacts or groups
- **Groups** — list groups, send/read group messages
- **Interactive REPL** — stay connected, chat in real-time, see incoming messages live
- **MCP Server** — 16 structured tools for Claude Code integration with subscription-based notifications

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- **A WhatsApp account** with the WhatsApp app on your phone
- **npm** (comes with Node.js)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/sandeepmallareddy/wa-cli-mcp.git
cd wa-cli-mcp
npm install
```

### 2. Authenticate with WhatsApp

```bash
npx tsx src/index.ts auth
```

A QR code will appear in your terminal. To scan it:

1. Open **WhatsApp** on your phone
2. Go to **Settings > Linked Devices > Link a Device**
3. Point your camera at the QR code in the terminal

Once scanned, you'll see "Authenticated successfully!" and the session is saved. You won't need to scan again unless you log out.

### 3. Test it

```bash
npx tsx src/index.ts send +1234567890 "Hello from the terminal!"
```

Replace `+1234567890` with an actual phone number (with country code).

## CLI Usage

All commands use the format:

```bash
npx tsx src/index.ts <command> [arguments] [options]
```

> **Tip:** Create an alias: `alias wa="npx tsx /path/to/wa-cli-mcp/src/index.ts"` and then just use `wa send ...`, `wa read ...`, etc.

---

### Send a Text Message

```bash
wa send +1234567890 "Hello!"
```

### Send Media (Image, Video, Document, Voice Note)

```bash
wa send +1234567890 --file ./photo.jpg -m "Check this out"   # Image with caption
wa send +1234567890 --file ./report.pdf                       # Document
wa send +1234567890 --file ./voice.ogg                        # Voice note
```

The CLI auto-detects the file type and sends it appropriately.

### Read Messages from a Contact

```bash
wa read +1234567890                    # Last 20 messages (default)
wa read +1234567890 --last 50          # Last 50 messages
wa read +1234567890 --media            # Download media files too
```

Messages display like this:

```
[2026-04-03 10:15] (a1b2c3d4) +1234567890: Hey, how's it going?
[2026-04-03 10:16] (e5f6g7h8) You: All good!
[2026-04-03 10:17] (i9j0k1l2) +1234567890: 📎 image "vacation pic" (saved: downloads/image_1712134560.jpg)
```

The 8-character code in parentheses (e.g., `a1b2c3d4`) is the **message ID** — you'll need it for reply, react, edit, delete, and forward.

> **Note:** `read` shows messages from the in-memory store. Chat history is synced automatically on connection (may take a few seconds). For real-time message viewing, use `repl` mode.

### Fetch Older Messages

```bash
wa fetch-history +1234567890               # Fetch 50 older messages (default)
wa fetch-history +1234567890 --last 200    # Fetch 200 older messages
wa fetch-history +1234567890 --last 100 --media  # Fetch and download media
```

Fetches messages beyond what was synced on connect. Pulls in batches of 50 from WhatsApp's servers.

### Reply, React, Edit, Delete, Forward

```bash
wa send +1234567890 --reply a1b2c3d4 "Got it, thanks!"    # Quote-reply
wa send +1234567890 --react a1b2c3d4 "👍"                  # React with emoji
wa send +1234567890 --edit e5f6g7h8 "Corrected text here"  # Edit sent message
wa send +1234567890 --delete e5f6g7h8                       # Delete for everyone
wa forward +1234567890 a1b2c3d4 +9876543210                # Forward to contact
wa forward +1234567890 a1b2c3d4 "EQ Updates"               # Forward to group
```

---

## Groups

```bash
wa groups                                        # List all groups
wa send-group "Family" "Dinner at 7!"            # Send to group by name
wa send-group "Work Team" --file ./slides.pdf    # Send media to group
wa read-group "Family" --last 10                 # Read group messages
```

Group messages show who sent them:

```
[2026-04-03 10:15] (a1b2c3d4) Mom (+1234567890): Dinner at 7 tonight!
[2026-04-03 10:16] (e5f6g7h8) You: Sounds good!
```

---

## Interactive Mode (REPL)

```bash
wa repl
```

Stays connected. Incoming messages appear in real-time. All commands available at the `wa>` prompt:

```
wa> send +1234567890 "Hello"
wa> read +1234567890 --last 10
wa> react +1234567890 a1b2c3d4 👍
wa> reply +1234567890 a1b2c3d4 "Thanks!"
wa> edit +1234567890 e5f6g7h8 "Corrected text"
wa> delete +1234567890 e5f6g7h8
wa> forward +1234567890 a1b2c3d4 +9876543210
wa> groups
wa> send-group "Family" "Hello everyone!"
wa> read-group "Family" --last 10
wa> help
wa> exit
```

---

## Claude Code Integration (MCP Server)

This project includes an MCP (Model Context Protocol) server that lets Claude Code interact with WhatsApp through 16 structured tools. The server maintains a persistent WhatsApp connection and supports subscription-based notifications.

### Quick Setup

1. **Authenticate first** (if you haven't already):

```bash
cd /path/to/wa-cli-mcp
npx tsx src/index.ts auth
```

2. **Add the MCP server** (one command):

```bash
claude mcp add wa-cli-mcp -- npx tsx /absolute/path/to/wa-cli-mcp/src/mcp-server.ts
```

3. **Restart Claude Code.** The WhatsApp tools will be auto-discovered.

### Available Tools

| Tool | Description |
|------|-------------|
| `whatsapp_me` | Get linked account info (phone number, name) |
| `whatsapp_send` | Send text message |
| `whatsapp_send_media` | Send image/video/doc/voice note |
| `whatsapp_read` | Read messages from a contact (includes history synced on connect; does not require a subscription) |
| `whatsapp_fetch_history` | Fetch older messages beyond what's in memory (up to 50 per call) |
| `whatsapp_reply` | Quote-reply to a message |
| `whatsapp_react` | React with emoji |
| `whatsapp_edit` | Edit a sent message |
| `whatsapp_delete` | Delete for everyone |
| `whatsapp_forward` | Forward to contact or group |
| `whatsapp_groups` | List all groups |
| `whatsapp_send_group` | Send to a group by name |
| `whatsapp_read_group` | Read group messages |
| `whatsapp_subscribe` | Watch a contact/group for new messages |
| `whatsapp_unsubscribe` | Stop watching |
| `whatsapp_get_notifications` | Fetch new messages from watched contacts |

### Watch List & Notifications

The subscription system lets Claude monitor specific contacts and groups for incoming messages.

**Create a watch list** by copying the example and editing it:

```bash
mkdir -p ~/.config/wa-cli-mcp
cp examples/watch.json.example ~/.config/wa-cli-mcp/watch.json
```

Then edit `~/.config/wa-cli-mcp/watch.json` with your contacts and groups:

```json
{
  "contacts": [
    { "phone": "+1234567890", "name": "Alice", "context": "co-founder, handles operations" },
    { "phone": "+9876543210", "name": "Bob", "context": "handles payments" }
  ],
  "groups": [
    { "name": "Team Updates", "context": "daily standup updates" }
  ]
}
```

**Add WhatsApp monitoring to your CLAUDE.md** — see [`examples/CLAUDE.md.example`](examples/CLAUDE.md.example) for a ready-to-use template with session startup, message checking, and watch list management instructions.

**How it works:**

1. At session start, Claude reads `watch.json` and subscribes to all contacts/groups
2. When you ask "any updates?", Claude calls `whatsapp_get_notifications` alongside email checks
3. Group messages from known contacts are identified by cross-referencing the contacts list
4. You can say "watch +91..." to add numbers or "unwatch" to remove them

---

## Project Structure

```
wa-cli-mcp/
├── src/
│   ├── index.ts              # CLI entry point (Commander.js)
│   ├── mcp-server.ts         # MCP server entry point (Claude Code)
│   ├── suppress-noise.ts     # Filters noisy Baileys logs
│   ├── commands/
│   │   ├── auth.ts           # wa auth
│   │   ├── send.ts           # wa send (text, reply, react, edit, delete)
│   │   ├── read.ts           # wa read
│   │   ├── repl.ts           # wa repl (interactive mode)
│   │   ├── groups.ts         # wa groups
│   │   ├── send-group.ts     # wa send-group
│   │   ├── read-group.ts     # wa read-group
│   │   └── forward.ts        # wa forward
│   ├── client/
│   │   ├── connection.ts     # WhatsApp connection, QR code, reconnection
│   │   ├── auth.ts           # Session persistence (~/.config/wa-cli-mcp/)
│   │   └── qrcode-terminal.d.ts  # Type declarations for qrcode-terminal
│   ├── messages/
│   │   ├── sender.ts         # Send text, media, reply, react, edit, delete, forward
│   │   ├── reader.ts         # Message store, history
│   │   └── media.ts          # Download media from messages
│   └── utils/
│       ├── phone.ts          # Phone number <-> WhatsApp JID conversion
│       ├── format.ts         # Message formatting for terminal
│       └── groups.ts         # Group name resolution
├── examples/
│   ├── CLAUDE.md.example     # Sample CLAUDE.md with WhatsApp monitoring section
│   └── watch.json.example    # Sample watch list config
├── package.json
├── package-lock.json
├── tsconfig.json
├── LICENSE
└── .gitignore
```

**Data directories** (created automatically, not in repo):

```
~/.config/wa-cli-mcp/
├── auth_state/               # Session files (owner-only permissions: 700/600)
├── downloads/                # Downloaded media
└── watch.json                # Contact/group watch list
```

## How It Works

This tool uses [Baileys](https://github.com/WhiskeySockets/Baileys), a TypeScript library that connects directly to WhatsApp's servers using the **Linked Devices** protocol (the same one WhatsApp Web uses). No browser automation — it's a direct WebSocket connection.

- **Authentication:** When you scan the QR code, WhatsApp links your phone to this CLI as a "linked device". Session keys are saved in `~/.config/wa-cli-mcp/auth_state/` with owner-only permissions (700/600).
- **Messages:** Sent via Baileys' `sendMessage` API. Incoming messages arrive through WebSocket events (`messages.upsert`).
- **Media:** Files are read from disk and sent as buffers. Received media is downloaded via `downloadMediaMessage` and saved to `~/.config/wa-cli-mcp/downloads/`.
- **Groups:** Group metadata is fetched via `groupFetchAllParticipating`. Group messages use `@g.us` JIDs instead of `@s.whatsapp.net`.
- **LID Mapping:** WhatsApp uses Linked IDs (LID) for incoming messages. The MCP server automatically resolves LID <-> phone number mappings using Baileys' signal repository.

## Security

This project has been hardened against the [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/):

- **Auth state security:** Session credentials stored at `~/.config/wa-cli-mcp/auth_state/` with `700` (directory) and `600` (file) permissions — owner-only access
- **File access control:** `send_media` blocks access to sensitive directories (`.ssh`, `.aws`, `auth_state`, `.gnupg`) and files (`.env`, `creds.json`, `id_rsa`, etc.)
- **Stdout isolation:** MCP mode redirects all non-protocol stdout to stderr, preventing Baileys noise from corrupting the JSON-RPC transport
- **Error sanitization:** All MCP tool handlers wrapped in try/catch — errors return safe messages, never stack traces or internal paths
- **Prompt injection defense:** Tool descriptions warn that message content is untrusted external input
- **Audit logging:** All tool invocations logged to stderr with timestamp, tool name, parameters, and result
- **Input validation:** Phone numbers validated via regex (`/^\+?\d{7,15}$/`), message IDs require 4+ chars, read limits capped at 100
- **Resource bounds:** Message store capped at 10,000, notification buffer at 500. Prevents memory exhaustion in long-running MCP sessions
- **Dependency pinning:** Baileys pinned to exact version (no floating ranges)
- **No credentials in code:** Auth state is gitignored, `.env*` patterns blocked

### Important: One Connection at a Time

Baileys only supports one active connection per auth state. Running the CLI and MCP server simultaneously (or two MCP instances) will cause session key corruption ("Bad MAC" errors). If this happens:

```bash
rm -rf ~/.config/wa-cli-mcp/auth_state/
npx tsx src/index.ts auth    # Re-scan QR code
```

## Troubleshooting

### QR code doesn't appear

The `printQRInTerminal` feature was deprecated in Baileys v7. This tool handles QR display manually via `qrcode-terminal`. If you still don't see it, delete auth state and retry.

### 405 Connection Error

WhatsApp periodically updates their protocol version. If you get a 405 error, update the `version` array in `src/client/connection.ts`:

```typescript
version: [2, 3000, LATEST_VERSION_HERE],
```

Check [Baileys issues](https://github.com/WhiskeySockets/Baileys/issues) for the current version number.

### "No messages found" on `read`

Both the CLI `read` command and the MCP `whatsapp_read` tool return messages from an in-memory store. On first connection, `syncFullHistory` is enabled so WhatsApp will sync your chat history (similar to WhatsApp Web). The sync can take a few seconds to complete. If you need older messages beyond what was synced, use the `whatsapp_fetch_history` MCP tool to request up to 50 additional messages at a time. Note that `whatsapp_read` does **not** require a subscription — subscriptions only affect `whatsapp_get_notifications`.

### MCP server shows "Connection Closed"

The auth state may be corrupted (usually from running two connections simultaneously). Delete and re-authenticate:

```bash
rm -rf ~/.config/wa-cli-mcp/auth_state/
npx tsx src/index.ts auth
```

Then reconnect the MCP server in Claude Code with `/mcp`.

## Disclaimer

This tool is **not affiliated with or endorsed by WhatsApp**. It uses an unofficial API (Baileys) and is intended for personal use only. Do not use it for spam, bulk messaging, or any activity that violates [WhatsApp's Terms of Service](https://www.whatsapp.com/legal/terms-of-service).
