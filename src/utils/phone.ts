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

/**
 * Resolve all JIDs that WhatsApp may use for a phone number.
 * WhatsApp stores messages under LID JIDs instead of phone JIDs.
 * Tries:
 *   1. Signal repository LID mapping (getLIDForPN)
 *   2. Scanning the message store for LID JIDs (getPNForLID on each)
 * Returns all matching JIDs so callers can search both.
 */
export async function resolveJids(
  sock: any,
  phone: string,
  storeJids?: string[]
): Promise<string[]> {
  const phoneJid = phoneToJid(phone)
  const jids = new Set<string>([phoneJid])

  const repo = sock.signalRepository

  // Method 1: Direct lookup — phone → LID
  try {
    if (repo?.lidMapping?.getLIDForPN) {
      const lid = await repo.lidMapping.getLIDForPN(phoneJid)
      if (lid) jids.add(lid)
    }
  } catch {}

  // Method 2: Reverse lookup — scan store JIDs, check if any LID maps to this phone
  if (storeJids && repo?.lidMapping?.getPNForLID) {
    for (const jid of storeJids) {
      if (!jid.endsWith('@lid')) continue
      try {
        const pn = await repo.lidMapping.getPNForLID(jid)
        if (pn === phoneJid) jids.add(jid)
      } catch {}
    }
  }

  return [...jids]
}
