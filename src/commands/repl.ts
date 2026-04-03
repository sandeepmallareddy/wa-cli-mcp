import * as readline from 'readline'
import { connect } from '../client/connection.js'
import { MessageStore, printMessages } from '../messages/reader.js'
import { sendText, sendMedia, sendReply, sendReaction } from '../messages/sender.js'
import { phoneToJid } from '../utils/phone.js'
import { formatMessage } from '../utils/format.js'
import type { WASocket } from 'baileys'

export async function replCommand(): Promise<void> {
  const store = new MessageStore()

  console.log('Connecting to WhatsApp...\n')

  const sock = await connect({
    onOpen: () => console.log('Connected! Type "help" for commands.\n'),
    onHistorySync: (event) => store.handleHistorySync(event),
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
