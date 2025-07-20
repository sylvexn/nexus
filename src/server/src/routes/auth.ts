import { Hono } from 'hono'
import { lucia } from '../auth/lucia'
import { hash, verify } from 'argon2'
import { nanoid } from 'nanoid'
import type { Database } from 'bun:sqlite'
import type { User, Invite, AuthResponse, ErrorResponse } from '../../../shared'
import { API_KEY_PREFIX_LENGTH } from '../config/constants'

export const authRoutes = new Hono()

authRoutes.post('/register', async (c) => {
  try {
    const { username, password, invite_code } = await c.req.json()
    const db = c.get('db') as Database

    if (!username || !password || !invite_code) {
      return c.json({ error: 'MISSING_FIELDS', message: 'Username, password, and invite code are required' }, 400)
    }

    const inviteQuery = db.prepare('SELECT * FROM invites WHERE id = ? AND used_by_id IS NULL')
    const invite = inviteQuery.get(invite_code) as Invite | null

    if (!invite) {
      return c.json({ error: 'INVALID_INVITE', message: 'Invalid or already used invite code' }, 400)
    }

    const existingUserQuery = db.prepare('SELECT id FROM users WHERE username = ?')
    const existingUser = existingUserQuery.get(username)

    if (existingUser) {
      return c.json({ error: 'USER_EXISTS', message: 'User with this username already exists' }, 400)
    }

    const userId = nanoid()
    const hashedPassword = await hash(password)

    const createUserQuery = db.prepare(`
      INSERT INTO users (id, username, hashed_password, role, created_at) 
      VALUES (?, ?, ?, ?, datetime('now'))
    `)
    
    const markInviteUsedQuery = db.prepare(`
      UPDATE invites 
      SET used_by_id = ?, used_at = datetime('now') 
      WHERE id = ?
    `)

    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      createUserQuery.run(userId, username, hashedPassword, invite.role_to_grant)
      markInviteUsedQuery.run(userId, invite_code)
      auditLogQuery.run(nanoid(), userId, 'USER_REGISTER', 'user', userId, JSON.stringify({ username, invite_code }))
    })()

    const session = await lucia.createSession(userId, {})
    const sessionCookie = lucia.createSessionCookie(session.id)

    c.header('Set-Cookie', sessionCookie.serialize())

    const userQuery = db.prepare('SELECT id, username, role, avatar_url, default_expiry_days, storage_quota_bytes, storage_used_bytes, created_at FROM users WHERE id = ?')
    const user = userQuery.get(userId) as Omit<User, 'hashed_password'>

    return c.json({ user } as AuthResponse)
  } catch (error) {
    console.error('Registration error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Registration failed' }, 500)
  }
})

authRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    const db = c.get('db') as Database

    if (!username || !password) {
      return c.json({ error: 'MISSING_FIELDS', message: 'Username and password are required' }, 400)
    }

    const userQuery = db.prepare('SELECT * FROM users WHERE username = ?')
    const user = userQuery.get(username) as User | null

    if (!user) {
      return c.json({ error: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }, 401)
    }

    const validPassword = await verify(user.hashed_password, password)
    if (!validPassword) {
      return c.json({ error: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }, 401)
    }

    const session = await lucia.createSession(user.id, {})
    const sessionCookie = lucia.createSessionCookie(session.id)

    c.header('Set-Cookie', sessionCookie.serialize())

    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    auditLogQuery.run(nanoid(), user.id, 'USER_LOGIN', 'user', user.id, JSON.stringify({ username }))

    const { hashed_password, ...userWithoutPassword } = user
    return c.json({ user: userWithoutPassword } as AuthResponse)
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Login failed' }, 500)
  }
})

authRoutes.post('/logout', async (c) => {
  try {
    const sessionId = lucia.readSessionCookie(c.req.header('Cookie') || '')
    if (!sessionId) {
      return c.json({ error: 'NO_SESSION', message: 'No active session' }, 401)
    }

    await lucia.invalidateSession(sessionId)
    const sessionCookie = lucia.createBlankSessionCookie()
    c.header('Set-Cookie', sessionCookie.serialize())

    return c.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Logout failed' }, 500)
  }
})

