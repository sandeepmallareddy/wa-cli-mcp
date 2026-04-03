# WhatsApp CLI (`wa`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI tool (`wa`) that connects to WhatsApp via Baileys, supporting send/read messages with media, reactions, replies, and an interactive REPL mode.

**Architecture:** Single-process CLI using Commander.js for command routing and Baileys for WhatsApp connectivity. Auth state persisted to disk so QR scan is only needed once. Messages stored in-memory during session.

**Tech Stack:** TypeScript, Baileys (`@whiskeysockets/baileys`), Commander.js, `@hapi/boom`, `pino`, `mime-types`, Node.js readline

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/index.ts` | CLI entry point, Commander program definition, command registration |
| `src/commands/auth.ts` | `wa auth` command — connect and verify authentication |
| `src/commands/send.ts` | `wa send` command — send text, media, reactions, replies |
| `src/commands/read.ts` | `wa read` command — read messages from a contact |
| `src/commands/repl.ts` | `wa repl` command — interactive REPL mode |
| `src/client/connection.ts` | Baileys socket creation, connection lifecycle, reconnection |
| `src/client/auth.ts` | Auth state initialization via `useMultiFileAuthState` |
| `src/messages/sender.ts` | Send text, media, reaction, reply logic |
| `src/messages/reader.ts` | Collect messages from events, filter by contact, format output |
| `src/messages/media.ts` | Download media from messages, save to disk |
| `src/utils/phone.ts` | Phone number to JID conversion |
| `src/utils/format.ts` | Format messages for terminal display |
| `package.json` | Dependencies, scripts, bin entry |
| `tsconfig.json` | TypeScript config |
| `.gitignore` | Ignore auth_state/, downloads/, node_modules/, dist/ |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize the project**

```bash
cd /home/sandeep/Desktop/dev/whatsapp-bailey
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @whiskeysockets/baileys @hapi/boom pino commander mime-types
npm install -D typescript @types/node @types/mime-types tsx
```

- [ ] **Step 3: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Update package.json**

Add to `package.json`:

```json
{
  "type": "module",
  "bin": {
    "wa": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  }
}
```

- [ ] **Step 5: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
auth_state/
downloads/
*.js.map
```

- [ ] **Step 6: Create source directories**

```bash
mkdir -p src/commands src/client src/messages src/utils
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "feat: scaffold project with dependencies and config"
```

---

### Task 2: Phone Utility & Format Utility

**Files:**
- Create: `src/utils/phone.ts`
- Create: `src/utils/format.ts`

- [ ] **Step 1: Create phone.ts**

Create `src/utils/phone.ts`:

```typescript
/**
 * Convert a phone number string to a WhatsApp JID.
 * Accepts formats: +919876543210, 919876543210, 09876543210
 */
export function phoneToJid(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

/**
 * Extract a readable phone number from a JID.
 * "919876543210@s.whatsapp.net" → "+919876543210"
 */
export function jidToPhone(jid: string): string {
  const num = jid.split('@')[0]
  return `+${num}`
}
```

- [ ] **Step 2: Create format.ts**

Create `src/utils/format.ts`:

