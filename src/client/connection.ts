import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  type WASocket,
  type BaileysEventMap,
} from 'baileys'
import { Boom } from '@hapi/boom'
import P from 'pino'
import { createRequire } from 'module'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'

const AUTH_DIR = path.join(os.homedir(), '.config', 'whatsapp-bailey', 'auth_state')

const require = createRequire(import.meta.url)
const qrcode = require('qrcode-terminal')
import { getAuthState } from './auth.js'

const logger = P({ level: 'silent' })


export interface ConnectOptions {
  /** Called when connection is open */
  onOpen?: () => void
  /** Called on each messages.upsert event */
  onMessages?: (event: BaileysEventMap['messages.upsert']) => void
  /** Called on history sync (messaging-history.set) */
  onHistorySync?: (event: BaileysEventMap['messaging-history.set']) => void
  /** If true, keep the process alive (for REPL mode) */
  keepAlive?: boolean
}

/**
 * Create a Baileys socket, handle auth + reconnection.
 * Returns a promise that resolves with the socket once connected.
 */
let reconnectAttempt = 0
const MAX_RECONNECT_ATTEMPTS = 10

export function connect(opts: ConnectOptions = {}): Promise<WASocket> {
  return new Promise(async (resolve, reject) => {
    const { state, saveCreds } = await getAuthState()

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      version: [2, 3000, 1034074495],
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        qrcode.generate(qr, { small: true })
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        if (statusCode === DisconnectReason.loggedOut) {
          rmSync(AUTH_DIR, { recursive: true, force: true })
          console.error('Logged out. Run "wa auth" to re-authenticate.')
          reject(new Error('logged_out'))
        } else {
          // Reconnect with exponential backoff
          reconnectAttempt++
          if (reconnectAttempt > MAX_RECONNECT_ATTEMPTS) {
            reject(new Error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`))
            return
          }
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 60000)
          console.error(`Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})...`)
          setTimeout(() => connect(opts).then(resolve).catch(reject), delay)
        }
      } else if (connection === 'open') {
        reconnectAttempt = 0
        opts.onOpen?.()
        resolve(sock)
      }
    })

    if (opts.onMessages) {
      sock.ev.on('messages.upsert', opts.onMessages)
    }

    if (opts.onHistorySync) {
      sock.ev.on('messaging-history.set', opts.onHistorySync)
    }
  })
}
