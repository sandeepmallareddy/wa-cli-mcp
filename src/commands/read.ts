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