```typescript
import { jidToPhone } from './phone.js'
import type { WAMessage } from '@whiskeysockets/baileys'

export interface FormattedMessage {
  timestamp: string
  shortId: string
  sender: string
  content: string
}

/**
 * Get the short ID (last 8 chars) from a Baileys message ID.
 */
export function shortMessageId(id: string): string {
  return id.slice(-8)
}

/**
 * Format a timestamp to "YYYY-MM-DD HH:MM" local time.
 */
export function formatTimestamp(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

/**
 * Extract text content from a WAMessage.
 */
export function extractText(msg: WAMessage): string | null {
  const m = msg.message
  if (!m) return null
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    null
  )
}

/**
 * Determine the media type of a message, if any.
 */
export function getMediaType(msg: WAMessage): string | null {
  const m = msg.message
  if (!m) return null
  if (m.imageMessage) return 'image'
  if (m.videoMessage) return 'video'
  if (m.audioMessage) return 'audio'
  if (m.documentMessage) return 'document'
  if (m.stickerMessage) return 'sticker'
  return null
}

/**
 * Get the caption from a media message if present.
 */
export function getMediaCaption(msg: WAMessage): string | null {
  const m = msg.message
  if (!m) return null
  return (
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    null
  )
}

/**
 * Format a single message for terminal display.
 * Returns: "[2026-04-03 10:15] (a1b2c3d4) +919876543210: Hello"
 */
export function formatMessage(
  msg: WAMessage,
  mediaPath?: string
): string {
  const ts = msg.messageTimestamp
    ? formatTimestamp(Number(msg.messageTimestamp))
    : '???'
  const id = shortMessageId(msg.key.id || '????????')
  const sender = msg.key.fromMe ? 'You' : jidToPhone(msg.key.remoteJid || '')

  // Reaction message
  const reaction = msg.message?.reactionMessage
  if (reaction) {
    return `[${ts}] (${id}) ${sender}: ${reaction.text} (reaction)`
  }

  // Media message
  const mediaType = getMediaType(msg)
  if (mediaType) {
    const caption = getMediaCaption(msg)
    const pathInfo = mediaPath ? ` (saved: ${mediaPath})` : ''
    const captionInfo = caption ? ` "${caption}"` : ''
    return `[${ts}] (${id}) ${sender}: 📎 ${mediaType}${captionInfo}${pathInfo}`
  }

  // Text message
  const text = extractText(msg)
  if (text) {
    return `[${ts}] (${id}) ${sender}: ${text}`
  }

  return `[${ts}] (${id}) ${sender}: [unsupported message type]`
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: add phone and format utilities"
```

---

### Task 3: Auth & Connection

**Files:**
- Create: `src/client/auth.ts`
- Create: `src/client/connection.ts`

- [ ] **Step 1: Create auth.ts**

Create `src/client/auth.ts`:

```typescript
import { useMultiFileAuthState } from '@whiskeysockets/baileys'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'auth_state')

export async function getAuthState() {
  return useMultiFileAuthState(AUTH_DIR)
}
```

- [ ] **Step 2: Create connection.ts**

Create `src/client/connection.ts`:

```typescript
import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  type WASocket,
  type BaileysEventMap,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import P from 'pino'
import { getAuthState } from './auth.js'

const logger = P({ level: 'silent' })

export interface ConnectOptions {
  /** Called when connection is open */
  onOpen?: () => void
  /** Called on each messages.upsert event */
  onMessages?: (event: BaileysEventMap['messages.upsert']) => void
  /** If true, keep the process alive (for REPL mode) */
  keepAlive?: boolean
}

/**
 * Create a Baileys socket, handle auth + reconnection.
 * Returns a promise that resolves with the socket once connected.
 */
export function connect(opts: ConnectOptions = {}): Promise<WASocket> {
  return new Promise(async (resolve, reject) => {
    const { state, saveCreds } = await getAuthState()

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: true,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        if (statusCode === DisconnectReason.loggedOut) {
          console.error('Logged out. Run "wa auth" to re-authenticate.')
          reject(new Error('logged_out'))
        } else {
          // Reconnect
          connect(opts).then(resolve).catch(reject)
        }
      } else if (connection === 'open') {
        opts.onOpen?.()
        resolve(sock)
      }
    })

    if (opts.onMessages) {
      sock.ev.on('messages.upsert', opts.onMessages)
    }
  })
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/client/
git commit -m "feat: add auth state and connection management"
```

---

### Task 4: Message Sender

**Files:**
- Create: `src/messages/sender.ts`

- [ ] **Step 1: Create sender.ts**

Create `src/messages/sender.ts`:

