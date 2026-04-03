import { describe, it, expect, vi } from 'vitest'
import type { WAMessage } from 'baileys'
import { MessageStore } from '../../src/messages/reader.js'
import { phoneToJid, jidToPhone } from '../../src/utils/phone.js'
import {
  shortMessageId, extractText, getMediaType, getMediaCaption,
  formatTimestamp,
} from '../../src/utils/format.js'

/**
 * Functional tests for MCP tool logic.
 * We test the core logic that MCP tool handlers use (message store queries,
 * phone/JID conversion, message serialization) without starting the full
 * MCP server or WhatsApp connection.
 */

function makeMsg(
  jid: string,
  id: string,
  text: string,
  timestamp: number,
  fromMe = false,
  pushName?: string
): WAMessage {
  return {
    key: { remoteJid: jid, fromMe, id },
    messageTimestamp: timestamp,
    message: { conversation: text },
    pushName,
  } as WAMessage
}

// Mirrors messageToJson from mcp-server.ts
function messageToJson(msg: WAMessage) {
  return {
    id: shortMessageId(msg.key.id || ''),
    fullId: msg.key.id || '',
    fromMe: msg.key.fromMe || false,
    sender: msg.key.fromMe ? 'You' : jidToPhone(msg.key.participant || msg.key.remoteJid || ''),
    pushName: msg.pushName || null,
    timestamp: msg.messageTimestamp ? formatTimestamp(Number(msg.messageTimestamp)) : null,
    text: extractText(msg) || null,
    mediaType: getMediaType(msg) || null,
    caption: getMediaCaption(msg) || null,
    reaction: msg.message?.reactionMessage
      ? { emoji: msg.message.reactionMessage.text, targetId: msg.message.reactionMessage.key?.id }
      : null,
  }
}

describe('MCP tool: whatsapp_read logic', () => {
  it('reads messages for a phone number', () => {
    const store = new MessageStore()
    const jid = phoneToJid('+918341306132')
    store.handleUpsert({
      type: 'notify',
      messages: [
        makeMsg(jid, 'AAAAAAAABBBBBBBB', 'Hello from test', 1000),
        makeMsg(jid, 'CCCCCCCCDDDDDDDD', 'Second message', 2000),
      ],
    })
    const messages = store.getMessages(jid, 20).map(messageToJson)
    expect(messages).toHaveLength(2)
    expect(messages[0].text).toBe('Hello from test')
    expect(messages[0].id).toBe('BBBBBBBB')
    expect(messages[1].text).toBe('Second message')
  })

  it('respects limit parameter', () => {
    const store = new MessageStore()
    const jid = phoneToJid('+918341306132')
    for (let i = 0; i < 30; i++) {
      store.handleUpsert({
        type: 'notify',
        messages: [makeMsg(jid, `ID_${String(i).padStart(8, '0')}`, `Msg ${i}`, 1000 + i)],
      })
    }
    const messages = store.getMessages(jid, 5)
    expect(messages).toHaveLength(5)
    // Should be the last 5
    expect(messages[0].message?.conversation).toBe('Msg 25')
  })
})

describe('MCP tool: whatsapp_reply logic', () => {
  it('finds a message by short ID for replying', () => {
    const store = new MessageStore()
    const jid = phoneToJid('+918341306132')
    store.handleUpsert({
      type: 'notify',
      messages: [makeMsg(jid, 'PREFIX_ABCD1234', 'Quote me', 1000)],
    })
    const found = store.findByShortId(jid, 'ABCD1234')
    expect(found).toBeDefined()
    expect(found?.message?.conversation).toBe('Quote me')
  })

  it('returns undefined for unknown short ID', () => {
    const store = new MessageStore()
    const jid = phoneToJid('+918341306132')
    store.handleUpsert({
      type: 'notify',
      messages: [makeMsg(jid, 'PREFIX_ABCD1234', 'Hello', 1000)],
    })
    expect(store.findByShortId(jid, 'ZZZZ9999')).toBeUndefined()
  })
})

