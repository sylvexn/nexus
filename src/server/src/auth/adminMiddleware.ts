import { lucia } from './lucia'
import type { Context, Next } from 'hono'
import type { Database } from 'bun:sqlite'
import type { User } from '../../../shared'

export async function requireAdmin(c: Context, next: Next) {
  try {
    console.log('Admin middleware called for:', c.req.path)
    console.log('Cookies:', c.req.header('Cookie'))
    
    const sessionId = lucia.readSessionCookie(c.req.header('Cookie') || '')
    console.log('Session ID extracted:', sessionId ? 'present' : 'missing')
    
    if (!sessionId) {
      console.log('No session ID found, returning 401')
      return c.json({ error: 'NO_SESSION', message: 'Authentication required' }, 401)
    }

    const { session, user } = await lucia.validateSession(sessionId)
    console.log('Session validation result:', { session: !!session, user: user?.id })
    
    if (!session) {
      console.log('Invalid session, returning 401')
      return c.json({ error: 'INVALID_SESSION', message: 'Invalid session' }, 401)
    }

    const db = c.get('db') as Database
    const userQuery = db.prepare('SELECT id, username, role, avatar_url, default_expiry_days, storage_quota_bytes, storage_used_bytes, created_at FROM users WHERE id = ?')
    const userData = userQuery.get(user.id) as Omit<User, 'hashed_password'>
    
    console.log('User data from DB:', { id: userData?.id, username: userData?.username, role: userData?.role })

    if (!userData || userData.role !== 'admin') {
      console.log('User not found or not admin, returning 403')
      return c.json({ error: 'FORBIDDEN', message: 'Admin access required' }, 403)
    }

    console.log('Admin access granted for user:', userData.username)
    c.set('user', userData)
    await next()
  } catch (error) {
    console.error('Admin middleware error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Authentication failed' }, 500)
  }
} 