```typescript
import type { WASocket, WAMessage } from '@whiskeysockets/baileys'
import { readFile } from 'fs/promises'
import mime from 'mime-types'
import path from 'path'

/**
 * Send a text message.
 */
export async function sendText(
  sock: WASocket,
  jid: string,
  text: string
): Promise<void> {
  await sock.sendMessage(jid, { text })
  console.log('Message sent.')
}

/**
 * Send a media file (image, video, audio, document).
 */
export async function sendMedia(
  sock: WASocket,
  jid: string,
  filePath: string,
  caption?: string
): Promise<void> {
  const absolutePath = path.resolve(filePath)
  const mimeType = mime.lookup(absolutePath) || 'application/octet-stream'
  const buffer = await readFile(absolutePath)
  const fileName = path.basename(absolutePath)

  if (mimeType.startsWith('image/')) {
    await sock.sendMessage(jid, {
      image: buffer,
      caption: caption || undefined,
      mimetype: mimeType,
    })
  } else if (mimeType.startsWith('video/')) {
    await sock.sendMessage(jid, {
      video: buffer,
      caption: caption || undefined,
      mimetype: mimeType,
    })
  } else if (mimeType.startsWith('audio/')) {
    await sock.sendMessage(jid, {
      audio: buffer,
      mimetype: mimeType,
      ptt: mimeType.includes('ogg'),
    })
  } else {
    await sock.sendMessage(jid, {
      document: buffer,
      mimetype: mimeType,
      fileName,
    })
  }

  console.log(`Media sent: ${fileName}`)
}

/**
 * Send a reply (quote) to a specific message.
 */
export async function sendReply(
  sock: WASocket,
  jid: string,
  text: string,
  quotedMsg: WAMessage
): Promise<void> {
  await sock.sendMessage(jid, { text }, { quoted: quotedMsg })
  console.log('Reply sent.')
}

/**
 * Send a reaction to a specific message.
 */
export async function sendReaction(
  sock: WASocket,
  jid: string,
  emoji: string,
  messageId: string,
  fromMe: boolean
): Promise<void> {
  await sock.sendMessage(jid, {
    react: {
      text: emoji,
      key: {
        remoteJid: jid,
        id: messageId,
        fromMe,
      },
    },
  })
  console.log('Reaction sent.')
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/messages/sender.ts
git commit -m "feat: add message sender (text, media, reply, reaction)"
```

---

### Task 5: Message Reader & Media Downloader

**Files:**
- Create: `src/messages/reader.ts`
- Create: `src/messages/media.ts`

- [ ] **Step 1: Create media.ts**

Create `src/messages/media.ts`:

```typescript
import { downloadMediaMessage, type WAMessage } from '@whiskeysockets/baileys'
import { createWriteStream, mkdirSync } from 'fs'
import path from 'path'
import { getMediaType } from '../utils/format.js'

const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads')

/**
 * Download media from a message and save to downloads/ folder.
 * Returns the saved file path, or null if not a media message.
 */
export async function downloadMedia(msg: WAMessage): Promise<string | null> {
  const mediaType = getMediaType(msg)
  if (!mediaType) return null

  mkdirSync(DOWNLOADS_DIR, { recursive: true })

  const timestamp = msg.messageTimestamp
    ? Number(msg.messageTimestamp)
    : Date.now()
  const ext = getExtension(msg, mediaType)
  const filename = `${mediaType}_${timestamp}${ext}`
  const filePath = path.join(DOWNLOADS_DIR, filename)

  const stream = await downloadMediaMessage(
    msg,
    'stream',
    {},
    {
      logger: undefined as any,
      reuploadRequest: undefined as any,
    }
  )

  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(filePath)
    ;(stream as NodeJS.ReadableStream).pipe(writeStream)
    writeStream.on('finish', () => resolve(filePath))
    writeStream.on('error', reject)
  })
}

function getExtension(msg: WAMessage, mediaType: string): string {
  const m = msg.message!
  const mimeType =
    m.imageMessage?.mimetype ||
    m.videoMessage?.mimetype ||
    m.audioMessage?.mimetype ||
    m.documentMessage?.mimetype ||
    ''

  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'audio/ogg; codecs=opus': '.ogg',
    'audio/mpeg': '.mp3',
    'application/pdf': '.pdf',
  }

  if (map[mimeType]) return map[mimeType]

  // Try document filename extension
  if (m.documentMessage?.fileName) {
    const ext = path.extname(m.documentMessage.fileName)
    if (ext) return ext
  }

  // Fallback by media type
  const fallback: Record<string, string> = {
    image: '.jpg',
    video: '.mp4',
    audio: '.ogg',
    document: '.bin',
    sticker: '.webp',
  }
  return fallback[mediaType] || '.bin'
}
```

