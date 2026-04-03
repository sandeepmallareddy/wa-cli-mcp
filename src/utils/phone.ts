/**
 * Convert a phone number string to a WhatsApp JID.
 * Accepts formats: +919876543210, 919876543210, 09876543210
 */
export function phoneToJid(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) {
    throw new Error(`Invalid phone number: "${phone}" (must have at least 7 digits)`)
  }
  return `${digits}@s.whatsapp.net`
}

/**
 * Extract a readable phone number from a JID.
 * "919876543210@s.whatsapp.net" → "+919876543210"
 */
export function jidToPhone(jid: string): string {
  const num = jid.split('@')[0]
  return `+${num}`
}
