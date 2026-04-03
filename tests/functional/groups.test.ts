import { describe, it, expect, vi } from 'vitest'
import type { WASocket } from 'baileys'
import { listGroups, resolveGroup } from '../../src/utils/groups.js'

function mockSocket(groups: Record<string, { subject: string; participants: any[] }>): WASocket {
  return {
    groupFetchAllParticipating: vi.fn().mockResolvedValue(groups),
  } as unknown as WASocket
}

const sampleGroups = {
  '120363001@g.us': {
    subject: 'Test Group',
    participants: [{ id: '911111@s.whatsapp.net' }, { id: '912222@s.whatsapp.net' }],
  },
  '120363002@g.us': {
    subject: 'Family Chat',
    participants: [{ id: '911111@s.whatsapp.net' }],
  },
  '120363003@g.us': {
    subject: 'Work Team',
    participants: [
      { id: '911111@s.whatsapp.net' },
      { id: '912222@s.whatsapp.net' },
      { id: '913333@s.whatsapp.net' },
    ],
  },
}

describe('listGroups', () => {
  it('returns all groups with JID, subject, and member count', async () => {
    const sock = mockSocket(sampleGroups)
    const groups = await listGroups(sock)
    expect(groups).toHaveLength(3)
    expect(groups).toContainEqual({
      jid: '120363001@g.us',
      subject: 'Test Group',
      memberCount: 2,
    })
    expect(groups).toContainEqual({
      jid: '120363003@g.us',
      subject: 'Work Team',
      memberCount: 3,
    })
  })

  it('returns empty array when no groups', async () => {
    const sock = mockSocket({})
    const groups = await listGroups(sock)
    expect(groups).toEqual([])
  })
})

describe('resolveGroup', () => {
  it('returns JID as-is if it ends with @g.us', async () => {
    const sock = mockSocket(sampleGroups)
    const jid = await resolveGroup(sock, '120363001@g.us')
    expect(jid).toBe('120363001@g.us')
  })

  it('resolves group by exact name (case-insensitive)', async () => {
    const sock = mockSocket(sampleGroups)
    const jid = await resolveGroup(sock, 'test group')
    expect(jid).toBe('120363001@g.us')
  })

  it('resolves group by substring match', async () => {
    const sock = mockSocket(sampleGroups)
    const jid = await resolveGroup(sock, 'Family')
    expect(jid).toBe('120363002@g.us')
  })

  it('throws when no group matches', async () => {
    const sock = mockSocket(sampleGroups)
    await expect(resolveGroup(sock, 'Nonexistent')).rejects.toThrow('No group found')
  })

  it('throws when multiple groups match', async () => {
    const groups = {
      '120363001@g.us': {
        subject: 'Dev Team Alpha',
        participants: [{ id: '911111@s.whatsapp.net' }],
      },
      '120363002@g.us': {
        subject: 'Dev Team Beta',
        participants: [{ id: '911111@s.whatsapp.net' }],
      },
    }
    const sock = mockSocket(groups)
    await expect(resolveGroup(sock, 'Dev Team')).rejects.toThrow('Multiple groups match')
  })
})