- [ ] **Step 2: Create reader.ts**

Create `src/messages/reader.ts`:

```typescript
import type { WAMessage, BaileysEventMap } from '@whiskeysockets/baileys'
import { formatMessage, getMediaType } from '../utils/format.js'
import { downloadMedia } from './media.js'

/**
 * In-memory message store. Collects messages from upsert events.
 */
export class MessageStore {
  private messages: WAMessage[] = []

  /**
   * Handle a messages.upsert event — store messages.
   */
  handleUpsert(event: BaileysEventMap['messages.upsert']): void {
    this.messages.push(...event.messages)
  }

  /**
   * Get messages for a specific JID, sorted by timestamp ascending.
   */
  getMessages(jid: string, limit: number): WAMessage[] {
    return this.messages
      .filter((m) => m.key.remoteJid === jid)
      .sort(
        (a, b) =>
          Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0)
      )
      .slice(-limit)
  }

  /**
   * Find a message by its full or short ID within a JID.
   */
  findByShortId(jid: string, shortId: string): WAMessage | undefined {
    return this.messages.find(
      (m) => m.key.remoteJid === jid && m.key.id?.endsWith(shortId)
    )
  }
}

/**
 * Print messages for a contact to stdout.
 * If downloadMediaFiles is true, downloads media to disk.
 */
export async function printMessages(
  messages: WAMessage[],
  downloadMediaFiles: boolean
): Promise<void> {
  for (const msg of messages) {
    let mediaPath: string | undefined
    if (downloadMediaFiles && getMediaType(msg)) {
      try {
        const downloaded = await downloadMedia(msg)
        if (downloaded) mediaPath = downloaded
      } catch {
        // Media may be unavailable (expired, etc.)
      }
    }
    console.log(formatMessage(msg, mediaPath))
  }
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/messages/
git commit -m "feat: add message reader, store, and media downloader"
```

---

### Task 6: Auth Command

**Files:**
- Create: `src/commands/auth.ts`

- [ ] **Step 1: Create auth.ts**

Create `src/commands/auth.ts`:

```typescript
import { connect } from '../client/connection.js'

export async function authCommand(): Promise<void> {
  console.log('Connecting to WhatsApp...')
  console.log('Scan the QR code with your phone if prompted.\n')

  try {
    const sock = await connect({
      onOpen: () => {
        console.log('\nAuthenticated successfully!')
        console.log('Session saved. You can now use other commands.')
      },
    })

    // Give a moment for creds to save, then exit
    setTimeout(() => {
      sock.end(undefined)
      process.exit(0)
    }, 2000)
  } catch (err: any) {
    if (err.message === 'logged_out') {
      console.error('Authentication failed. Please try again.')
    } else {
      console.error('Error:', err.message)
    }
    process.exit(1)
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/auth.ts
git commit -m "feat: add wa auth command"
```

---

### Task 7: Send Command

**Files:**
- Create: `src/commands/send.ts`

- [ ] **Step 1: Create send.ts**

Create `src/commands/send.ts`:

