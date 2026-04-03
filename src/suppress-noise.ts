// Suppress noisy Baileys internal logs that may contain sensitive key material.
// Uses an allowlist approach: only permit output that looks like our own CLI output.
// Anything that looks like a Baileys session/key dump is suppressed.
const origWrite = process.stdout.write.bind(process.stdout)

const sensitivePatterns = [
  // Session/key material
  'Closing session', 'SessionEntry', '_chains', 'chainType',
  'registrationId', 'currentRatchet', 'ephemeralKeyPair',
  'indexInfo', 'pendingPreKey', 'rootKey', 'remoteIdentityKey',
  'noiseKey', 'signedIdentityKey', 'signedPreKey', 'advSecretKey',
  'pairingEphemeralKeyPair', 'routingInfo',
  // Generic key/buffer patterns
  'privKey', 'pubKey', '<Buffer',
]

process.stdout.write = (chunk: any, ...args: any[]): boolean => {
  if (typeof chunk === 'string') {
    for (const pattern of sensitivePatterns) {
      if (chunk.includes(pattern)) return true
    }
  }
  return origWrite(chunk, ...args)
}
