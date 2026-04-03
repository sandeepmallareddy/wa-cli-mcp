import { connect } from '../client/connection.js'
import { MessageStore, printMessages } from '../messages/reader.js'
import { resolveJids } from '../utils/phone.js'

interface ReadOptions {
  last?: string
  media?: boolean
}

export async function readCommand(
  phone: string,
  opts: ReadOptions
): Promise<void> {
  const limit = parseInt(opts.last || '20', 10)
  const store = new MessageStore()

  console.log('Connecting and syncing messages...\n')

  const sock = await connect({
    onMessages: (event) => store.handleUpsert(event),
    onHistorySync: (event) => store.handleHistorySync(event),
  })

  // Wait for history sync — keep waiting while new messages arrive
  console.log('Waiting for history sync...')
  let lastCount = 0
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500))
    const currentCount = store.getAllJids().length
    if (currentCount === lastCount && i >= 3) break
    lastCount = currentCount
  }
  console.log(` done (${lastCount} chats synced)\n`)

  // Resolve phone JID + LID JID (pass store JIDs for reverse LID lookup)
  const jids = await resolveJids(sock, phone, store.getAllJids())
  const messages = store.getMessagesMultiJid(jids, limit)

  if (messages.length === 0) {
    console.log('No messages found for this contact in this session.')
    console.log('Tip: Use "wa fetch-history" to pull older messages, or "wa repl" for real-time messages.')
  } else {
    await printMessages(messages, opts.media || false)
  }

  sock.end(undefined)
  process.exit(0)
}