```typescript
import { connect } from '../client/connection.js'
import { MessageStore } from '../messages/reader.js'
import { sendText, sendMedia, sendReply, sendReaction } from '../messages/sender.js'
import { phoneToJid } from '../utils/phone.js'

interface SendOptions {
  file?: string
  message?: string    // caption for media
  reply?: string      // short message ID to reply to
  react?: string      // short message ID to react to
}

export async function sendCommand(
  phone: string,
  textOrEmoji: string | undefined,
  opts: SendOptions
): Promise<void> {
  const jid = phoneToJid(phone)
  const store = new MessageStore()

  const sock = await connect({
    onMessages: (event) => store.handleUpsert(event),
  })

  // Wait briefly for history sync so we can find messages for --reply/--react
  if (opts.reply || opts.react) {
    await new Promise((r) => setTimeout(r, 3000))
  }

  try {
    if (opts.react && textOrEmoji) {
      // React to a message: wa send +91... --react <id> "👍"
      const targetMsg = store.findByShortId(jid, opts.react)
      if (!targetMsg) {
        // Construct the key manually if message not in history
        await sendReaction(sock, jid, textOrEmoji, opts.react, false)
      } else {
        await sendReaction(
          sock,
          jid,
          textOrEmoji,
          targetMsg.key.id!,
          targetMsg.key.fromMe || false
        )
      }
    } else if (opts.reply && textOrEmoji) {
      // Reply to a message: wa send +91... --reply <id> "text"
      const targetMsg = store.findByShortId(jid, opts.reply)
      if (!targetMsg) {
        console.error(`Message with ID ending in "${opts.reply}" not found.`)
        console.error('Try running "wa read" first to load message history.')
      } else {
        await sendReply(sock, jid, textOrEmoji, targetMsg)
      }
    } else if (opts.file) {
      // Send media: wa send +91... --file ./photo.jpg [-m "caption"]
      await sendMedia(sock, jid, opts.file, opts.message)
    } else if (textOrEmoji) {
      // Send text: wa send +91... "Hello"
      await sendText(sock, jid, textOrEmoji)
    } else {
      console.error('Nothing to send. Provide text, --file, --reply, or --react.')
    }
  } finally {
    sock.end(undefined)
    process.exit(0)
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/send.ts
git commit -m "feat: add wa send command (text, media, reply, react)"
```

---

### Task 8: Read Command

**Files:**
- Create: `src/commands/read.ts`

- [ ] **Step 1: Create read.ts**

Create `src/commands/read.ts`:

```typescript
import { connect } from '../client/connection.js'
import { MessageStore, printMessages } from '../messages/reader.js'
import { phoneToJid } from '../utils/phone.js'

interface ReadOptions {
  last?: string
  media?: boolean
}

export async function readCommand(
  phone: string,
  opts: ReadOptions
): Promise<void> {
  const jid = phoneToJid(phone)
  const limit = parseInt(opts.last || '20', 10)
  const store = new MessageStore()

  console.log('Connecting and syncing messages...\n')

  const sock = await connect({
    onMessages: (event) => store.handleUpsert(event),
  })

  // Wait for history sync to populate messages
  await new Promise((r) => setTimeout(r, 5000))

  const messages = store.getMessages(jid, limit)

  if (messages.length === 0) {
    console.log('No messages found for this contact.')
    console.log('Messages may take a moment to sync. Try increasing wait time or check the number.')
  } else {
    await printMessages(messages, opts.media || false)
  }

  sock.end(undefined)
  process.exit(0)
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/read.ts
git commit -m "feat: add wa read command"
```

---

### Task 9: REPL Command

**Files:**
- Create: `src/commands/repl.ts`

- [ ] **Step 1: Create repl.ts**

Create `src/commands/repl.ts`:

