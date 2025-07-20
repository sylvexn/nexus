import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { verify } from 'argon2'
import { fileTypeFromBuffer } from 'file-type'
import path from 'path'
import fs from 'fs/promises'
import type { Database } from 'bun:sqlite'
import type { User, ApiKey, File, ShareXResponse, ErrorResponse } from '../../../shared'
import { MAX_FILE_SIZE, ALLOWED_DOMAINS, API_KEY_PREFIX_LENGTH, FILE_ID_LENGTH, getFileUrl } from '../config/constants'
import { getFileExtension, getFileSubdirectory } from '../utils/files'

export const uploadRoutes = new Hono()

async function validateApiKey(db: Database, authHeader: string | undefined): Promise<{ user: User; apiKey: ApiKey } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  if (!token) {
    return null
  }

  try {
    // Get all API keys and verify against the provided token
    // Note: For production with many users, consider implementing a more efficient
    // hash-based lookup or caching strategy
    const apiKeysQuery = db.prepare('SELECT * FROM api_keys')
    const apiKeys = apiKeysQuery.all() as ApiKey[]
    
    let matchingApiKey: ApiKey | null = null
    
    for (const apiKey of apiKeys) {
      const isValid = await verify(apiKey.hashed_key, token)
      if (isValid) {
        matchingApiKey = apiKey
        break
      }
    }

    if (!matchingApiKey) {
      return null
    }

    const userQuery = db.prepare('SELECT * FROM users WHERE id = ?')
    const user = userQuery.get(matchingApiKey.user_id) as User | null

    if (!user) {
      return null
    }

    return { user, apiKey: matchingApiKey }
  } catch {
    return null
  }
}





uploadRoutes.post('/upload', async (c) => {
  try {
    const db = c.get('db') as Database
    const authHeader = c.req.header('Authorization')

    const auth = await validateApiKey(db, authHeader)
    if (!auth) {
      return c.json({ error: 'INVALID_API_KEY', message: 'Invalid or missing API key' }, 401)
    }

    const { user, apiKey } = auth

    const formData = await c.req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return c.json({ error: 'NO_FILE', message: 'No file provided' }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'FILE_TOO_LARGE', message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }, 413)
    }

    if (user.storage_used_bytes + file.size > user.storage_quota_bytes) {
      return c.json({ error: 'QUOTA_EXCEEDED', message: 'Upload would exceed storage quota' }, 413)
    }

    const buffer = await file.arrayBuffer()
    const fileType = await fileTypeFromBuffer(buffer)

    if (!fileType) {
      return c.json({ error: 'INVALID_FILE_TYPE', message: 'Unable to determine file type' }, 400)
    }

    const fileId = nanoid(FILE_ID_LENGTH)
    const subdirectory = getFileSubdirectory(fileType.mime)
    const extension = getFileExtension(file.name, fileType.mime)
    const filename = `${fileId}${extension}`

    const uploadsDir = path.join(process.cwd(), 'data', 'uploads', subdirectory)
    await fs.mkdir(uploadsDir, { recursive: true })

    const filePath = path.join(uploadsDir, filename)
    await fs.writeFile(filePath, new Uint8Array(buffer))

    const customExpiryDays = formData.get('custom_expiry_days')
    const expiryDays = customExpiryDays ? parseInt(customExpiryDays as string) : user.default_expiry_days
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()

    const downloadLimit = formData.get('download_limit')
    const parsedDownloadLimit = downloadLimit ? parseInt(downloadLimit as string) : null

    const tags = formData.getAll('tags[]') as string[]
    const collectionId = formData.get('collection_id') as string | null

    const insertFileQuery = db.prepare(`
      INSERT INTO files (id, user_id, original_filename, mime_type, size_bytes, expires_at, download_limit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    const updateUserStorageQuery = db.prepare(`
      UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?
    `)

    const updateApiKeyStatsQuery = db.prepare(`
      UPDATE api_keys 
      SET total_uploads = total_uploads + 1, 
          total_bytes_uploaded = total_bytes_uploaded + ?, 
          last_used_at = datetime('now')
      WHERE id = ?
    `)

    const insertTagQuery = db.prepare(`
      INSERT INTO file_tags (id, file_id, tag, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `)

    const insertCollectionQuery = db.prepare(`
      INSERT INTO file_collections (file_id, collection_id)
      VALUES (?, ?)
    `)

    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      insertFileQuery.run(fileId, user.id, file.name, fileType.mime, file.size, expiresAt, parsedDownloadLimit)
      updateUserStorageQuery.run(file.size, user.id)
      updateApiKeyStatsQuery.run(file.size, apiKey.id)

      if (tags.length > 0) {
        for (const tag of tags) {
          insertTagQuery.run(nanoid(), fileId, tag.trim())
        }
      }

      if (collectionId) {
        insertCollectionQuery.run(fileId, collectionId)
      }

      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'FILE_UPLOAD', 
        'file', 
        fileId, 
        JSON.stringify({ 
          filename: file.name, 
          size: file.size, 
          mime_type: fileType.mime,
          api_key_label: apiKey.label
        })
      )
    })()

    const fileUrl = getFileUrl(fileId, extension)

    return c.json({ url: fileUrl } as ShareXResponse)
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Upload failed' }, 500)
  }
}) 