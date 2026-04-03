import { jidToPhone } from './phone.js'
import type { WAMessage } from '@whiskeysockets/baileys'

export interface FormattedMessage {
  timestamp: string
  shortId: string
  sender: string
  content: string
}

/**
 * Get the short ID (last 8 chars) from a Baileys message ID.
 */
export function shortMessageId(id: string): string {
  return id.slice(-8)
}

/**
 * Format a timestamp to "YYYY-MM-DD HH:MM" local time.
 */
export function formatTimestamp(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

/**
 * Extract text content from a WAMessage.
 */
export function extractText(msg: WAMessage): string | null {
  const m = msg.message
  if (!m) return null
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    null
  )
}

/**
 * Determine the media type of a message, if any.
 */
export function getMediaType(msg: WAMessage): string | null {
  const m = msg.message
  if (!m) return null
  if (m.imageMessage) return 'image'
  if (m.videoMessage) return 'video'
  if (m.audioMessage) return 'audio'
  if (m.documentMessage) return 'document'
  if (m.stickerMessage) return 'sticker'
  return null
}

/**
 * Get the caption from a media message if present.
 */
export function getMediaCaption(msg: WAMessage): string | null {
  const m = msg.message
  if (!m) return null
  return (
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    null
  )
}

/**
 * Format a single message for terminal display.
 * Returns: "[2026-04-03 10:15] (a1b2c3d4) +919876543210: Hello"
 */
export function formatMessage(
  msg: WAMessage,
  mediaPath?: string
): string {
  const ts = msg.messageTimestamp
    ? formatTimestamp(Number(msg.messageTimestamp))
    : '???'
  const id = shortMessageId(msg.key.id || '????????')
  const sender = msg.key.fromMe ? 'You' : jidToPhone(msg.key.remoteJid || '')

  // Reaction message
  const reaction = msg.message?.reactionMessage
  if (reaction) {
    return `[${ts}] (${id}) ${sender}: ${reaction.text} (reaction)`
  }

  // Media message
  const mediaType = getMediaType(msg)
  if (mediaType) {
    const caption = getMediaCaption(msg)
    const pathInfo = mediaPath ? ` (saved: ${mediaPath})` : ''
    const captionInfo = caption ? ` "${caption}"` : ''
    return `[${ts}] (${id}) ${sender}: 📎 ${mediaType}${captionInfo}${pathInfo}`
  }

  // Text message
  const text = extractText(msg)
  if (text) {
    return `[${ts}] (${id}) ${sender}: ${text}`
  }

  return `[${ts}] (${id}) ${sender}: [unsupported message type]`
}
