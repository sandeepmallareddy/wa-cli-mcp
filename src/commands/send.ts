import { connect } from '../client/connection.js'
import { MessageStore } from '../messages/reader.js'
import { sendText, sendMedia, sendReply, sendReaction, editMessage, deleteMessage } from '../messages/sender.js'
import { phoneToJid } from '../utils/phone.js'

interface SendOptions {
  file?: string
  message?: string    // caption for media
  reply?: string      // short message ID to reply to
  react?: string      // short message ID to react to
  edit?: string       // short message ID to edit
  delete?: string     // short message ID to delete
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
    onHistorySync: (event) => store.handleHistorySync(event),
  })

  // Wait briefly for history sync so we can find messages
  if (opts.reply || opts.react || opts.edit || opts.delete) {
    await new Promise((r) => setTimeout(r, 3000))
  }

  try {
    if (opts.edit && textOrEmoji) {
      // Edit a message: wa send +91... --edit <id> "new text"
      const targetMsg = store.findByShortId(jid, opts.edit)
      const msgId = targetMsg?.key.id || opts.edit
      await editMessage(sock, jid, msgId, textOrEmoji)
    } else if (opts.delete) {
      // Delete a message: wa send +91... --delete <id>
      const targetMsg = store.findByShortId(jid, opts.delete)
      if (targetMsg) {
        await deleteMessage(sock, jid, targetMsg.key.id!, targetMsg.key.fromMe || false)
      } else {
        await deleteMessage(sock, jid, opts.delete, true)
      }
    } else if (opts.react && textOrEmoji) {
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
