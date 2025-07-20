import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { hash } from 'argon2'
import type { Database } from 'bun:sqlite'
import type { User, Invite, AuditLog } from '../../../shared'
import { requireAdmin } from '../auth/adminMiddleware'

const adminRoutes = new Hono()

adminRoutes.use('*', requireAdmin)

adminRoutes.get('/dashboard', async (c) => {
  try {
    console.log('Admin dashboard request received')
    const db = c.get('db') as Database

    // Use sequential queries instead of Promise.all for better compatibility
    console.log('Executing user count query...')
    const totalUsersQuery = db.prepare('SELECT COUNT(*) as count FROM users')
    const totalUsers = (totalUsersQuery.get() as { count: number }).count

    console.log('Executing file count query...')
    const totalFilesQuery = db.prepare('SELECT COUNT(*) as count FROM files')
    const totalFiles = (totalFilesQuery.get() as { count: number }).count

    console.log('Executing storage calculation query...')
    const totalStorageQuery = db.prepare('SELECT COALESCE(SUM(storage_used_bytes), 0) as total FROM users')
    const totalStorage = (totalStorageQuery.get() as { total: number }).total

    console.log('Executing active invites query...')
    const activeInvitesQuery = db.prepare('SELECT COUNT(*) as count FROM invites WHERE used_by_id IS NULL')
    const activeInvites = (activeInvitesQuery.get() as { count: number }).count

    console.log('Dashboard metrics calculated:', { totalUsers, totalFiles, totalStorage, activeInvites })

    // Optimize the upload stats query to limit results and add proper indexing
    console.log('Executing upload stats query...')
    const recentUploadsQuery = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM files 
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `)
    const uploadStats = recentUploadsQuery.all()

    console.log('Upload stats calculated:', uploadStats.length, 'entries')

    // Optimize the file types query
    console.log('Executing file types query...')
    const fileTypesQuery = db.prepare(`
      SELECT 
        CASE 
          WHEN mime_type LIKE 'image/%' THEN 'image'
          WHEN mime_type LIKE 'video/%' THEN 'video'
          WHEN mime_type LIKE 'audio/%' THEN 'audio'
          WHEN mime_type LIKE 'text/%' OR mime_type LIKE 'application/json' THEN 'text'
          ELSE 'other'
        END as type,
        COUNT(*) as count
      FROM files
      GROUP BY type
      ORDER BY count DESC
    `)
    const fileTypes = fileTypesQuery.all()

    console.log('File types calculated:', fileTypes.length, 'types')

    const response = {
      metrics: {
        totalUsers,
        totalFiles,
        totalStorage,
        activeInvites
      },
      charts: {
        uploadStats,
        fileTypes
      }
    }

    console.log('Dashboard response prepared successfully')
    return c.json(response)
  } catch (error) {
    console.error('Admin dashboard error:', error)
    return c.json({ 
      error: 'INTERNAL_ERROR', 
      message: 'Failed to get dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

adminRoutes.get('/invites', async (c) => {
  try {
    const db = c.get('db') as Database
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const invitesQuery = db.prepare(`
      SELECT 
        i.*,
        u.username as used_by_username,
        creator.username as created_by_username
      FROM invites i
      LEFT JOIN users u ON i.used_by_id = u.id
      LEFT JOIN users creator ON i.created_by_id = creator.id
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `)
    
    const countQuery = db.prepare('SELECT COUNT(*) as count FROM invites')
    const total = (countQuery.get() as { count: number }).count

    const invites = invitesQuery.all(limit, offset)

    return c.json({
      invites,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get invites error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get invites' }, 500)
  }
})

adminRoutes.post('/invites', async (c) => {
  try {
    const user = c.get('user') as Omit<User, 'hashed_password'>
    const { role_to_grant } = await c.req.json()
    
    if (!role_to_grant || !['user', 'admin'].includes(role_to_grant)) {
      return c.json({ error: 'INVALID_ROLE', message: 'Role must be user or admin' }, 400)
    }

    const db = c.get('db') as Database
    const inviteCode = `NEXUS-${nanoid(8).toUpperCase()}`

    const insertInviteQuery = db.prepare(`
      INSERT INTO invites (id, role_to_grant, created_by_id, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `)

    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      insertInviteQuery.run(inviteCode, role_to_grant, user.id)
      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'INVITE_CREATE', 
        'invite', 
        inviteCode, 
        JSON.stringify({ role_to_grant })
      )
    })()

    return c.json({
      id: inviteCode,
      role_to_grant,
      created_by_id: user.id,
      used_by_id: null,
      used_at: null,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Create invite error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to create invite' }, 500)
  }
})

adminRoutes.delete('/invites/:id', async (c) => {
  try {
    const user = c.get('user') as Omit<User, 'hashed_password'>
    const inviteId = c.req.param('id')
    const db = c.get('db') as Database

    const inviteQuery = db.prepare('SELECT * FROM invites WHERE id = ? AND used_by_id IS NULL')
    const invite = inviteQuery.get(inviteId) as Invite | null

    if (!invite) {
      return c.json({ error: 'INVITE_NOT_FOUND', message: 'Invite not found or already used' }, 404)
    }

    const deleteInviteQuery = db.prepare('DELETE FROM invites WHERE id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      deleteInviteQuery.run(inviteId)
      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'INVITE_REVOKE', 
        'invite', 
        inviteId, 
        JSON.stringify({ role_to_grant: invite.role_to_grant })
      )
    })()

    return c.json({ message: 'Invite revoked successfully' })
  } catch (error) {
    console.error('Delete invite error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to revoke invite' }, 500)
  }
})

adminRoutes.get('/users', async (c) => {
  try {
    const db = c.get('db') as Database
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const search = c.req.query('search') || ''
    const offset = (page - 1) * limit

    let usersQuery
    let countQuery
    let queryParams = [limit, offset]
    let countParams: any[] = []

    if (search) {
      usersQuery = db.prepare(`
        SELECT 
          id, username, role, avatar_url, default_expiry_days, 
          storage_quota_bytes, storage_used_bytes, created_at,
          (SELECT COUNT(*) FROM files WHERE user_id = users.id) as file_count,
          (SELECT COUNT(*) FROM api_keys WHERE user_id = users.id) as api_key_count
        FROM users 
        WHERE username LIKE ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      countQuery = db.prepare('SELECT COUNT(*) as count FROM users WHERE username LIKE ?')
      queryParams = [`%${search}%`, limit, offset]
      countParams = [`%${search}%`]
    } else {
      usersQuery = db.prepare(`
        SELECT 
          id, username, role, avatar_url, default_expiry_days, 
          storage_quota_bytes, storage_used_bytes, created_at,
          (SELECT COUNT(*) FROM files WHERE user_id = users.id) as file_count,
          (SELECT COUNT(*) FROM api_keys WHERE user_id = users.id) as api_key_count
        FROM users 
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      countQuery = db.prepare('SELECT COUNT(*) as count FROM users')
    }

    const users = usersQuery.all(...queryParams)
    const total = (countQuery.get(...countParams) as { count: number }).count

    return c.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get users error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get users' }, 500)
  }
})

adminRoutes.put('/users/:id', async (c) => {
  try {
    const adminUser = c.get('user') as Omit<User, 'hashed_password'>
    const userId = c.req.param('id')
    const { default_expiry_days, storage_quota_bytes, role } = await c.req.json()

    const db = c.get('db') as Database

    const userQuery = db.prepare('SELECT * FROM users WHERE id = ?')
    const user = userQuery.get(userId) as User | null

    if (!user) {
      return c.json({ error: 'USER_NOT_FOUND', message: 'User not found' }, 404)
    }

    const updates: string[] = []
    const values: any[] = []

    if (default_expiry_days !== undefined) {
      updates.push('default_expiry_days = ?')
      values.push(default_expiry_days)
    }

    if (storage_quota_bytes !== undefined) {
      updates.push('storage_quota_bytes = ?')
      values.push(storage_quota_bytes)
    }

    if (role !== undefined && ['user', 'admin'].includes(role)) {
      updates.push('role = ?')
      values.push(role)
    }

    if (updates.length === 0) {
      return c.json({ error: 'NO_UPDATES', message: 'No valid updates provided' }, 400)
    }

    values.push(userId)

    const updateUserQuery = db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `)

    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      updateUserQuery.run(...values)
      auditLogQuery.run(
        nanoid(), 
        adminUser.id, 
        'USER_UPDATE', 
        'user', 
        userId, 
        JSON.stringify({ default_expiry_days, storage_quota_bytes, role })
      )
    })()

    const updatedUserQuery = db.prepare('SELECT id, username, role, avatar_url, default_expiry_days, storage_quota_bytes, storage_used_bytes, created_at FROM users WHERE id = ?')
    const updatedUser = updatedUserQuery.get(userId)

    return c.json({ user: updatedUser })
  } catch (error) {
    console.error('Update user error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to update user' }, 500)
  }
})

