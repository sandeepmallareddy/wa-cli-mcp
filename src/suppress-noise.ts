// Must be imported before baileys to suppress its noisy console.log calls
// Override process.stdout.write to filter out "Closing session" noise
const origWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = (chunk: any, ...args: any[]): boolean => {
  if (typeof chunk === 'string' && chunk.includes('Closing session')) return true
  if (typeof chunk === 'string' && chunk.includes('_chains')) return true
  if (typeof chunk === 'string' && chunk.includes('SessionEntry')) return true
  if (typeof chunk === 'string' && chunk.includes('registrationId')) return true
  if (typeof chunk === 'string' && chunk.includes('currentRatchet')) return true
  if (typeof chunk === 'string' && chunk.includes('ephemeralKeyPair')) return true
  if (typeof chunk === 'string' && chunk.includes('indexInfo')) return true
  if (typeof chunk === 'string' && chunk.includes('pendingPreKey')) return true
  if (typeof chunk === 'string' && chunk.includes('rootKey')) return true
  if (typeof chunk === 'string' && chunk.includes('chainType')) return true
  if (typeof chunk === 'string' && chunk.includes('remoteIdentityKey')) return true
  return origWrite(chunk, ...args)
}
