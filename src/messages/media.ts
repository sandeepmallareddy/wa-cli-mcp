import { downloadMediaMessage, type WAMessage } from 'baileys'
import { createWriteStream, mkdirSync } from 'fs'
import path from 'path'
import { getMediaType } from '../utils/format.js'

const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads')

/**
 * Download media from a message and save to downloads/ folder.
 * Returns the saved file path, or null if not a media message.
 */
export async function downloadMedia(msg: WAMessage): Promise<string | null> {
  const mediaType = getMediaType(msg)
  if (!mediaType) return null

  mkdirSync(DOWNLOADS_DIR, { recursive: true })

  const timestamp = msg.messageTimestamp
    ? Number(msg.messageTimestamp)
    : Date.now()
  const ext = getExtension(msg, mediaType)
  const filename = `${mediaType}_${timestamp}${ext}`
  const filePath = path.join(DOWNLOADS_DIR, filename)

  const stream = await downloadMediaMessage(
    msg,
    'stream',
    {},
    {
      logger: undefined as any,
      reuploadRequest: undefined as any,
    }
  )

  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(filePath)
    ;(stream as NodeJS.ReadableStream).pipe(writeStream)
    writeStream.on('finish', () => resolve(filePath))
    writeStream.on('error', reject)
  })
}

function getExtension(msg: WAMessage, mediaType: string): string {
  const m = msg.message!
  const mimeType =
    m.imageMessage?.mimetype ||
    m.videoMessage?.mimetype ||
    m.audioMessage?.mimetype ||
    m.documentMessage?.mimetype ||
    ''

  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'audio/ogg; codecs=opus': '.ogg',
    'audio/mpeg': '.mp3',
    'application/pdf': '.pdf',
  }

  if (map[mimeType]) return map[mimeType]

  // Try document filename extension
  if (m.documentMessage?.fileName) {
    const ext = path.extname(m.documentMessage.fileName)
    if (ext) return ext
  }

  // Fallback by media type
  const fallback: Record<string, string> = {
    image: '.jpg',
    video: '.mp4',
    audio: '.ogg',
    document: '.bin',
    sticker: '.webp',
  }
  return fallback[mediaType] || '.bin'
}
