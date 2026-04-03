import { useMultiFileAuthState } from 'baileys'
import { mkdirSync, chmodSync, readdirSync } from 'fs'
import path from 'path'
import os from 'os'

const AUTH_DIR = path.join(os.homedir(), '.config', 'wa-cli-mcp', 'auth_state')

export async function getAuthState() {
  // Create auth dir with owner-only permissions
  mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 })

  const result = await useMultiFileAuthState(AUTH_DIR)

  // Ensure all auth files are owner-only readable
  const origSaveCreds = result.saveCreds
  result.saveCreds = async () => {
    await origSaveCreds()
    try {
      for (const file of readdirSync(AUTH_DIR)) {
        chmodSync(path.join(AUTH_DIR, file), 0o600)
      }
    } catch {}
  }

  return result
}
