import { connect } from '../client/connection.js'
import { MessageStore, printMessages } from '../messages/reader.js'
import { resolveJids } from '../utils/phone.js'

interface FetchHistoryOptions {
  last?: string
  media?: boolean
}

export async function fetchHistoryCommand(
  phone: string,
  opts: FetchHistoryOptions
): Promise<void> {
  const requested = parseInt(opts.last || '50', 10)
  const store = new MessageStore()

  console.log('Connecting and syncing messages...\n')

  const sock = await connect({
    onMessages: (event) => store.handleUpsert(event),
    onHistorySync: (event) => store.handleHistorySync(event),
  })

  // Wait for initial history sync
  await new Promise((r) => setTimeout(r, 5000))

  // Resolve phone JID + LID JID (pass store JIDs for reverse LID lookup)
  const jids = await resolveJids(sock, phone, store.getAllJids())

  let fetched = store.getMessagesMultiJid(jids, requested)

  if (fetched.length >= requested) {
    console.log(`Already have ${fetched.length} messages from history sync.\n`)
    await printMessages(fetched.slice(-requested), opts.media || false)
    sock.end(undefined)
    process.exit(0)
  }

  // Need more — fetch in batches of 50
  let remaining = requested - fetched.length
  let batchCount = 0
  const maxBatches = Math.ceil(remaining / 50)

  while (remaining > 0 && batchCount < maxBatches) {
    // Find the oldest message across all JIDs
    const oldest = store.getMessagesMultiJid(jids, 1)[0]
    if (!oldest) {
      console.log('No messages in store to fetch history from. Send or receive a message first.')
      break
    }

    const batchSize = Math.min(remaining, 50)
    console.log(`Fetching ${batchSize} older messages (batch ${batchCount + 1}/${maxBatches})...`)

    try {
      await sock.fetchMessageHistory(
        batchSize,
        oldest.key,
        Number(oldest.messageTimestamp || 0)
      )
    } catch (err: any) {
      console.error(`Failed to fetch history: ${err.message}`)
      break
    }

    // Wait for the history sync event to deliver messages
    await new Promise((r) => setTimeout(r, 3000))

    const newCount = store.getMessagesMultiJid(jids, requested).length
    if (newCount === fetched.length) {
      console.log('No more messages available.')
      break
    }

    fetched = store.getMessagesMultiJid(jids, requested)
    remaining = requested - fetched.length
    batchCount++
  }

  const messages = store.getMessagesMultiJid(jids, requested)

  if (messages.length === 0) {
    console.log('No messages found for this contact.')
  } else {
    console.log(`\nShowing ${messages.length} messages:\n`)
    await printMessages(messages, opts.media || false)
  }

  sock.end(undefined)
  process.exit(0)
}
