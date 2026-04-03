import { useMultiFileAuthState } from '@whiskeysockets/baileys'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'auth_state')

export async function getAuthState() {
  return useMultiFileAuthState(AUTH_DIR)
}
