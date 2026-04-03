import { describe, it, expect } from 'vitest'
import type { WAMessage, BaileysEventMap } from 'baileys'
import { MessageStore } from '../../src/messages/reader.js'

function makeMsg(
  jid: string,
  id: string,
  text: string,
  timestamp: number,
  fromMe = false
): WAMessage {
  return {
    key: { remoteJid: jid, fromMe, id },
    messageTimestamp: timestamp,
    message: { conversation: text },
  } as WAMessage
}

describe('MessageStore', () => {
  describe('handleUpsert', () => {
    it('stores messages from upsert events', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      store.handleUpsert({
        type: 'notify',
        messages: [makeMsg(jid, 'id1', 'Hello', 1000)],
      })
      expect(store.getMessages(jid, 10)).toHaveLength(1)
    })

    it('accumulates messages across multiple upserts', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      store.handleUpsert({ type: 'notify', messages: [makeMsg(jid, 'id1', 'A', 1000)] })
      store.handleUpsert({ type: 'notify', messages: [makeMsg(jid, 'id2', 'B', 2000)] })
      expect(store.getMessages(jid, 10)).toHaveLength(2)
    })
  })

  describe('handleHistorySync', () => {
    it('stores messages from history sync', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      store.handleHistorySync({
        chats: [],
        contacts: [],
        messages: [makeMsg(jid, 'id1', 'Old message', 500)],
        isLatest: false,
      } as any)
      expect(store.getMessages(jid, 10)).toHaveLength(1)
    })
  })

  describe('getMessages', () => {
    it('filters by JID', () => {
      const store = new MessageStore()
      const jid1 = '911111111111@s.whatsapp.net'
      const jid2 = '912222222222@s.whatsapp.net'
      store.handleUpsert({
        type: 'notify',
        messages: [
          makeMsg(jid1, 'id1', 'For jid1', 1000),
          makeMsg(jid2, 'id2', 'For jid2', 2000),
          makeMsg(jid1, 'id3', 'Also for jid1', 3000),
        ],
      })
      expect(store.getMessages(jid1, 10)).toHaveLength(2)
      expect(store.getMessages(jid2, 10)).toHaveLength(1)
    })

    it('returns messages sorted by timestamp ascending', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      store.handleUpsert({
        type: 'notify',
        messages: [
          makeMsg(jid, 'id3', 'Third', 3000),
          makeMsg(jid, 'id1', 'First', 1000),
          makeMsg(jid, 'id2', 'Second', 2000),
        ],
      })
      const msgs = store.getMessages(jid, 10)
      expect(msgs[0].message?.conversation).toBe('First')
      expect(msgs[1].message?.conversation).toBe('Second')
      expect(msgs[2].message?.conversation).toBe('Third')
    })

    it('limits results to the most recent N messages', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      store.handleUpsert({
        type: 'notify',
        messages: [
          makeMsg(jid, 'id1', 'A', 1000),
          makeMsg(jid, 'id2', 'B', 2000),
          makeMsg(jid, 'id3', 'C', 3000),
          makeMsg(jid, 'id4', 'D', 4000),
        ],
      })
      const msgs = store.getMessages(jid, 2)
      expect(msgs).toHaveLength(2)
      expect(msgs[0].message?.conversation).toBe('C')
      expect(msgs[1].message?.conversation).toBe('D')
    })

    it('returns empty array for unknown JID', () => {
      const store = new MessageStore()
      expect(store.getMessages('unknown@s.whatsapp.net', 10)).toEqual([])
    })
  })

  describe('findByShortId', () => {
    it('finds message by last 8 chars of ID', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      store.handleUpsert({
        type: 'notify',
        messages: [makeMsg(jid, 'PREFIX_12345678', 'Found me', 1000)],
      })
      const found = store.findByShortId(jid, '12345678')
      expect(found).toBeDefined()
      expect(found?.message?.conversation).toBe('Found me')
    })

    it('returns undefined for non-matching ID', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      store.handleUpsert({
        type: 'notify',
        messages: [makeMsg(jid, 'PREFIX_12345678', 'Hello', 1000)],
      })
      expect(store.findByShortId(jid, 'NOMATCH1')).toBeUndefined()
    })

    it('scopes lookup to the correct JID', () => {
      const store = new MessageStore()
      const jid1 = '911111111111@s.whatsapp.net'
      const jid2 = '912222222222@s.whatsapp.net'
      store.handleUpsert({
        type: 'notify',
        messages: [makeMsg(jid1, 'PREFIX_12345678', 'In jid1', 1000)],
      })
      expect(store.findByShortId(jid2, '12345678')).toBeUndefined()
    })
  })

  describe('enforceLimit', () => {
    it('evicts oldest messages when over limit', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      const messages = Array.from({ length: 20 }, (_, i) =>
        makeMsg(jid, `id${i}`, `Msg ${i}`, 1000 + i)
      )
      store.handleUpsert({ type: 'notify', messages })
      store.enforceLimit(5)
      const remaining = store.getMessages(jid, 100)
      expect(remaining).toHaveLength(5)
      // Should keep the last 5
      expect(remaining[0].message?.conversation).toBe('Msg 15')
    })

    it('does nothing when under limit', () => {
      const store = new MessageStore()
      const jid = '919876543210@s.whatsapp.net'
      store.handleUpsert({
        type: 'notify',
        messages: [makeMsg(jid, 'id1', 'A', 1000), makeMsg(jid, 'id2', 'B', 2000)],
      })
      store.enforceLimit(10)
      expect(store.getMessages(jid, 100)).toHaveLength(2)
    })
  })
})
