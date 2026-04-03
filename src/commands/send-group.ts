import { connect } from '../client/connection.js'
import { resolveGroup } from '../utils/groups.js'
import { sendText, sendMedia } from '../messages/sender.js'

interface SendGroupOptions {
  file?: string
  message?: string
}

export async function sendGroupCommand(
  groupName: string,
  text: string | undefined,
  opts: SendGroupOptions
): Promise<void> {
  const sock = await connect()

  let jid: string
  try {
    jid = await resolveGroup(sock, groupName)
  } catch (e: any) {
    console.error(e.message)
    sock.end(undefined)
    process.exit(1)
  }

  try {
    if (opts.file) {
      await sendMedia(sock, jid, opts.file, opts.message)
    } else if (text) {
      await sendText(sock, jid, text)
    } else {
      console.error('Nothing to send. Provide text or --file.')
    }
  } finally {
    sock.end(undefined)
    process.exit(0)
  }
}
