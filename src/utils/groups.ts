import type { WASocket, GroupMetadata } from 'baileys'

export interface GroupInfo {
  jid: string
  subject: string
  memberCount: number
}

/**
 * Fetch all groups the account participates in.
 */
export async function listGroups(sock: WASocket): Promise<GroupInfo[]> {
  const groups = await sock.groupFetchAllParticipating()
  return Object.entries(groups).map(([jid, meta]) => ({
    jid,
    subject: meta.subject,
    memberCount: meta.participants.length,
  }))
}

/**
 * Resolve a group name or JID to a group JID.
 * - If input ends with @g.us, return as-is
 * - Otherwise, case-insensitive substring match on group subject
 * - Returns the JID if exactly one match, or throws with details
 */
export async function resolveGroup(
  sock: WASocket,
  nameOrJid: string
): Promise<string> {
  if (nameOrJid.endsWith('@g.us')) {
    return nameOrJid
  }

  const groups = await listGroups(sock)
  const query = nameOrJid.toLowerCase()
  const matches = groups.filter((g) =>
    g.subject.toLowerCase().includes(query)
  )

  if (matches.length === 0) {
    throw new Error(`No group found matching "${nameOrJid}". Run "wa groups" to see available groups.`)
  }

  if (matches.length > 1) {
    const list = matches.map((g) => `  ${g.subject} — ${g.jid}`).join('\n')
    throw new Error(
      `Multiple groups match "${nameOrJid}":\n${list}\n\nBe more specific or use the full JID.`
    )
  }

  return matches[0].jid
}