authRoutes.get('/me', async (c) => {
  try {
    const sessionId = lucia.readSessionCookie(c.req.header('Cookie') || '')
    if (!sessionId) {
      return c.json({ error: 'NO_SESSION', message: 'No active session' }, 401)
    }

    const { session, user } = await lucia.validateSession(sessionId)
    if (!session) {
      return c.json({ error: 'INVALID_SESSION', message: 'Invalid session' }, 401)
    }

    const db = c.get('db') as Database
    const userQuery = db.prepare('SELECT id, username, role, avatar_url, default_expiry_days, storage_quota_bytes, storage_used_bytes, created_at FROM users WHERE id = ?')
    const userData = userQuery.get(user.id) as Omit<User, 'hashed_password'>

    return c.json({ user: userData } as AuthResponse)
  } catch (error) {
    console.error('Me endpoint error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get user data' }, 500)
  }
})

authRoutes.post('/api-keys', async (c) => {
  try {
    const sessionId = lucia.readSessionCookie(c.req.header('Cookie') || '')
    if (!sessionId) {
      return c.json({ error: 'NO_SESSION', message: 'Authentication required' }, 401)
    }

    const { session, user } = await lucia.validateSession(sessionId)
    if (!session) {
      return c.json({ error: 'INVALID_SESSION', message: 'Invalid session' }, 401)
    }

    const { label } = await c.req.json()
    if (!label || label.trim().length === 0) {
      return c.json({ error: 'INVALID_LABEL', message: 'API key label is required' }, 400)
    }

    const db = c.get('db') as Database
    const apiKeyId = nanoid()
    const apiKey = nanoid(32)
    const hashedKey = await hash(apiKey)
    const keyPrefix = apiKey.substring(0, API_KEY_PREFIX_LENGTH)

    const insertKeyQuery = db.prepare(`
      INSERT INTO api_keys (id, user_id, label, hashed_key, key_prefix, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `)

    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      insertKeyQuery.run(apiKeyId, user.id, label.trim(), hashedKey, keyPrefix)
      auditLogQuery.run(nanoid(), user.id, 'API_KEY_CREATE', 'api_key', apiKeyId, JSON.stringify({ label: label.trim() }))
    })()

    return c.json({ 
      id: apiKeyId,
      label: label.trim(),
      key_prefix: keyPrefix,
      key: apiKey
    })
  } catch (error) {
    console.error('API key creation error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to create API key' }, 500)
  }
})

authRoutes.get('/api-keys', async (c) => {
  try {
    const sessionId = lucia.readSessionCookie(c.req.header('Cookie') || '')
    if (!sessionId) {
      return c.json({ error: 'NO_SESSION', message: 'Authentication required' }, 401)
    }

    const { session, user } = await lucia.validateSession(sessionId)
    if (!session) {
      return c.json({ error: 'INVALID_SESSION', message: 'Invalid session' }, 401)
    }

    const db = c.get('db') as Database
    const keysQuery = db.prepare(`
      SELECT id, label, key_prefix, total_uploads, total_bytes_uploaded, created_at, last_used_at
      FROM api_keys 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `)
    const keys = keysQuery.all(user.id)

    return c.json({ api_keys: keys })
  } catch (error) {
    console.error('API keys fetch error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch API keys' }, 500)
  }
})

authRoutes.delete('/api-keys/:id', async (c) => {
  try {
    const sessionId = lucia.readSessionCookie(c.req.header('Cookie') || '')
    if (!sessionId) {
      return c.json({ error: 'NO_SESSION', message: 'Authentication required' }, 401)
    }

    const { session, user } = await lucia.validateSession(sessionId)
    if (!session) {
      return c.json({ error: 'INVALID_SESSION', message: 'Invalid session' }, 401)
    }

    const keyId = c.req.param('id')
    const db = c.get('db') as Database

    const keyQuery = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?')
    const apiKey = keyQuery.get(keyId, user.id)

    if (!apiKey) {
      return c.json({ error: 'KEY_NOT_FOUND', message: 'API key not found' }, 404)
    }

    const deleteKeyQuery = db.prepare('DELETE FROM api_keys WHERE id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      deleteKeyQuery.run(keyId)
      auditLogQuery.run(nanoid(), user.id, 'API_KEY_DELETE', 'api_key', keyId, JSON.stringify({ label: (apiKey as any).label }))
    })()

    return c.json({ message: 'API key deleted successfully' })
  } catch (error) {
    console.error('API key deletion error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to delete API key' }, 500)
  }
}) 