```typescript
import * as readline from 'readline'
import { connect } from '../client/connection.js'
import { MessageStore, printMessages } from '../messages/reader.js'
import { sendText, sendMedia, sendReply, sendReaction } from '../messages/sender.js'
import { phoneToJid } from '../utils/phone.js'
import { formatMessage } from '../utils/format.js'
import type { WASocket } from '@whiskeysockets/baileys'

export async function replCommand(): Promise<void> {
  const store = new MessageStore()

  console.log('Connecting to WhatsApp...\n')

  const sock = await connect({
    onOpen: () => console.log('Connected! Type "help" for commands.\n'),
    onMessages: (event) => {
      store.handleUpsert(event)

      // Print new incoming messages in real-time
      if (event.type === 'notify') {
        for (const msg of event.messages) {
          if (!msg.key.fromMe) {
            // Clear current line, print message, re-show prompt
            process.stdout.write('\r\x1b[K')
            console.log(formatMessage(msg))
            rl.prompt(true)
          }
        }
      }
    },
  })

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'wa> ',
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      rl.prompt()
      return
    }

    try {
      await handleReplCommand(sock, store, trimmed)
    } catch (err: any) {
      console.error(`Error: ${err.message}`)
    }

    rl.prompt()
  })

  rl.on('close', () => {
    console.log('\nDisconnecting...')
    sock.end(undefined)
    process.exit(0)
  })
}

async function handleReplCommand(
  sock: WASocket,
  store: MessageStore,
  input: string
): Promise<void> {
  const args = parseArgs(input)
  const command = args[0]

  switch (command) {
    case 'send': {
      // send +91... "text"
      // send +91... --file ./photo.jpg
      const phone = args[1]
      if (!phone) {
        console.log('Usage: send <phone> "message" OR send <phone> --file <path>')
        return
      }
      const jid = phoneToJid(phone)
      const fileIdx = args.indexOf('--file')
      if (fileIdx !== -1) {
        const filePath = args[fileIdx + 1]
        await sendMedia(sock, jid, filePath)
      } else {
        const text = args[2]
        if (!text) {
          console.log('Usage: send <phone> "message"')
          return
        }
        await sendText(sock, jid, text)
      }
      break
    }

    case 'read': {
      // read +91... [--last N]
      const phone = args[1]
      if (!phone) {
        console.log('Usage: read <phone> [--last N]')
        return
      }
      const jid = phoneToJid(phone)
      const lastIdx = args.indexOf('--last')
      const limit = lastIdx !== -1 ? parseInt(args[lastIdx + 1], 10) : 20
      const messages = store.getMessages(jid, limit)
      if (messages.length === 0) {
        console.log('No messages found for this contact.')
      } else {
        await printMessages(messages, false)
      }
      break
    }

    case 'react': {
      // react +91... <shortId> 👍
      const phone = args[1]
      const shortId = args[2]
      const emoji = args[3]
      if (!phone || !shortId || !emoji) {
        console.log('Usage: react <phone> <messageId> <emoji>')
        return
      }
      const jid = phoneToJid(phone)
      const msg = store.findByShortId(jid, shortId)
      if (msg) {
        await sendReaction(sock, jid, emoji, msg.key.id!, msg.key.fromMe || false)
      } else {
        await sendReaction(sock, jid, emoji, shortId, false)
      }
      break
    }

    case 'reply': {
      // reply +91... <shortId> "text"
      const phone = args[1]
      const shortId = args[2]
      const text = args[3]
      if (!phone || !shortId || !text) {
        console.log('Usage: reply <phone> <messageId> "text"')
        return
      }
      const jid = phoneToJid(phone)
      const msg = store.findByShortId(jid, shortId)
      if (!msg) {
        console.error(`Message "${shortId}" not found. Run "read" first.`)
        return
      }
      await sendReply(sock, jid, text, msg)
      break
    }

    case 'help':
      console.log(`
Commands:
  send <phone> "message"            Send a text message
  send <phone> --file <path>        Send a media file
  read <phone> [--last N]           Read messages (default: last 20)
  react <phone> <msgId> <emoji>     React to a message
  reply <phone> <msgId> "text"      Reply to a message
  help                              Show this help
  exit                              Disconnect and exit
