#!/usr/bin/env node

import './suppress-noise.js'
import { Command } from 'commander'
import { authCommand } from './commands/auth.js'
import { sendCommand } from './commands/send.js'
import { readCommand } from './commands/read.js'
import { replCommand } from './commands/repl.js'
import { groupsCommand } from './commands/groups.js'
import { sendGroupCommand } from './commands/send-group.js'
import { readGroupCommand } from './commands/read-group.js'
import { forwardCommand } from './commands/forward.js'
import { fetchHistoryCommand } from './commands/fetch-history.js'

const program = new Command()

program
  .name('wa')
  .description('WhatsApp CLI powered by Baileys')
  .version('1.0.0')

program
  .command('auth')
  .description('Authenticate with WhatsApp (scan QR code)')
  .action(authCommand)

program
  .command('send')
  .description('Send a message to a contact')
  .argument('<phone>', 'Phone number (e.g., +919876543210)')
  .argument('[text]', 'Text message or emoji (for reactions)')
  .option('--file <path>', 'Send a media file')
  .option('-m, --message <caption>', 'Caption for media file')
  .option('--reply <messageId>', 'Reply to a message (short ID from "wa read")')
  .option('--react <messageId>', 'React to a message (short ID from "wa read")')
  .option('--edit <messageId>', 'Edit a sent message (short ID)')
  .option('--delete <messageId>', 'Delete a message for everyone (short ID)')
  .action(sendCommand)

program
  .command('read')
  .description('Read messages from a contact')
  .argument('<phone>', 'Phone number (e.g., +919876543210)')
  .option('--last <count>', 'Number of messages to show', '20')
  .option('--media', 'Download media files to ./downloads/')
  .action(readCommand)

program
  .command('repl')
  .description('Interactive mode — stay connected and chat')
  .action(replCommand)

program
  .command('groups')
  .description('List all WhatsApp groups')
  .action(groupsCommand)

program
  .command('send-group')
  .description('Send a message to a group')
  .argument('<group>', 'Group name (substring match) or JID')
  .argument('[text]', 'Text message')
  .option('--file <path>', 'Send a media file')
  .option('-m, --message <caption>', 'Caption for media file')
  .action(sendGroupCommand)

program
  .command('read-group')
  .description('Read messages from a group')
  .argument('<group>', 'Group name (substring match) or JID')
  .option('--last <count>', 'Number of messages to show', '20')
  .option('--media', 'Download media files to ./downloads/')
  .action(readGroupCommand)

program
  .command('fetch-history')
  .description('Fetch older messages from a contact beyond what is synced on connect')
  .argument('<phone>', 'Phone number (e.g., +919876543210)')
  .option('--last <count>', 'Number of messages to fetch', '50')
  .option('--media', 'Download media files to ./downloads/')
  .action(fetchHistoryCommand)

program
  .command('forward')
  .description('Forward a message to another contact or group')
  .argument('<from-phone>', 'Source phone number (where the message is)')
  .argument('<message-id>', 'Short message ID to forward')
  .argument('<to>', 'Target phone number or group name')
  .action(forwardCommand)

program.parse()