adminRoutes.get('/files', async (c) => {
  try {
    const db = c.get('db') as Database
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const search = c.req.query('search') || ''
    const user_id = c.req.query('user_id') || ''
    const offset = (page - 1) * limit

    let filesQuery
    let countQuery
    let queryParams = [limit, offset]
    let countParams: any[] = []
    let whereConditions: string[] = []

    if (search) {
      whereConditions.push('(f.original_filename LIKE ? OR f.id LIKE ?)')
      queryParams.unshift(`%${search}%`, `%${search}%`)
      countParams.push(`%${search}%`, `%${search}%`)
    }

    if (user_id) {
      whereConditions.push('f.user_id = ?')
      if (search) {
        queryParams.splice(-2, 0, user_id)
        countParams.push(user_id)
      } else {
        queryParams.unshift(user_id)
        countParams.push(user_id)
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    filesQuery = db.prepare(`
      SELECT 
        f.*,
        u.username as owner_username
      FROM files f
      JOIN users u ON f.user_id = u.id
      ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `)

    countQuery = db.prepare(`
      SELECT COUNT(*) as count 
      FROM files f
      JOIN users u ON f.user_id = u.id
      ${whereClause}
    `)

    const files = filesQuery.all(...queryParams)
    const total = (countQuery.get(...countParams) as { count: number }).count

    return c.json({
      files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get admin files error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get files' }, 500)
  }
})

adminRoutes.put('/files/:id', async (c) => {
  try {
    const adminUser = c.get('user') as Omit<User, 'hashed_password'>
    const fileId = c.req.param('id')
    const { expires_at } = await c.req.json()

    if (!expires_at) {
      return c.json({ error: 'MISSING_EXPIRY', message: 'Expiry date is required' }, 400)
    }

    const db = c.get('db') as Database

    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ?')
    const file = fileQuery.get(fileId)

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found' }, 404)
    }

    const updateFileQuery = db.prepare('UPDATE files SET expires_at = ? WHERE id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      updateFileQuery.run(expires_at, fileId)
      auditLogQuery.run(
        nanoid(), 
        adminUser.id, 
        'FILE_UPDATE', 
        'file', 
        fileId, 
        JSON.stringify({ expires_at, original_filename: (file as any).original_filename })
      )
    })()

    const updatedFileQuery = db.prepare('SELECT * FROM files WHERE id = ?')
    const updatedFile = updatedFileQuery.get(fileId)

    return c.json({ file: updatedFile })
  } catch (error) {
    console.error('Update file error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to update file' }, 500)
  }
})

adminRoutes.get('/logs', async (c) => {
  try {
    const db = c.get('db') as Database
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '50')
    const action = c.req.query('action') || ''
    const user_id = c.req.query('user_id') || ''
    const offset = (page - 1) * limit

    let logsQuery
    let countQuery
    let queryParams = [limit, offset]
    let countParams: any[] = []
    let whereConditions: string[] = []

    if (action) {
      whereConditions.push('al.action = ?')
      queryParams.unshift(action)
      countParams.push(action)
    }

    if (user_id) {
      whereConditions.push('al.user_id = ?')
      if (action) {
        queryParams.splice(-2, 0, user_id)
        countParams.push(user_id)
      } else {
        queryParams.unshift(user_id)
        countParams.push(user_id)
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    logsQuery = db.prepare(`
      SELECT 
        al.*,
        u.username as user_username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `)

    countQuery = db.prepare(`
      SELECT COUNT(*) as count 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
    `)

    const logs = logsQuery.all(...queryParams)
    const total = (countQuery.get(...countParams) as { count: number }).count

    const actionsQuery = db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action')
    const actions = actionsQuery.all().map((row: any) => row.action)

    return c.json({
      logs,
      actions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get audit logs' }, 500)
  }
})

adminRoutes.get('/settings', async (c) => {
  try {
    const db = c.get('db') as Database
    
    const globalSettingsQuery = db.prepare(`
      SELECT 
        default_expiry_days,
        storage_quota_bytes
      FROM users
      ORDER BY created_at DESC
      LIMIT 1
    `)
    const latestUser = globalSettingsQuery.get() as { default_expiry_days: number; storage_quota_bytes: number } | undefined
    
    const defaultExpiryDays = latestUser?.default_expiry_days || 30
    const defaultStorageQuota = latestUser?.storage_quota_bytes || 21474836480

    return c.json({ 
      globalSettings: {
        defaultExpiryDays: defaultExpiryDays,
        defaultStorageQuota: defaultStorageQuota
      }
    })
  } catch (error) {
    console.error('Get admin settings error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get settings' }, 500)
  }
})

adminRoutes.put('/settings', async (c) => {
  try {
    const adminUser = c.get('user') as Omit<User, 'hashed_password'>
    const { defaultExpiryDays, defaultStorageQuota } = await c.req.json()

    const db = c.get('db') as Database
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    auditLogQuery.run(
      nanoid(), 
      adminUser.id, 
      'SETTINGS_UPDATE', 
      'global', 
      'settings', 
      JSON.stringify({ defaultExpiryDays, defaultStorageQuota })
    )

    return c.json({ 
      message: 'Settings updated successfully',
      globalSettings: {
        defaultExpiryDays,
        defaultStorageQuota
      }
    })
  } catch (error) {
    console.error('Update admin settings error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to update settings' }, 500)
  }
})

export { adminRoutes } 