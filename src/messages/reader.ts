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
   * Get messages across multiple JIDs (e.g. phone JID + LID JID).
   * Merges, deduplicates, sorts by timestamp, and returns the last N.
   */
  getMessagesMultiJid(jids: string[], limit: number): WAMessage[] {
    const seen = new Set<string>()
    return this.messages
      .filter((m) => {
        if (!jids.includes(m.key.remoteJid || '')) return false
        const id = m.key.id || ''
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      .sort(
        (a, b) =>
          Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0)
      )
      .slice(-limit)
  }

  /**
   * Get all unique remoteJid values in the store.
   * Used for LID discovery — pass these to resolveJids to find LID mappings.
   */
  getAllJids(): string[] {
    const jids = new Set<string>()
    for (const msg of this.messages) {
      if (msg.key.remoteJid) jids.add(msg.key.remoteJid)
    }
    return [...jids]
  }

  /**
   * Find a message by its full or short ID within a JID.
   * Requires at least 4 characters to avoid accidental matches.
   */
  findByShortId(jid: string, shortId: string): WAMessage | undefined {
    return this.messages.find(
      (m) => m.key.remoteJid === jid && m.key.id?.endsWith(shortId)
    )
  }

  /**
   * Enforce a maximum store size by evicting oldest messages.
   */
  enforceLimit(max: number): void {
    if (this.messages.length > max) {
      this.messages = this.messages.slice(-max)
    }
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
