import { connect } from '../client/connection.js'

export async function authCommand(): Promise<void> {
  console.log('Connecting to WhatsApp...')
  console.log('Scan the QR code with your phone if prompted.\n')

  try {
    const sock = await connect({
      onOpen: () => {
        console.log('\nAuthenticated successfully!')
        console.log('Session saved. You can now use other commands.')
      },
    })

    // Give a moment for creds to save, then exit
    setTimeout(() => {
      sock.end(undefined)
      process.exit(0)
    }, 2000)
  } catch (err: any) {
    if (err.message === 'logged_out') {
      console.error('Authentication failed. Please try again.')
    } else {
      console.error('Error:', err.message)
    }
    process.exit(1)
  }
}
