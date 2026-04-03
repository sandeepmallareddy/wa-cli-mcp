import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { validateFilePath } from '../../src/messages/sender.js'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import path from 'path'
import os from 'os'

const TMP_DIR = path.join(os.tmpdir(), 'wa-cli-mcp-test')
const SAFE_FILE = path.join(TMP_DIR, 'safe.txt')

describe('validateFilePath', () => {
  // Setup and teardown
  beforeAll(() => {
    mkdirSync(TMP_DIR, { recursive: true })
    writeFileSync(SAFE_FILE, 'test content')
  })

  afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true })
  })

  it('resolves a valid file path', async () => {
    const result = await validateFilePath(SAFE_FILE)
    expect(result).toBe(SAFE_FILE)
  })

  it('throws for nonexistent file', async () => {
    await expect(validateFilePath('/tmp/nonexistent_xyz_123.txt')).rejects.toThrow('File not found')
  })

  it('blocks .ssh directory', async () => {
    const sshPath = path.join(os.homedir(), '.ssh', 'id_rsa')
    await expect(validateFilePath(sshPath)).rejects.toThrow(/denied|not found/)
  })

  it('blocks .aws directory', async () => {
    const awsPath = path.join(os.homedir(), '.aws', 'credentials')
    await expect(validateFilePath(awsPath)).rejects.toThrow(/denied|not found/)
  })

  it('blocks .gnupg directory', async () => {
    const gnupgPath = path.join(os.homedir(), '.gnupg', 'secring.gpg')
    await expect(validateFilePath(gnupgPath)).rejects.toThrow(/denied|not found/)
  })

  it('blocks auth_state directory', async () => {
    const authPath = path.join(os.homedir(), '.config', 'wa-cli-mcp', 'auth_state', 'creds.json')
    await expect(validateFilePath(authPath)).rejects.toThrow(/denied|not found/)
  })

  it('blocks .env files', async () => {
    const envFile = path.join(TMP_DIR, '.env')
    writeFileSync(envFile, 'SECRET=x')
    await expect(validateFilePath(envFile)).rejects.toThrow('denied')
  })

  it('blocks .env.local files', async () => {
    const envFile = path.join(TMP_DIR, '.env.local')
    writeFileSync(envFile, 'SECRET=x')
    await expect(validateFilePath(envFile)).rejects.toThrow('denied')
  })

  it('blocks creds.json', async () => {
    const credsFile = path.join(TMP_DIR, 'creds.json')
    writeFileSync(credsFile, '{}')
    await expect(validateFilePath(credsFile)).rejects.toThrow('denied')
  })

  it('blocks id_rsa', async () => {
    const keyFile = path.join(TMP_DIR, 'id_rsa')
    writeFileSync(keyFile, 'key')
    await expect(validateFilePath(keyFile)).rejects.toThrow('denied')
  })

  it('blocks id_ed25519', async () => {
    const keyFile = path.join(TMP_DIR, 'id_ed25519')
    writeFileSync(keyFile, 'key')
    await expect(validateFilePath(keyFile)).rejects.toThrow('denied')
  })
})
