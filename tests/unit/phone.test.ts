import { describe, it, expect } from 'vitest'
import { phoneToJid, jidToPhone } from '../../src/utils/phone.js'

describe('phoneToJid', () => {
  it('converts phone with + prefix', () => {
    expect(phoneToJid('+919876543210')).toBe('919876543210@s.whatsapp.net')
  })

  it('converts phone without + prefix', () => {
    expect(phoneToJid('919876543210')).toBe('919876543210@s.whatsapp.net')
  })

  it('strips non-digit characters', () => {
    expect(phoneToJid('+91-9876-543210')).toBe('919876543210@s.whatsapp.net')
    expect(phoneToJid('+91 9876 543210')).toBe('919876543210@s.whatsapp.net')
    expect(phoneToJid('(91) 9876-543210')).toBe('919876543210@s.whatsapp.net')
  })

  it('throws on too few digits', () => {
    expect(() => phoneToJid('+12345')).toThrow('at least 7 digits')
    expect(() => phoneToJid('123')).toThrow('at least 7 digits')
  })

  it('throws on empty string', () => {
    expect(() => phoneToJid('')).toThrow('at least 7 digits')
  })

  it('handles numbers with leading zeros stripped', () => {
    expect(phoneToJid('09876543210')).toBe('09876543210@s.whatsapp.net')
  })
})

describe('jidToPhone', () => {
  it('converts JID to phone with + prefix', () => {
    expect(jidToPhone('919876543210@s.whatsapp.net')).toBe('+919876543210')
  })

  it('handles group JIDs', () => {
    expect(jidToPhone('120363XXX@g.us')).toBe('+120363XXX')
  })

  it('handles LID JIDs', () => {
    expect(jidToPhone('12345@lid')).toBe('+12345')
  })
})
