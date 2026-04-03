#!/usr/bin/env node

import './suppress-noise.js'
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { WASocket, WAMessage } from 'baileys'
import { connect } from './client/connection.js'
import { MessageStore } from './messages/reader.js'
import {
  sendText, sendMedia, sendReply, sendReaction,
  editMessage, deleteMessage, forwardMessage,
} from './messages/sender.js'
import { downloadMedia } from './messages/media.js'
import { phoneToJid, jidToPhone } from './utils/phone.js'
import {
  extractText, getMediaType, getMediaCaption,
  formatTimestamp, shortMessageId,
} from './utils/format.js'
import { listGroups, resolveGroup } from './utils/groups.js'

// --- State ---
let sock: WASocket
const store = new MessageStore()
const subscriptions = new Set<string>()
const notificationBuffer: Array<{
  jid: string; sender: string; text: string;
  timestamp: number; messageId: string
}> = []

// --- Helpers ---

function suppressLog<T>(fn: () => Promise<T>): Promise<T> {
  const orig = console.log
  console.log = () => {}
  return fn().finally(() => { console.log = orig })
}

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

async function resolveTarget(target: string): Promise<string> {
  if (target.endsWith('@g.us') || target.endsWith('@s.whatsapp.net')) return target
  if (target.match(/^\+?\d{7,}$/)) return phoneToJid(target)
  return resolveGroup(sock, target)
}

function ok(data: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

// --- MCP Server ---

const server = new McpServer({ name: 'wa-cli-mcp', version: '1.0.0' })

server.registerTool(
  'whatsapp_send',
  {
    description: 'Send a text message to a WhatsApp contact',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code, e.g. +919876543210'),
      text: z.string().describe('Message text'),
    }),
  },
  async ({ phone, text }) => {
    await suppressLog(() => sendText(sock, phoneToJid(phone), text))
    return ok({ success: true, to: phone })
  }
)

server.registerTool(
  'whatsapp_send_media',
  {
    description: 'Send a media file (image, video, document, voice note) to a contact',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code'),
      filePath: z.string().describe('Absolute path to the file to send'),
      caption: z.string().optional().describe('Optional caption'),
    }),
  },
  async ({ phone, filePath, caption }) => {
    await suppressLog(() => sendMedia(sock, phoneToJid(phone), filePath, caption))
    return ok({ success: true, to: phone, file: filePath })
  }
)

server.registerTool(
  'whatsapp_read',
  {
    description: 'Read recent messages from a WhatsApp contact',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code'),
      limit: z.number().optional().default(20).describe('Number of messages to return (default 20)'),
    }),
  },
  async ({ phone, limit }) => {
    const messages = store.getMessages(phoneToJid(phone), limit).map(messageToJson)
    return ok({ messages, count: messages.length })
  }
)

server.registerTool(
  'whatsapp_reply',
  {
    description: 'Send a quoted reply to a specific message',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code'),
      messageId: z.string().describe('Short message ID (8 chars) from whatsapp_read'),
      text: z.string().describe('Reply text'),
    }),
  },
  async ({ phone, messageId, text }) => {
    const jid = phoneToJid(phone)
    const msg = store.findByShortId(jid, messageId)
    if (!msg) return ok({ error: `Message "${messageId}" not found` })
    await suppressLog(() => sendReply(sock, jid, text, msg))
    return ok({ success: true, repliedTo: messageId })
  }
)

server.registerTool(
  'whatsapp_react',
  {
    description: 'React to a message with an emoji',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code'),
      messageId: z.string().describe('Short message ID (8 chars)'),
      emoji: z.string().describe('Emoji to react with, e.g. 👍'),
    }),
  },
  async ({ phone, messageId, emoji }) => {
    const jid = phoneToJid(phone)
    const msg = store.findByShortId(jid, messageId)
    await suppressLog(() => sendReaction(sock, jid, emoji, msg?.key.id || messageId, msg?.key.fromMe || false))
    return ok({ success: true, emoji, messageId })
  }
)

server.registerTool(
  'whatsapp_edit',
  {
    description: 'Edit a previously sent message',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code'),
      messageId: z.string().describe('Short message ID (8 chars) of your sent message'),
      newText: z.string().describe('New message text'),
    }),
  },
  async ({ phone, messageId, newText }) => {
    const jid = phoneToJid(phone)
    const msg = store.findByShortId(jid, messageId)
    await suppressLog(() => editMessage(sock, jid, msg?.key.id || messageId, newText))
    return ok({ success: true, edited: messageId })
  }
)

