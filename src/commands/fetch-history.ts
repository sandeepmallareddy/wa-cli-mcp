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
  let syncing = true

  console.log('Connecting and syncing messages...\n')

  const sock = await connect({
    onMessages: (event) => store.handleUpsert(event),
    onHistorySync: (event) => {
      store.handleHistorySync(event)
      if (syncing) process.stderr.write('.')
    },
  })

  // Wait for initial history sync — keep waiting while new messages arrive
  console.log('Waiting for history sync...')
  let lastCount = 0
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500))
    const currentCount = store.getAllJids().length
    if (currentCount === lastCount && i >= 3) break // stable for 2.5s after minimum wait
    lastCount = currentCount
  }
  console.log(` done (${lastCount} chats synced)\n`)
  syncing = false

  // Resolve phone JID + LID JID (pass store JIDs for reverse LID lookup)
  const jids = await resolveJids(sock, phone, store.getAllJids())

  let fetched = store.getMessagesMultiJid(jids, requested)

  if (fetched.length >= requested) {
    console.log(`Got ${fetched.length} messages from history sync.\n`)
    await printMessages(fetched.slice(-requested), opts.media || false)
    sock.end(undefined)
    process.exit(0)
  }

  // Need more — keep fetching until we have enough or no more arrive
  const MAX_ATTEMPTS = 20
  let attempt = 0

  while (fetched.length < requested && attempt < MAX_ATTEMPTS) {
    const oldest = store.getMessagesMultiJid(jids, 1)[0]
    if (!oldest) {
      console.log('No messages in store to fetch history from. Send or receive a message first.')
      break
    }

    const batchSize = Math.min(50, requested - fetched.length)
    attempt++
    console.log(`Fetching older messages (attempt ${attempt}, have ${fetched.length} so far)...`)

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

    // Wait for history sync events to deliver — poll until count stabilizes
    let prevCount = fetched.length
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const newFetched = store.getMessagesMultiJid(jids, requested)
      if (newFetched.length > prevCount) {
        prevCount = newFetched.length
      } else if (i >= 1) {
        break // count stable for 2s
      }
    }

    const newFetched = store.getMessagesMultiJid(jids, requested)
    if (newFetched.length === fetched.length) {
      console.log('No more messages available from WhatsApp.')
      break
    }
    fetched = newFetched
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
