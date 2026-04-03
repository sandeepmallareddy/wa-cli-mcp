import { connect } from '../client/connection.js'
import { MessageStore } from '../messages/reader.js'
import { resolveGroup } from '../utils/groups.js'
import { formatGroupMessage, getMediaType } from '../utils/format.js'
import { downloadMedia } from '../messages/media.js'

interface ReadGroupOptions {
  last?: string
  media?: boolean
}

export async function readGroupCommand(
  groupName: string,
  opts: ReadGroupOptions
): Promise<void> {
  const store = new MessageStore()
  const limit = parseInt(opts.last || '20', 10)

  console.log('Connecting and syncing messages...\n')

  const sock = await connect({
    onMessages: (event) => store.handleUpsert(event),
    onHistorySync: (event) => store.handleHistorySync(event),
  })

  let jid: string
  try {
    jid = await resolveGroup(sock, groupName)
  } catch (e: any) {
    console.error(e.message)
    sock.end(undefined)
    process.exit(1)
  }

  // Wait for message sync
  await new Promise((r) => setTimeout(r, 5000))

  const messages = store.getMessages(jid, limit)

  if (messages.length === 0) {
    console.log('No messages found for this group in this session.')
    console.log('Use "wa repl" to see group messages in real-time.')
  } else {
    for (const msg of messages) {
      let mediaPath: string | undefined
      if (opts.media && getMediaType(msg)) {
        try {
          const downloaded = await downloadMedia(msg)
          if (downloaded) mediaPath = downloaded
        } catch {}
      }
      console.log(formatGroupMessage(msg, mediaPath))
    }
  }

  sock.end(undefined)
  process.exit(0)
}
