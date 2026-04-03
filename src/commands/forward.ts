import { connect } from '../client/connection.js'
import { MessageStore } from '../messages/reader.js'
import { forwardMessage } from '../messages/sender.js'
import { phoneToJid } from '../utils/phone.js'
import { resolveGroup } from '../utils/groups.js'

export async function forwardCommand(
  fromPhone: string,
  messageId: string,
  toTarget: string
): Promise<void> {
  const fromJid = phoneToJid(fromPhone)
  const store = new MessageStore()

  const sock = await connect({
    onMessages: (event) => store.handleUpsert(event),
    onHistorySync: (event) => store.handleHistorySync(event),
  })

  // Wait for messages to sync
  await new Promise((r) => setTimeout(r, 3000))

  const msg = store.findByShortId(fromJid, messageId)
  if (!msg) {
    console.error(`Message with ID ending in "${messageId}" not found.`)
    console.error('Use "wa read" or "wa repl" first to load messages.')
    sock.end(undefined)
    process.exit(1)
  }

  // Resolve target — could be a phone number or group name
  let targetJid: string
  if (toTarget.endsWith('@g.us') || toTarget.endsWith('@s.whatsapp.net')) {
    targetJid = toTarget
  } else if (toTarget.match(/^\+?\d+$/)) {
    targetJid = phoneToJid(toTarget)
  } else {
    // Try as group name
    try {
      targetJid = await resolveGroup(sock, toTarget)
    } catch (e: any) {
      console.error(e.message)
      sock.end(undefined)
      process.exit(1)
    }
  }

  await forwardMessage(sock, targetJid, msg)

  sock.end(undefined)
  process.exit(0)
}
