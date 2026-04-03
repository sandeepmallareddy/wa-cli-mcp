import type { WAMessage, BaileysEventMap } from 'baileys'
import { formatMessage, getMediaType } from '../utils/format.js'
import { downloadMedia } from './media.js'

/**
 * In-memory message store. Collects messages from upsert events.
 */
export class MessageStore {
  private messages: WAMessage[] = []

  /**
   * Handle a messages.upsert event — store messages.
   */
  handleUpsert(event: BaileysEventMap['messages.upsert']): void {
    this.messages.push(...event.messages)
  }

  /**
   * Handle a messaging-history.set event — store synced messages.
   */
  handleHistorySync(event: BaileysEventMap['messaging-history.set']): void {
    this.messages.push(...event.messages)
  }

  /**
   * Get messages for a specific JID, sorted by timestamp ascending.
   */
  getMessages(jid: string, limit: number): WAMessage[] {
    return this.messages
      .filter((m) => m.key.remoteJid === jid)
      .sort(
        (a, b) =>
          Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0)
      )
      .slice(-limit)
  }

  /**
   * Find a message by its full or short ID within a JID.
   */
  findByShortId(jid: string, shortId: string): WAMessage | undefined {
    return this.messages.find(
      (m) => m.key.remoteJid === jid && m.key.id?.endsWith(shortId)
    )
  }
}

/**
 * Print messages for a contact to stdout.
 * If downloadMediaFiles is true, downloads media to disk.
 */
export async function printMessages(
  messages: WAMessage[],
  downloadMediaFiles: boolean
): Promise<void> {
  for (const msg of messages) {
    let mediaPath: string | undefined
    if (downloadMediaFiles && getMediaType(msg)) {
      try {
        const downloaded = await downloadMedia(msg)
        if (downloaded) mediaPath = downloaded
      } catch {
        // Media may be unavailable (expired, etc.)
      }
    }
    console.log(formatMessage(msg, mediaPath))
  }
}