server.registerTool(
  'whatsapp_delete',
  {
    description: 'Delete a message for everyone',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code'),
      messageId: z.string().describe('Short message ID (8 chars)'),
    }),
  },
  async ({ phone, messageId }) => {
    const jid = phoneToJid(phone)
    const msg = store.findByShortId(jid, messageId)
    await suppressLog(() => deleteMessage(sock, jid, msg?.key.id || messageId, msg?.key.fromMe ?? true))
    return ok({ success: true, deleted: messageId })
  }
)

server.registerTool(
  'whatsapp_forward',
  {
    description: 'Forward a message to another contact or group',
    inputSchema: z.object({
      fromPhone: z.string().describe('Source phone number where the message is'),
      messageId: z.string().describe('Short message ID (8 chars) to forward'),
      toTarget: z.string().describe('Destination: phone number or group name'),
    }),
  },
  async ({ fromPhone, messageId, toTarget }) => {
    const msg = store.findByShortId(phoneToJid(fromPhone), messageId)
    if (!msg) return ok({ error: `Message "${messageId}" not found` })
    const targetJid = await resolveTarget(toTarget)
    await suppressLog(() => forwardMessage(sock, targetJid, msg))
    return ok({ success: true, forwarded: messageId, to: toTarget })
  }
)

server.registerTool(
  'whatsapp_groups',
  {
    description: 'List all WhatsApp groups',
    inputSchema: z.object({}),
  },
  async () => {
    const groups = await listGroups(sock)
    return ok({ groups, count: groups.length })
  }
)

server.registerTool(
  'whatsapp_send_group',
  {
    description: 'Send a text message to a WhatsApp group',
    inputSchema: z.object({
      groupName: z.string().describe('Group name (substring match) or full JID'),
      text: z.string().describe('Message text'),
    }),
  },
  async ({ groupName, text }) => {
    const jid = await resolveGroup(sock, groupName)
    await suppressLog(() => sendText(sock, jid, text))
    return ok({ success: true, group: groupName })
  }
)

server.registerTool(
  'whatsapp_read_group',
  {
    description: 'Read recent messages from a WhatsApp group',
    inputSchema: z.object({
      groupName: z.string().describe('Group name (substring match) or full JID'),
      limit: z.number().optional().default(20).describe('Number of messages (default 20)'),
    }),
  },
  async ({ groupName, limit }) => {
    const jid = await resolveGroup(sock, groupName)
    const messages = store.getMessages(jid, limit).map(messageToJson)
    return ok({ messages, count: messages.length })
  }
)

server.registerTool(
  'whatsapp_subscribe',
  {
    description: 'Subscribe to incoming messages from a contact or group. Use whatsapp_get_notifications to fetch buffered messages.',
    inputSchema: z.object({
      target: z.string().describe('Phone number (e.g. +919876543210) or group name'),
    }),
  },
  async ({ target }) => {
    const jid = await resolveTarget(target)
    subscriptions.add(jid)
    return ok({ success: true, subscribed: target, jid })
  }
)

server.registerTool(
  'whatsapp_unsubscribe',
  {
    description: 'Unsubscribe from incoming messages',
    inputSchema: z.object({
      target: z.string().describe('Phone number or group name'),
    }),
  },
  async ({ target }) => {
    const jid = await resolveTarget(target)
    subscriptions.delete(jid)
    return ok({ success: true, unsubscribed: target })
  }
)

server.registerTool(
  'whatsapp_get_notifications',
  {
    description: 'Fetch new incoming messages from subscribed contacts/groups. Clears buffer after reading.',
    inputSchema: z.object({}),
  },
  async () => {
    const notifications = [...notificationBuffer]
    notificationBuffer.length = 0
    return ok({
      notifications,
      count: notifications.length,
      subscriptions: [...subscriptions].map(jid =>
        jid.endsWith('@g.us') ? jid : jidToPhone(jid)
      ),
    })
  }
)

// --- Startup ---

async function main() {
  sock = await connect({
    onMessages: (event) => {
      store.handleUpsert(event)
      if (event.type === 'notify') {
        for (const msg of event.messages) {
          if (msg.key.fromMe) continue
          const jid = msg.key.remoteJid || ''
          if (subscriptions.has(jid)) {
            notificationBuffer.push({
              jid,
              sender: msg.key.participant
                ? `${msg.pushName || ''} (${jidToPhone(msg.key.participant)})`.trim()
                : jidToPhone(jid),
              text: extractText(msg) || getMediaType(msg) || '[unsupported]',
              timestamp: Number(msg.messageTimestamp || 0),
              messageId: shortMessageId(msg.key.id || ''),
            })
          }
        }
      }
    },
    onHistorySync: (event) => store.handleHistorySync(event),
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  process.stderr.write(`Failed to start wa-cli-mcp: ${err.message}\n`)
  process.exit(1)
})