`.trim())
      break

    case 'exit':
      process.stdout.write('Disconnecting...\n')
      sock.end(undefined)
      process.exit(0)
      break

    default:
      console.log(`Unknown command: ${command}. Type "help" for available commands.`)
  }
}

/**
 * Simple argument parser that respects quoted strings.
 * "send +91... \"hello world\"" → ["send", "+91...", "hello world"]
 */
function parseArgs(input: string): string[] {
  const args: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false
      } else {
        current += ch
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true
      quoteChar = ch
    } else if (ch === ' ') {
      if (current) {
        args.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }

  if (current) args.push(current)
  return args
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/repl.ts
git commit -m "feat: add wa repl interactive mode"
```

---

### Task 10: CLI Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create index.ts**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node

import { Command } from 'commander'
import { authCommand } from './commands/auth.js'
import { sendCommand } from './commands/send.js'
import { readCommand } from './commands/read.js'
import { replCommand } from './commands/repl.js'

const program = new Command()

program
  .name('wa')
  .description('WhatsApp CLI powered by Baileys')
  .version('1.0.0')

program
  .command('auth')
  .description('Authenticate with WhatsApp (scan QR code)')
  .action(authCommand)

program
  .command('send')
  .description('Send a message to a contact')
  .argument('<phone>', 'Phone number (e.g., +919876543210)')
  .argument('[text]', 'Text message or emoji (for reactions)')
  .option('--file <path>', 'Send a media file')
  .option('-m, --message <caption>', 'Caption for media file')
  .option('--reply <messageId>', 'Reply to a message (short ID from "wa read")')
  .option('--react <messageId>', 'React to a message (short ID from "wa read")')
  .action(sendCommand)

program
  .command('read')
  .description('Read messages from a contact')
  .argument('<phone>', 'Phone number (e.g., +919876543210)')
  .option('--last <count>', 'Number of messages to show', '20')
  .option('--media', 'Download media files to ./downloads/')
  .action(readCommand)

program
  .command('repl')
  .description('Interactive mode — stay connected and chat')
  .action(replCommand)

program.parse()
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Build and test the CLI help output**

```bash
npx tsc && node dist/index.js --help
```

Expected output:
```
Usage: wa [options] [command]

WhatsApp CLI powered by Baileys

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  auth            Authenticate with WhatsApp (scan QR code)
  send [options]  Send a message to a contact
  read [options]  Read messages from a contact
  repl            Interactive mode — stay connected and chat
  help [command]  display help for command
```

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with all commands wired up"
```

---

### Task 11: Manual Integration Test

This is a manual verification step — not automated tests.

- [ ] **Step 1: Authenticate**

```bash
npx tsx src/index.ts auth
```

Expected: QR code appears in terminal. Scan with phone. "Authenticated successfully!" message. Session saved to `auth_state/`.

- [ ] **Step 2: Send a text message**

```bash
npx tsx src/index.ts send +91XXXXXXXXXX "Hello from wa CLI!"
```

Expected: "Message sent." — verify it arrives on the recipient's phone.

- [ ] **Step 3: Read messages**

```bash
npx tsx src/index.ts read +91XXXXXXXXXX --last 5
```

Expected: Last 5 messages from that contact displayed with timestamps and short IDs.

- [ ] **Step 4: Read with media download**

```bash
npx tsx src/index.ts read +91XXXXXXXXXX --last 5 --media
```

Expected: Media messages show download paths. Files saved in `downloads/`.

- [ ] **Step 5: Send media**

```bash
npx tsx src/index.ts send +91XXXXXXXXXX --file ./test-image.jpg -m "Sent from CLI"
```

Expected: "Media sent: test-image.jpg" — image arrives with caption on recipient's phone.

- [ ] **Step 6: Test REPL mode**

```bash
npx tsx src/index.ts repl
```

Expected: Connects, shows prompt. Type `help` to see commands. Send/read messages interactively. Incoming messages appear in real-time. `exit` disconnects cleanly.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete wa CLI v1 — send, read, media, reactions, REPL"
```
