import type { WASocket, WAMessage } from 'baileys'
import { readFile, realpath, stat } from 'fs/promises'
import mime from 'mime-types'
import path from 'path'
import os from 'os'

const MAX_FILE_SIZE = 64 * 1024 * 1024 // 64MB — WhatsApp's media limit

/** Blocked filenames that should never be sent */
const BLOCKED_FILES = [
  'creds.json', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa',
  '.env', '.env.local', '.env.production', 'credentials',
  '.npmrc', '.pypirc', 'token', 'secret',
]

/** Blocked directory paths that should never be read from */
const BLOCKED_DIRS = [
  path.join(os.homedir(), '.ssh'),
  path.join(os.homedir(), '.gnupg'),
  path.join(os.homedir(), '.aws'),
  path.join(os.homedir(), '.config', 'wa-cli-mcp', 'auth_state'),
]

/**
 * Validate that a file path is safe to read and send.
 * Blocks access to sensitive files and directories.
 */
export async function validateFilePath(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath)
  let real: string
  try {
    real = await realpath(resolved)
  } catch {
    throw new Error(`File not found: ${filePath}`)
  }

  // Block sensitive directories
  for (const dir of BLOCKED_DIRS) {
    if (real.startsWith(dir + path.sep) || real === dir) {
      throw new Error('File access denied: sensitive directory')
    }
  }

  // Block sensitive filenames
  const basename = path.basename(real).toLowerCase()
  for (const blocked of BLOCKED_FILES) {
    if (basename === blocked || basename.startsWith('.env')) {
      throw new Error('File access denied: sensitive file')
    }
  }

  return real
}

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
  const absolutePath = await validateFilePath(filePath)
  const fileStats = await stat(absolutePath)
  if (fileStats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${Math.round(fileStats.size / 1024 / 1024)}MB). Maximum is 64MB.`)
  }
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

/**
 * Edit a previously sent message.
 */
export async function editMessage(
  sock: WASocket,
  jid: string,
  messageId: string,
  newText: string
): Promise<void> {
  await sock.sendMessage(jid, {
    text: newText,
    edit: {
      remoteJid: jid,
      id: messageId,
      fromMe: true,
    },
  })
  console.log('Message edited.')
}

/**
 * Delete a message for everyone.
 */
export async function deleteMessage(
  sock: WASocket,
  jid: string,
  messageId: string,
  fromMe: boolean
): Promise<void> {
  await sock.sendMessage(jid, {
    delete: {
      remoteJid: jid,
      id: messageId,
      fromMe,
    },
  })
  console.log('Message deleted.')
}

/**
 * Forward a message to another JID.
 */
export async function forwardMessage(
  sock: WASocket,
  targetJid: string,
  msg: WAMessage
): Promise<void> {
  await sock.sendMessage(targetJid, { forward: msg })
  console.log('Message forwarded.')
}
