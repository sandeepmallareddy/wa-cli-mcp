import type { WASocket, WAMessage } from '@whiskeysockets/baileys'
import { readFile } from 'fs/promises'
import mime from 'mime-types'
import path from 'path'

/**
 * Send a text message.
 */
export async function sendText(
  sock: WASocket,
  jid: string,
  text: string
): Promise<void> {
  await sock.sendMessage(jid, { text })
  console.log('Message sent.')
}

/**
 * Send a media file (image, video, audio, document).
 */
export async function sendMedia(
  sock: WASocket,
  jid: string,
  filePath: string,
  caption?: string
): Promise<void> {
  const absolutePath = path.resolve(filePath)
  const mimeType = mime.lookup(absolutePath) || 'application/octet-stream'
  const buffer = await readFile(absolutePath)
  const fileName = path.basename(absolutePath)

  if (mimeType.startsWith('image/')) {
    await sock.sendMessage(jid, {
      image: buffer,
      caption: caption || undefined,
      mimetype: mimeType,
    })
  } else if (mimeType.startsWith('video/')) {
    await sock.sendMessage(jid, {
      video: buffer,
      caption: caption || undefined,
      mimetype: mimeType,
    })
  } else if (mimeType.startsWith('audio/')) {
    await sock.sendMessage(jid, {
      audio: buffer,
      mimetype: mimeType,
      ptt: mimeType.includes('ogg'),
    })
  } else {
    await sock.sendMessage(jid, {
      document: buffer,
      mimetype: mimeType,
      fileName,
    })
  }

  console.log(`Media sent: ${fileName}`)
}

/**
 * Send a reply (quote) to a specific message.
 */
export async function sendReply(
  sock: WASocket,
  jid: string,
  text: string,
  quotedMsg: WAMessage
): Promise<void> {
  await sock.sendMessage(jid, { text }, { quoted: quotedMsg })
  console.log('Reply sent.')
}

/**
 * Send a reaction to a specific message.
 */
export async function sendReaction(
  sock: WASocket,
  jid: string,
  emoji: string,
  messageId: string,
  fromMe: boolean
): Promise<void> {
  await sock.sendMessage(jid, {
    react: {
      text: emoji,
      key: {
        remoteJid: jid,
        id: messageId,
        fromMe,
      },
    },
  })
  console.log('Reaction sent.')
}
