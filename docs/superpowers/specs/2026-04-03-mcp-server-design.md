# wa-cli-mcp — MCP Server Design Spec

## Overview

An MCP (Model Context Protocol) server that exposes WhatsApp functionality as structured tools for Claude Code. Reuses the existing CLI codebase (`src/client/`, `src/messages/`, `src/utils/`). Maintains a persistent WhatsApp connection.

## Entry Point

`src/mcp-server.ts` — separate from the CLI entry point (`src/index.ts`). Both share the same core modules.

## Tools

| Tool | Input | Description |
|------|-------|-------------|
| `whatsapp_send` | `phone`, `text` | Send text message |
| `whatsapp_send_media` | `phone`, `filePath`, `caption?` | Send media file |
| `whatsapp_read` | `phone`, `limit?` | Read last N messages (default 20) |
| `whatsapp_reply` | `phone`, `messageId`, `text` | Quote-reply to a message |
| `whatsapp_react` | `phone`, `messageId`, `emoji` | React to a message |
| `whatsapp_edit` | `phone`, `messageId`, `newText` | Edit a sent message |
| `whatsapp_delete` | `phone`, `messageId` | Delete message for everyone |
| `whatsapp_forward` | `fromPhone`, `messageId`, `toTarget` | Forward to contact or group |
| `whatsapp_groups` | (none) | List all groups |
| `whatsapp_send_group` | `groupName`, `text` | Send text to group by name |
| `whatsapp_read_group` | `groupName`, `limit?` | Read group messages |
| `whatsapp_subscribe` | `target` | Subscribe to incoming messages from phone/group |
| `whatsapp_unsubscribe` | `target` | Unsubscribe |
| `whatsapp_get_notifications` | (none) | Fetch and clear new messages from subscribed targets |

## Architecture

- Persistent WhatsApp connection — connects on server start, stays alive
- `MessageStore` collects all messages via `messages.upsert` events
- Subscription set tracks which contacts/groups to watch
- Notification buffer stores incoming messages from subscribed targets
- `whatsapp_get_notifications` returns and clears the buffer
- All tools return structured JSON (`content: [{ type: 'text', text: JSON.stringify(...) }]`)

## Subscription Model

- `whatsapp_subscribe({ target: "+919642093850" })` — adds phone to watch list
- `whatsapp_subscribe({ target: "EQ Updates" })` — adds group to watch list (resolved via group name)
- `whatsapp_get_notifications()` — returns all new messages from subscribed targets since last poll, then clears
- Messages from non-subscribed targets are still stored (accessible via `whatsapp_read`) but don't appear in notifications

## Configuration

Users add to `.mcp.json` or `~/.claude/settings.json`:

```json
{
  "wa-cli-mcp": {
    "command": "npx",
    "args": ["tsx", "/absolute/path/to/whatsapp-bailey/src/mcp-server.ts"]
  }
}
```

## Dependencies

- `@modelcontextprotocol/server` — MCP SDK
- `zod` — input schema validation
- Existing project dependencies (baileys, etc.)

## Files

| File | Action |
|------|--------|
| `src/mcp-server.ts` | Create — MCP server with all tool registrations |
| `package.json` | Modify — add `@modelcontextprotocol/server` and `zod` deps |
