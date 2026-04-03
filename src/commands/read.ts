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
    onHistorySync: (event) => store.handleHistorySync(event),
  })

  // Wait for message sync
  await new Promise((r) => setTimeout(r, 5000))

  const messages = store.getMessages(jid, limit)

  if (messages.length === 0) {
    console.log('No messages found for this contact in this session.')
    console.log('Note: Historical messages require an active session. Use "wa repl" to see messages in real-time.')
  } else {
    await printMessages(messages, opts.media || false)
  }

  sock.end(undefined)
  process.exit(0)
}
