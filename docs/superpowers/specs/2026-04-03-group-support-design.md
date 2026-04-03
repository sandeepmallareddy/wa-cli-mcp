# Group Support — Design Spec

## Overview

Add group messaging support to the `wa` CLI. Users can list groups, send messages to groups, and read group messages — all by group name.

## Commands

```bash
wa groups                                        # List all groups
wa send-group "EQ Updates" "Hello!"              # Send text by group name
wa send-group "EQ Updates" --file ./pic.jpg      # Send media to group
wa send-group "EQ Updates" --file ./pic.jpg -m "Caption"
wa read-group "EQ Updates" --last 10             # Read group messages
wa read-group "EQ Updates" --media               # Read + download media
```

## Group Resolution

- `wa groups` lists all groups: name, member count, JID
- `send-group` and `read-group` accept a group name (case-insensitive substring match) or full JID
- If multiple groups match the name, print matches and exit (don't guess)
- If no groups match, print error

## Message Format

Group messages show participant display name and phone number:

```
[2026-04-03 10:15] (a1b2c3d4) Sandeep (+919642093850): Hello everyone
[2026-04-03 10:16] (e5f6g7h8) You: Hey!
[2026-04-03 10:17] (i9j0k1l2) Priya (+919876543210): 📎 image "Check this"
```

## REPL Support

New REPL commands: `groups`, `send-group`, `read-group` — same syntax as CLI.

Incoming group messages in REPL show with group name prefix:

```
[EQ Updates] Sandeep (+919642093850): New message
```

## Files

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/groups.ts` | Create | Group name → JID resolution, group listing |
| `src/commands/groups.ts` | Create | `wa groups` command |
| `src/commands/send-group.ts` | Create | `wa send-group` command |
| `src/commands/read-group.ts` | Create | `wa read-group` command |
| `src/utils/format.ts` | Modify | Add `formatGroupMessage()` with participant name + number |
| `src/commands/repl.ts` | Modify | Add groups, send-group, read-group commands |
| `src/index.ts` | Modify | Register 3 new commands |

## Key Baileys APIs

- `sock.groupFetchAllParticipating()` — returns all groups with metadata
- Group JIDs end with `@g.us`
- Group messages have `key.participant` with sender's JID
- `msg.pushName` has the sender's display name
