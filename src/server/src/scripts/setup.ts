import { nanoid } from 'nanoid'
import { initializeDatabase } from '../database/schema'
import { closeDatabase } from '../database/config'
import { ADMIN_INVITE_ID_LENGTH } from '../config/constants'

async function setup() {
  console.log('Setting up NexusDrop database...')

  const db = initializeDatabase()

  const existingInvitesQuery = db.prepare('SELECT COUNT(*) as count FROM invites')
  const { count } = existingInvitesQuery.get() as { count: number }

  if (count === 0) {
    const adminInviteCode = `NEXUS-ADMIN-${nanoid(ADMIN_INVITE_ID_LENGTH).toUpperCase()}`
    
    const insertInviteQuery = db.prepare(`
      INSERT INTO invites (id, role_to_grant, created_by_id, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `)

    insertInviteQuery.run(adminInviteCode, 'admin', 'system')
    
    console.log('✅ Database initialized successfully!')
    console.log(`🔑 Admin invite code created: ${adminInviteCode}`)
    console.log('   Use this code to register the first admin user.')
  } else {
    console.log('✅ Database already initialized.')
    
    const unusedInvitesQuery = db.prepare('SELECT id, role_to_grant FROM invites WHERE used_by_id IS NULL ORDER BY created_at ASC')
    const unusedInvites = unusedInvitesQuery.all() as Array<{id: string, role_to_grant: string}>
    
    if (unusedInvites.length > 0) {
      console.log('📋 Unused invite codes:')
      unusedInvites.forEach(invite => {
        console.log(`   ${invite.id} (${invite.role_to_grant})`)
      })
    } else {
      console.log('⚠️  No unused invite codes available.')
    }
  }

  const usersQuery = db.prepare('SELECT COUNT(*) as count FROM users')
  const { count: userCount } = usersQuery.get() as { count: number }
  
  console.log(`👥 Users registered: ${userCount}`)

  closeDatabase()
  console.log('🏁 Setup complete!')
}

if (import.meta.main) {
  setup().catch(console.error)
}

export { setup } 