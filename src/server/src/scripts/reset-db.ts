import { unlinkSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { DB_PATH } from '../database/config'
import { nanoid } from 'nanoid'
import { initializeDatabase } from '../database/schema'
import { ADMIN_INVITE_ID_LENGTH } from '../config/constants'

async function resetDatabase() {
  console.log('🔄 Resetting NexusDrop database...')
  
  // Delete existing database if it exists
  if (existsSync(DB_PATH)) {
    try {
      unlinkSync(DB_PATH)
      console.log('🗑️  Deleted old database file')
    } catch (error) {
      console.error('❌ Error deleting database file:', error)
      console.log('   Make sure the server is not running and try again.')
      process.exit(1)
    }
  } else {
    console.log('📝 No existing database found')
  }

  // Ensure database directory exists
  const dbDir = path.dirname(DB_PATH)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
    console.log('📁 Created database directory')
  }

  // Initialize new database with updated schema
  console.log('🔧 Creating new database with username schema...')
  const db = initializeDatabase()

  // Create admin invite code
  const adminInviteCode = `NEXUS-ADMIN-${nanoid(ADMIN_INVITE_ID_LENGTH).toUpperCase()}`
  
  const insertInviteQuery = db.prepare(`
    INSERT INTO invites (id, role_to_grant, created_by_id, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `)

  insertInviteQuery.run(adminInviteCode, 'admin', 'system')
  
  console.log('✅ Database reset successfully!')
  console.log('🔑 New admin invite code:', adminInviteCode)
  console.log('')
  console.log('📋 Next steps:')
  console.log('   1. Start your server (bun run dev)')
  console.log('   2. Go to the register page')
  console.log('   3. Use the admin invite code above to create your admin account')
  console.log('   4. Choose a username (not an email) for your admin account')
  console.log('')

  db.close()
  console.log('🏁 Reset complete!')
}

resetDatabase().catch(console.error) 