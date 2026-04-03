# WhatsApp CLI (`wa`) — Design Spec

## Overview

A TypeScript CLI tool built on [Baileys](https://baileys.wiki) that allows programmatic interaction with a personal WhatsApp account. Supports sending/reading messages, media handling, reactions, replies, and an interactive REPL mode.

## Architecture

**Single-process CLI.** One Node.js process handles both the WhatsApp connection and CLI commands. In one-shot mode it connects, executes, and exits. In REPL mode it stays connected and accepts commands interactively.

Session persistence means reconnection is fast (no QR re-scan), so startup delay for one-shot commands is minimal.

## Project Structure

```
whatsapp-bailey/
├── src/
│   ├── index.ts          # Entry point, CLI command routing
│   ├── commands/
│   │   ├── send.ts       # Send text, media, reactions, replies
│   │   ├── read.ts       # Read messages from a contact
│   │   └── repl.ts       # Interactive REPL mode
│   ├── client/
│   │   ├── connection.ts # Baileys socket setup, connect/disconnect
│   │   └── auth.ts       # Auth state persistence (file-based)
│   ├── messages/
│   │   ├── sender.ts     # Send logic (text, media, reactions)
│   │   ├── reader.ts     # Read/fetch message history
│   │   └── media.ts      # Media download/upload handling
│   └── utils/
│       ├── phone.ts      # Phone number normalization (+91... → JID)
│       └── format.ts     # Message formatting for terminal output
├── auth_state/           # Persisted session files (gitignored)
├── downloads/            # Downloaded media files (gitignored)
├── package.json
├── tsconfig.json
└── .gitignore
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `baileys` | WhatsApp Web protocol client |
| `commander` | CLI framework with subcommands |
| `qrcode-terminal` | Display QR code in terminal for auth |
| `mime-types` | Detect MIME type for media files |

## CLI Interface

### Authentication

```bash
wa auth    # Connect & display QR code to scan, confirm auth, exit
```

### Sending Messages

```bash
wa send +919876543210 "Hello there"                    # Text
wa send +919876543210 --file ./photo.jpg               # Media
wa send +919876543210 --file ./photo.jpg -m "Caption"  # Media with caption
wa send +919876543210 --reply <message-id> "Got it"    # Reply to a message
wa send +919876543210 --react <message-id> "👍"         # React to a message
```

### Reading Messages

```bash
wa read +919876543210                     # Last 20 messages (default)
wa read +919876543210 --last 50           # Last 50 messages
wa read +919876543210 --media             # Download media to ./downloads/
```

### Interactive REPL

```bash
wa repl                                   # Enter interactive mode
```

REPL commands:
```
wa> send +919876543210 "Hello"
wa> send +919876543210 --file ./photo.jpg
wa> read +919876543210 --last 10
wa> react +919876543210 a1b2c3d4 👍
wa> reply +919876543210 a1b2c3d4 "Got it"
wa> help
wa> exit
```

### Output Format

```
[2026-04-03 10:15] (a1b2c3d4) +919876543210: Hey, how's it going?
[2026-04-03 10:16] (e5f6g7h8) You: All good! Check this out
[2026-04-03 10:16] (i9j0k1l2) You: 📎 image (saved: downloads/img_1712134560.jpg)
[2026-04-03 10:17] (m3n4o5p6) +919876543210: 👍 (reaction to "All good!")
```

Each message has a short ID (last 8 chars of Baileys message ID) for use with `--reply` and `--react`.

## Connection & Auth

### Connection Flow

1. Any command initializes Baileys via `makeWASocket`
2. Check `auth_state/` for existing session files
3. If session exists: auto-reconnect (no QR)
4. If no session: display QR in terminal, wait for scan
5. On success, session persists to `auth_state/`

### Auth State

Uses Baileys' `useMultiFileAuthState` which writes creds + keys to `auth_state/`. Appropriate for a personal single-user CLI tool.

### Reconnection

- `DisconnectReason.loggedOut`: clear `auth_state/`, prompt to re-scan
- Other disconnect reasons (network drop, etc.): Baileys handles auto-retry internally

## Message Handling

### Sending

- **Phone normalization:** `+919876543210` → `919876543210@s.whatsapp.net`
- **Text:** `sock.sendMessage(jid, { text: "..." })`
- **Media:** Read file from disk, detect MIME type, choose Baileys message type (`image`, `video`, `audio`, `document`), attach optional caption
- **Reply:** Send with `{ quoted: messageInfo }` referencing the target message
- **React:** `sock.sendMessage(jid, { react: { text: emoji, key: messageKey } })`

### Reading

- Baileys emits `messages.upsert` events for incoming messages
- History sync on connection provides recent messages (configurable via `syncFullHistory`)
- Messages stored in-memory during the session (no local database)
- `read` command connects, waits for history sync, filters by contact JID, displays last N
- Media download: call `downloadMediaMessage()`, save to `downloads/` with descriptive filename

## REPL Mode

- Connects to WhatsApp and stays connected
- Uses Node.js `readline` for input (no extra dependency)
- Incoming messages print in real-time above the prompt
- Prompt re-renders cleanly after each incoming message
- `exit` or Ctrl+C disconnects cleanly

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Single-process | Simplest to build; session persistence makes reconnect fast |
| CLI framework | Commander.js | Lightweight, well-maintained, natural subcommand support |
| Auth persistence | File-based (`useMultiFileAuthState`) | Appropriate for personal single-user CLI |
| Message storage | In-memory | No database overhead; messages available via history sync |
| Contact identifier | Phone number | Natural WhatsApp identifier, normalized to JID internally |
| REPL input | Node.js readline | Zero extra dependencies, handles prompt re-rendering |

## Out of Scope

- Group messaging (individual contacts only for v1)
- Webhook/HTTP server for external integrations
- Local database for persistent message history
- Multi-account support
- End-to-end encryption key management (Baileys handles this)