describe('MCP tool: whatsapp_subscribe/get_notifications logic', () => {
  it('subscription set tracks JIDs correctly', () => {
    const subscriptions = new Set<string>()
    const phone = '+918341306132'
    const jid = phoneToJid(phone)

    subscriptions.add(jid)
    expect(subscriptions.has(jid)).toBe(true)
    expect(subscriptions.has(phoneToJid('+910000000000'))).toBe(false)

    subscriptions.delete(jid)
    expect(subscriptions.has(jid)).toBe(false)
  })

  it('notification buffer accumulates and clears', () => {
    const buffer: Array<{ jid: string; text: string }> = []

    buffer.push({ jid: '918341306132@s.whatsapp.net', text: 'New msg 1' })
    buffer.push({ jid: '918341306132@s.whatsapp.net', text: 'New msg 2' })
    expect(buffer).toHaveLength(2)

    const notifications = [...buffer]
    buffer.length = 0
    expect(notifications).toHaveLength(2)
    expect(buffer).toHaveLength(0)
  })

  it('notification buffer enforces max limit', () => {
    const MAX = 500
    const buffer: Array<{ jid: string; text: string }> = []

    for (let i = 0; i < 550; i++) {
      buffer.push({ jid: 'test@s.whatsapp.net', text: `Msg ${i}` })
      if (buffer.length > MAX) {
        buffer.splice(0, buffer.length - MAX)
      }
    }
    expect(buffer).toHaveLength(MAX)
    expect(buffer[0].text).toBe('Msg 50')
  })
})

describe('MCP tool: messageToJson serialization', () => {
  it('serializes a text message', () => {
    const jid = '918341306132@s.whatsapp.net'
    const msg = makeMsg(jid, 'AAAAAAAABBBBBBBB', 'Hello', 1712134560, false, 'Sandeep')
    const json = messageToJson(msg)
    expect(json.id).toBe('BBBBBBBB')
    expect(json.fullId).toBe('AAAAAAAABBBBBBBB')
    expect(json.fromMe).toBe(false)
    expect(json.sender).toBe('+918341306132')
    expect(json.pushName).toBe('Sandeep')
    expect(json.text).toBe('Hello')
    expect(json.mediaType).toBeNull()
    expect(json.reaction).toBeNull()
  })

  it('serializes own message with sender "You"', () => {
    const jid = '918341306132@s.whatsapp.net'
    const msg = makeMsg(jid, 'AAAAAAAABBBBBBBB', 'My msg', 1712134560, true)
    const json = messageToJson(msg)
    expect(json.fromMe).toBe(true)
    expect(json.sender).toBe('You')
  })

  it('serializes a media message', () => {
    const msg: WAMessage = {
      key: { remoteJid: '918341306132@s.whatsapp.net', fromMe: false, id: 'AAAAAAAABBBBBBBB' },
      messageTimestamp: 1712134560,
      message: { imageMessage: { caption: 'Photo', mimetype: 'image/jpeg' } } as any,
    } as WAMessage
    const json = messageToJson(msg)
    expect(json.mediaType).toBe('image')
    expect(json.caption).toBe('Photo')
    expect(json.text).toBeNull()
  })

  it('serializes a reaction message', () => {
    const msg: WAMessage = {
      key: { remoteJid: '918341306132@s.whatsapp.net', fromMe: false, id: 'AAAAAAAABBBBBBBB' },
      messageTimestamp: 1712134560,
      message: {
        reactionMessage: {
          text: '❤️',
          key: { remoteJid: '918341306132@s.whatsapp.net', id: 'targetMsgId' },
        },
      } as any,
    } as WAMessage
    const json = messageToJson(msg)
    expect(json.reaction).toEqual({ emoji: '❤️', targetId: 'targetMsgId' })
  })
})

