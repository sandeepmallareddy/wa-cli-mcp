# wa - WhatsApp CLI

A command-line tool to interact with your WhatsApp account. Send and receive messages, media, reactions, and more — all from your terminal.

Built with [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web API) and TypeScript.

## What Can It Do?

- **Send messages** — text, images, videos, documents, voice notes
- **Read messages** — view conversation history with any contact
- **Reply & React** — quote-reply to messages, add emoji reactions
- **Edit & Delete** — modify or remove sent messages
- **Forward** — forward messages to other contacts or groups
- **Groups** — list groups, send/read group messages
- **Interactive REPL** — stay connected, chat in real-time, see incoming messages live

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- **A WhatsApp account** with the WhatsApp app on your phone
- **npm** (comes with Node.js)

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url> whatsapp-bailey
cd whatsapp-bailey
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

## Usage

All commands use the format:

```bash
npx tsx src/index.ts <command> [arguments] [options]
```

> **Tip:** For convenience, you can create an alias: `alias wa="npx tsx src/index.ts"` and then just use `wa send ...`, `wa read ...`, etc.

---

### Send a Text Message

```bash
npx tsx src/index.ts send +1234567890 "Hello!"
```

### Send Media (Image, Video, Document, Voice Note)

```bash
# Image with caption
npx tsx src/index.ts send +1234567890 --file ./photo.jpg -m "Check this out"

# Document
npx tsx src/index.ts send +1234567890 --file ./report.pdf

# Voice note
npx tsx src/index.ts send +1234567890 --file ./voice.ogg
```

The CLI auto-detects the file type and sends it appropriately.

### Read Messages from a Contact

```bash
# Last 20 messages (default)
npx tsx src/index.ts read +1234567890

# Last 50 messages
npx tsx src/index.ts read +1234567890 --last 50

# Download media files too
npx tsx src/index.ts read +1234567890 --media
```

Messages display like this:

```
[2026-04-03 10:15] (a1b2c3d4) +1234567890: Hey, how's it going?
[2026-04-03 10:16] (e5f6g7h8) You: All good!
[2026-04-03 10:17] (i9j0k1l2) +1234567890: 📎 image "vacation pic" (saved: downloads/image_1712134560.jpg)
```

The 8-character code in parentheses (e.g., `a1b2c3d4`) is the **message ID** — you'll need it for reply, react, edit, delete, and forward.

> **Note:** `read` shows messages received during the current session. For real-time message viewing, use `repl` mode.

### Reply to a Message

```bash
npx tsx src/index.ts send +1234567890 --reply a1b2c3d4 "Got it, thanks!"
```

This sends a quoted reply referencing the message with ID `a1b2c3d4`.

### React to a Message

```bash
npx tsx src/index.ts send +1234567890 --react a1b2c3d4 "👍"
```

### Edit a Sent Message

```bash
npx tsx src/index.ts send +1234567890 --edit e5f6g7h8 "Corrected text here"
```

You can only edit messages you sent (`fromMe`).

### Delete a Message

```bash
npx tsx src/index.ts send +1234567890 --delete e5f6g7h8
```

Deletes the message for everyone (not just you).

### Forward a Message

```bash
# Forward to another contact
npx tsx src/index.ts forward +1234567890 a1b2c3d4 +9876543210

# Forward to a group
npx tsx src/index.ts forward +1234567890 a1b2c3d4 "EQ Updates"
```

The arguments are: `<source-phone> <message-id> <destination>`. The destination can be a phone number or a group name.

---

## Groups

### List All Groups

```bash
npx tsx src/index.ts groups
```

Output:

```
Found 3 groups:

  Family Chat (8 members) — 120363046248480189@g.us
  Work Team (15 members) — 120363189600317693@g.us
  Book Club (5 members) — 120363044659379469@g.us
```

### Send to a Group

```bash
# By name (case-insensitive substring match)
npx tsx src/index.ts send-group "Family" "Dinner at 7 tonight!"

# Send media to a group
npx tsx src/index.ts send-group "Work Team" --file ./slides.pdf -m "Meeting slides"
```

If the name matches multiple groups, you'll be asked to be more specific.

### Read Group Messages

```bash
npx tsx src/index.ts read-group "Family" --last 10
```

Group messages show who sent them:

```
[2026-04-03 10:15] (a1b2c3d4) Mom (+1234567890): Dinner at 7 tonight!
[2026-04-03 10:16] (e5f6g7h8) You: Sounds good!
[2026-04-03 10:17] (i9j0k1l2) Dad (+1234567891): I'll bring dessert
```

---

## Interactive Mode (REPL)

The REPL keeps you connected to WhatsApp and lets you chat interactively. Incoming messages appear in real-time.

```bash
npx tsx src/index.ts repl
```

You'll see a prompt:

```
Connected! Type "help" for commands.

wa>
```

### REPL Commands

