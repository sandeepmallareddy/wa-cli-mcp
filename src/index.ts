#!/usr/bin/env node

import { Command } from 'commander'
import { authCommand } from './commands/auth.js'
import { sendCommand } from './commands/send.js'
import { readCommand } from './commands/read.js'
import { replCommand } from './commands/repl.js'

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

program.parse()