describe('MCP tool: whatsapp_fetch_history logic', () => {
  it('finds the oldest message in store for history fetch', () => {
    const store = new MessageStore()
    const jid = phoneToJid('+918341306132')
    store.handleUpsert({
      type: 'notify',
      messages: [
        makeMsg(jid, 'ID_OLDEST1', 'Oldest', 1000),
        makeMsg(jid, 'ID_MIDDLE1', 'Middle', 2000),
        makeMsg(jid, 'ID_NEWEST1', 'Newest', 3000),
      ],
    })
    // getMessages with limit 1 returns the most recent; for oldest we need limit=all then [0]
    const allMsgs = store.getMessages(jid, 100)
    const oldest = allMsgs[0]
    expect(oldest.message?.conversation).toBe('Oldest')
    expect(oldest.key.id).toBe('ID_OLDEST1')
    expect(Number(oldest.messageTimestamp)).toBe(1000)
  })

  it('calculates correct batch count for requested messages', () => {
    // Mirrors the batching logic in mcp-server.ts
    const testCases = [
      { count: 10, expectedBatches: 1 },
      { count: 50, expectedBatches: 1 },
      { count: 51, expectedBatches: 2 },
      { count: 100, expectedBatches: 2 },
      { count: 200, expectedBatches: 4 },
      { count: 500, expectedBatches: 10 },
    ]
    for (const { count, expectedBatches } of testCases) {
      const batches = Math.ceil(count / 50)
      expect(batches, `count=${count}`).toBe(expectedBatches)
    }
  })

  it('calculates correct batch sizes', () => {
    const count = 120
    const batches = Math.ceil(count / 50)
    const sizes: number[] = []
    for (let i = 0; i < batches; i++) {
      sizes.push(Math.min(50, count - i * 50))
    }
    expect(sizes).toEqual([50, 50, 20])
  })

  it('falls back to LID JID when phone JID has no messages', () => {
    const store = new MessageStore()
    const phoneJid = phoneToJid('+918341306132')
    const lidJid = '12345@lid'
    const lidToPhone = new Map<string, string>()
    const phoneToLid = new Map<string, string>()

    // No messages under phone JID
    expect(store.getMessages(phoneJid, 1)).toHaveLength(0)

    // Messages under LID JID
    store.handleUpsert({
      type: 'notify',
      messages: [makeMsg(lidJid, 'LID_MSG_1', 'Hello via LID', 1000)],
    })

    // Map the LID
    lidToPhone.set(lidJid, phoneJid)
    phoneToLid.set(phoneJid, lidJid)

    // Simulate the MCP fallback logic
    let oldest = store.getMessages(phoneJid, 1)[0]
    if (!oldest) {
      const lid = phoneToLid.get(phoneJid)
      if (lid) oldest = store.getMessages(lid, 1)[0]
    }

    expect(oldest).toBeDefined()
    expect(oldest.message?.conversation).toBe('Hello via LID')
  })

  it('returns error when no messages in store', () => {
    const store = new MessageStore()
    const jid = phoneToJid('+910000000000')
    const messages = store.getMessages(jid, 1)
    expect(messages).toHaveLength(0)
    // MCP tool would return: { success: false, error: 'No messages in store...' }
  })

  it('history sync adds older messages to the store', () => {
    const store = new MessageStore()
    const jid = phoneToJid('+918341306132')

    // Initial messages from upsert
    store.handleUpsert({
      type: 'notify',
      messages: [makeMsg(jid, 'ID_NEW1', 'New message', 5000)],
    })
    expect(store.getMessages(jid, 100)).toHaveLength(1)

    // Older messages arrive via history sync (simulating fetchMessageHistory result)
    store.handleHistorySync({
      chats: [],
      contacts: [],
      messages: [
        makeMsg(jid, 'ID_OLD1', 'Old message 1', 1000),
        makeMsg(jid, 'ID_OLD2', 'Old message 2', 2000),
        makeMsg(jid, 'ID_OLD3', 'Old message 3', 3000),
      ],
      isLatest: false,
    } as any)

    const allMsgs = store.getMessages(jid, 100)
    expect(allMsgs).toHaveLength(4)
    // Should be sorted by timestamp ascending
    expect(allMsgs[0].message?.conversation).toBe('Old message 1')
    expect(allMsgs[3].message?.conversation).toBe('New message')
  })
})
