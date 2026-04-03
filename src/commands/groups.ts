import { connect } from '../client/connection.js'
import { listGroups } from '../utils/groups.js'

export async function groupsCommand(): Promise<void> {
  const sock = await connect()

  const groups = await listGroups(sock)

  if (groups.length === 0) {
    console.log('No groups found.')
  } else {
    console.log(`Found ${groups.length} groups:\n`)
    for (const g of groups) {
      console.log(`  ${g.subject} (${g.memberCount} members) — ${g.jid}`)
    }
  }

  sock.end(undefined)
  process.exit(0)
}
