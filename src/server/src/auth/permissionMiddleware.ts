import { lucia } from './lucia'
import type { Context, Next } from 'hono'
import type { Database } from 'bun:sqlite'
import type { User } from '../../../shared'

export interface PermissionContext extends Context {
  get: (key: 'user') => User
  set: (key: 'user', value: User) => void
}

export async function requireAuth(c: Context, next: Next) {
  try {
    const sessionId = lucia.readSessionCookie(c.req.header('Cookie') || '')
    
    if (!sessionId) {
      return c.json({ error: 'NO_SESSION', message: 'Authentication required' }, 401)
    }

    const { session, user } = await lucia.validateSession(sessionId)
    
    if (!session || !user) {
      return c.json({ error: 'INVALID_SESSION', message: 'Invalid session' }, 401)
    }

    const db = c.get('db') as Database
    const userQuery = db.prepare('SELECT id, username, role, avatar_url, default_expiry_days, storage_quota_bytes, storage_used_bytes, created_at FROM users WHERE id = ?')
    const userData = userQuery.get(user.id) as Omit<User, 'hashed_password'>
    
    if (!userData) {
      return c.json({ error: 'USER_NOT_FOUND', message: 'User not found' }, 404)
    }

    c.set('user', userData)
    await next()
  } catch (error) {
    console.error('Authentication middleware error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Authentication failed' }, 500)
  }
}

export async function requireRole(role: 'admin' | 'user') {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User
    
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    if (role === 'admin' && user.role !== 'admin') {
      return c.json({ error: 'FORBIDDEN', message: 'Admin access required' }, 403)
    }

    await next()
  }
}

export async function requireFileOwnership(c: Context, next: Next) {
  try {
    const user = c.get('user') as User
    const fileId = c.req.param('id') || c.req.param('filename')?.split('.')[0]
    
    if (!fileId) {
      return c.json({ error: 'MISSING_FILE_ID', message: 'File ID is required' }, 400)
    }

    const db = c.get('db') as Database
    const fileQuery = db.prepare('SELECT user_id FROM files WHERE id = ?')
    const file = fileQuery.get(fileId) as { user_id: string } | null

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found' }, 404)
    }

    if (file.user_id !== user.id && user.role !== 'admin') {
      return c.json({ error: 'FORBIDDEN', message: 'You do not have permission to access this file' }, 403)
    }

    await next()
  } catch (error) {
    console.error('File ownership middleware error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Permission check failed' }, 500)
  }
}

export async function requireCollectionOwnership(c: Context, next: Next) {
  try {
    const user = c.get('user') as User
    const collectionId = c.req.param('id')
    
    if (!collectionId) {
      return c.json({ error: 'MISSING_COLLECTION_ID', message: 'Collection ID is required' }, 400)
    }

    const db = c.get('db') as Database
    const collectionQuery = db.prepare('SELECT user_id FROM collections WHERE id = ?')
    const collection = collectionQuery.get(collectionId) as { user_id: string } | null

    if (!collection) {
      return c.json({ error: 'COLLECTION_NOT_FOUND', message: 'Collection not found' }, 404)
    }

    if (collection.user_id !== user.id && user.role !== 'admin') {
      return c.json({ error: 'FORBIDDEN', message: 'You do not have permission to access this collection' }, 403)
    }

    await next()
  } catch (error) {
    console.error('Collection ownership middleware error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Permission check failed' }, 500)
  }
}

export async function requireApiKeyOwnership(c: Context, next: Next) {
  try {
    const user = c.get('user') as User
    const keyId = c.req.param('id')
    
    if (!keyId) {
      return c.json({ error: 'MISSING_KEY_ID', message: 'API key ID is required' }, 400)
    }

    const db = c.get('db') as Database
    const keyQuery = db.prepare('SELECT user_id FROM api_keys WHERE id = ?')
    const apiKey = keyQuery.get(keyId) as { user_id: string } | null

    if (!apiKey) {
      return c.json({ error: 'API_KEY_NOT_FOUND', message: 'API key not found' }, 404)
    }

    if (apiKey.user_id !== user.id && user.role !== 'admin') {
      return c.json({ error: 'FORBIDDEN', message: 'You do not have permission to access this API key' }, 403)
    }

    await next()
  } catch (error) {
    console.error('API key ownership middleware error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Permission check failed' }, 500)
  }
}

export async function checkStorageQuota(c: Context, next: Next) {
  try {
    const user = c.get('user') as User
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return c.json({ error: 'NO_FILE', message: 'No file provided' }, 400)
    }

    if (user.storage_used_bytes + file.size > user.storage_quota_bytes) {
      return c.json({ 
        error: 'QUOTA_EXCEEDED', 
        message: 'Upload would exceed storage quota',
        details: {
          used: user.storage_used_bytes,
          quota: user.storage_quota_bytes,
          fileSize: file.size,
          available: user.storage_quota_bytes - user.storage_used_bytes
        }
      }, 413)
    }

    await next()
  } catch (error) {
    console.error('Storage quota middleware error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Quota check failed' }, 500)
  }
}

export async function rateLimitUpload(c: Context, next: Next) {
  try {
    const user = c.get('user') as User
    const db = c.get('db') as Database
    
    // Check uploads in the last hour
    const recentUploadsQuery = db.prepare(`
      SELECT COUNT(*) as count 
      FROM files 
      WHERE user_id = ? AND created_at > datetime('now', '-1 hour')
    `)
    const result = recentUploadsQuery.get(user.id) as { count: number }
    
    const hourlyLimit = user.role === 'admin' ? 1000 : 100 // Higher limit for admins
    
    if (result.count >= hourlyLimit) {
      return c.json({ 
        error: 'RATE_LIMITED', 
        message: `Upload rate limit exceeded. You can upload ${hourlyLimit} files per hour.`,
        details: {
          limit: hourlyLimit,
          used: result.count,
          resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }
      }, 429)
    }

    await next()
  } catch (error) {
    console.error('Rate limit middleware error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Rate limit check failed' }, 500)
  }
}

export function auditLog(action: string, targetType?: string) {
  return async (c: Context, next: Next) => {
    const startTime = Date.now()
    let error: any = null
    
    try {
      await next()
    } catch (e) {
      error = e
      throw e
    } finally {
      try {
        const user = c.get('user') as User | undefined
        const targetId = c.req.param('id') || c.req.param('filename')?.split('.')[0]
        const db = c.get('db') as Database
        
        const duration = Date.now() - startTime
        const success = !error && c.res.status < 400
        
        const auditLogQuery = db.prepare(`
          INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        
        const { nanoid } = await import('nanoid')
        auditLogQuery.run(
          nanoid(),
          user?.id || null,
          action,
          targetType || null,
          targetId || null,
          JSON.stringify({
            success,
            duration,
            method: c.req.method,
            path: c.req.path,
            userAgent: c.req.header('user-agent'),
            ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
            error: error?.message
          })
        )
      } catch (auditError) {
        console.error('Audit log error:', auditError)
      }
    }
  }
} 