```
wa> send +1234567890 "Hello"
wa> send +1234567890 --file ./photo.jpg
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

Incoming messages print automatically:

```
wa> [2026-04-03 10:18] (m3n4o5p6) +1234567890: Just sent you a photo
[Family Chat] Mom (+1234567890): Don't forget milk!
wa>
```

Press **Ctrl+C** or type `exit` to disconnect.

---

## Project Structure

```
whatsapp-bailey/
├── src/
│   ├── index.ts              # CLI entry point (Commander.js)
│   ├── suppress-noise.ts     # Filters noisy Baileys logs
│   ├── commands/
│   │   ├── auth.ts           # wa auth
│   │   ├── send.ts           # wa send
│   │   ├── read.ts           # wa read
│   │   ├── repl.ts           # wa repl (interactive mode)
│   │   ├── groups.ts         # wa groups
│   │   ├── send-group.ts     # wa send-group
│   │   ├── read-group.ts     # wa read-group
│   │   └── forward.ts        # wa forward
│   ├── client/
│   │   ├── connection.ts     # WhatsApp connection, QR code, reconnection
│   │   └── auth.ts           # Session persistence
│   ├── messages/
│   │   ├── sender.ts         # Send text, media, reply, react, edit, delete, forward
│   │   ├── reader.ts         # Message store, history
│   │   └── media.ts          # Download media from messages
│   └── utils/
│       ├── phone.ts          # Phone number ↔ WhatsApp JID conversion
│       ├── format.ts         # Message formatting for terminal
│       └── groups.ts         # Group name resolution
├── ~/.config/whatsapp-bailey/
│   ├── auth_state/           # Session files (owner-only permissions)
│   └── downloads/            # Downloaded media
├── package.json
├── tsconfig.json
└── .gitignore
```

## How It Works

This tool uses [Baileys](https://github.com/WhiskeySockets/Baileys), a TypeScript library that connects directly to WhatsApp's servers using the **Linked Devices** protocol (the same one WhatsApp Web uses). No browser automation — it's a direct WebSocket connection.

- **Authentication:** When you scan the QR code, WhatsApp links your phone to this CLI as a "linked device". Session keys are saved in `~/.config/whatsapp-bailey/auth_state/` with owner-only permissions (700/600) so you only scan once.
- **Messages:** Sent via Baileys' `sendMessage` API. Incoming messages arrive through WebSocket events (`messages.upsert`).
- **Media:** Files are read from disk and sent as buffers. Received media is downloaded via `downloadMediaMessage` and saved to `~/.config/whatsapp-bailey/downloads/`.
- **Groups:** Group metadata is fetched via `groupFetchAllParticipating`. Group messages use `@g.us` JIDs instead of `@s.whatsapp.net`.

## Troubleshooting

### QR code doesn't appear

The `printQRInTerminal` feature was deprecated in Baileys v7. This tool handles QR display manually via `qrcode-terminal`. If you still don't see it, try deleting `auth_state/` and running `wa auth` again.

### 405 Connection Error

WhatsApp periodically updates their protocol version. If you get a 405 error, update the `version` array in `src/client/connection.ts`:

```typescript
version: [2, 3000, LATEST_VERSION_HERE],
```

Check [Baileys issues](https://github.com/WhiskeySockets/Baileys/issues) for the current version number.

### "No messages found" on `read`

The `read` command only shows messages received during the current session. WhatsApp's history sync doesn't always fire on reconnection. For real-time messages, use `wa repl`.

### Session expired / logged out

Delete the auth state and re-authenticate:

```bash
rm -rf ~/.config/whatsapp-bailey/auth_state/
npx tsx src/index.ts auth
```

## Claude Code Integration (MCP Server)

This project includes an MCP (Model Context Protocol) server that lets Claude Code interact with WhatsApp directly through structured tools.

### Setup

1. **Authenticate first** (if you haven't already):

```bash
cd /path/to/whatsapp-bailey
npx tsx src/index.ts auth
```

2. **Add the MCP server** (one command):

```bash
claude mcp add wa-cli-mcp -- npx tsx /absolute/path/to/whatsapp-bailey/src/mcp-server.ts
```

Or manually add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "wa-cli-mcp": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/whatsapp-bailey/src/mcp-server.ts"]
    }
  }
}
```

3. **Restart Claude Code.** The WhatsApp tools will be auto-discovered.

### Available Tools

| Tool | Description |
|------|-------------|
| `whatsapp_send` | Send text message |
| `whatsapp_send_media` | Send image/video/doc/voice note |
| `whatsapp_read` | Read messages from a contact |
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

### Subscription Example

Claude can subscribe to a contact, do other work, then check for new messages:

```
1. whatsapp_subscribe({ target: "+919876543210" })
2. ... do other tasks ...
3. whatsapp_get_notifications()  → returns new messages since last check
```

## Disclaimer

This tool is **not affiliated with or endorsed by WhatsApp**. It uses an unofficial API (Baileys) and is intended for personal use only. Do not use it for spam, bulk messaging, or any activity that violates [WhatsApp's Terms of Service](https://www.whatsapp.com/legal/terms-of-service).
