import { describe, it, expect, vi, beforeEach } from 'vitest'
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
