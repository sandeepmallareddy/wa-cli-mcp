import { describe, it, expect } from 'vitest'
import type { WAMessage } from 'baileys'
import {
  shortMessageId,
  formatTimestamp,
  extractText,
  getMediaType,
  getMediaCaption,
  formatMessage,
  formatGroupMessage,
} from '../../src/utils/format.js'

// Helper to create a minimal WAMessage
function makeMsg(overrides: Partial<WAMessage> = {}): WAMessage {
  return {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      fromMe: false,
      id: 'ABCDEF1234567890',
    },
    messageTimestamp: 1712134560,
    message: { conversation: 'Hello world' },
    ...overrides,
  } as WAMessage
}

describe('shortMessageId', () => {
  it('returns last 8 characters', () => {
    expect(shortMessageId('ABCDEF1234567890')).toBe('34567890')
  })

  it('returns full string if less than 8 chars', () => {
    expect(shortMessageId('ABC')).toBe('ABC')
  })

  it('handles empty string', () => {
    expect(shortMessageId('')).toBe('')
  })
})

describe('formatTimestamp', () => {
  it('formats epoch seconds to local datetime string', () => {
    const result = formatTimestamp(1712134560)
    // Should be in YYYY-MM-DD HH:MM format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('handles epoch 0', () => {
    const result = formatTimestamp(0)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })
})

describe('extractText', () => {
  it('extracts conversation text', () => {
    const msg = makeMsg({ message: { conversation: 'Hello' } })
    expect(extractText(msg)).toBe('Hello')
  })

  it('extracts extended text', () => {
    const msg = makeMsg({
      message: { extendedTextMessage: { text: 'Extended hello' } } as any,
    })
    expect(extractText(msg)).toBe('Extended hello')
  })

  it('returns null for no message', () => {
    const msg = makeMsg({ message: undefined })
    expect(extractText(msg)).toBeNull()
  })

  it('returns null for media-only message', () => {
    const msg = makeMsg({
      message: { imageMessage: { mimetype: 'image/jpeg' } } as any,
    })
    expect(extractText(msg)).toBeNull()
  })
})

describe('getMediaType', () => {
  it('detects image', () => {
    const msg = makeMsg({ message: { imageMessage: {} } as any })
    expect(getMediaType(msg)).toBe('image')
  })

  it('detects video', () => {
    const msg = makeMsg({ message: { videoMessage: {} } as any })
    expect(getMediaType(msg)).toBe('video')
  })

  it('detects audio', () => {
    const msg = makeMsg({ message: { audioMessage: {} } as any })
    expect(getMediaType(msg)).toBe('audio')
  })

  it('detects document', () => {
    const msg = makeMsg({ message: { documentMessage: {} } as any })
    expect(getMediaType(msg)).toBe('document')
  })

  it('detects sticker', () => {
    const msg = makeMsg({ message: { stickerMessage: {} } as any })
    expect(getMediaType(msg)).toBe('sticker')
  })

  it('returns null for text message', () => {
    const msg = makeMsg()
    expect(getMediaType(msg)).toBeNull()
  })

  it('returns null for no message', () => {
    const msg = makeMsg({ message: undefined })
    expect(getMediaType(msg)).toBeNull()
  })
})

describe('getMediaCaption', () => {
  it('gets image caption', () => {
    const msg = makeMsg({
      message: { imageMessage: { caption: 'Nice pic' } } as any,
    })
    expect(getMediaCaption(msg)).toBe('Nice pic')
  })

  it('gets video caption', () => {
    const msg = makeMsg({
      message: { videoMessage: { caption: 'Cool video' } } as any,
    })
    expect(getMediaCaption(msg)).toBe('Cool video')
  })

  it('returns null when no caption', () => {
    const msg = makeMsg({
      message: { imageMessage: { mimetype: 'image/jpeg' } } as any,
    })
    expect(getMediaCaption(msg)).toBeNull()
  })
})

describe('formatMessage', () => {
  it('formats a text message', () => {
    const msg = makeMsg()
    const result = formatMessage(msg)
    expect(result).toContain('34567890')
    expect(result).toContain('+919876543210')
    expect(result).toContain('Hello world')
  })

  it('formats own message with "You"', () => {
    const msg = makeMsg({
      key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: true, id: 'ABCDEF1234567890' },
    })
    const result = formatMessage(msg)
    expect(result).toContain('You')
  })

  it('formats media message', () => {
    const msg = makeMsg({
      message: { imageMessage: { caption: 'Vacation' } } as any,
    })
    const result = formatMessage(msg)
    expect(result).toContain('image')
    expect(result).toContain('Vacation')
  })

  it('formats media message with saved path', () => {
    const msg = makeMsg({
      message: { imageMessage: { caption: 'Pic' } } as any,
    })
    const result = formatMessage(msg, '/tmp/photo.jpg')
    expect(result).toContain('/tmp/photo.jpg')
  })

  it('formats reaction message', () => {
    const msg = makeMsg({
      message: {
        reactionMessage: {
          text: '👍',
          key: { remoteJid: '919876543210@s.whatsapp.net', id: 'target123' },
        },
      } as any,
    })
    const result = formatMessage(msg)
    expect(result).toContain('👍')
    expect(result).toContain('reaction')
  })

  it('formats unsupported message type', () => {
    const msg = makeMsg({ message: {} as any })
    const result = formatMessage(msg)
    expect(result).toContain('unsupported message type')
  })

  it('shows ??? for missing timestamp', () => {
    const msg = makeMsg({ messageTimestamp: undefined })
    const result = formatMessage(msg)
    expect(result).toContain('???')
  })
})

describe('formatGroupMessage', () => {
  it('shows participant name and phone', () => {
    const msg = makeMsg({
      key: {
        remoteJid: '120363XXX@g.us',
        fromMe: false,
        id: 'ABCDEF1234567890',
        participant: '919876543210@s.whatsapp.net',
      },
      pushName: 'Sandeep',
    })
    const result = formatGroupMessage(msg)
    expect(result).toContain('Sandeep')
    expect(result).toContain('+919876543210')
  })

  it('shows phone only when no pushName', () => {
    const msg = makeMsg({
      key: {
        remoteJid: '120363XXX@g.us',
        fromMe: false,
        id: 'ABCDEF1234567890',
        participant: '919876543210@s.whatsapp.net',
      },
      pushName: undefined,
    })
    const result = formatGroupMessage(msg)
    expect(result).toContain('+919876543210')
    expect(result).not.toContain('undefined')
  })

  it('shows "You" for own messages', () => {
    const msg = makeMsg({
      key: {
        remoteJid: '120363XXX@g.us',
        fromMe: true,
        id: 'ABCDEF1234567890',
      },
    })
    const result = formatGroupMessage(msg)
    expect(result).toContain('You')
  })
})
