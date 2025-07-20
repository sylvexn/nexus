import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import path from 'path'
import fs from 'fs/promises'
import { lucia } from '../auth/lucia'
import { fileTypeFromBuffer } from 'file-type'
import type { Database } from 'bun:sqlite'
import type { File as FileRecord, User } from '../../../shared'
import type { HonoContext } from '../types'
import { getFileUrl, FILE_ID_LENGTH } from '../config/constants'
import { getFileExtension, getFileSubdirectory } from '../utils/files'
import { thumbnailGenerator, supportsThumbnails } from '../utils/thumbnails'

export const fileRoutes = new Hono<HonoContext>()

async function getUserFromSession(c: any): Promise<User | null> {
  const sessionId = lucia.readSessionCookie(c.req.header('Cookie') || '')
  if (!sessionId) {
    return null
  }

  const { session, user } = await lucia.validateSession(sessionId)
  if (!session || !user) {
    return null
  }

  const db = c.get('db') as Database
  const userQuery = db.prepare('SELECT * FROM users WHERE id = ?')
  return userQuery.get(user.id) as User | null
}



function createViewerHtml(file: FileRecord, fileUrl: string): string {
  const isImage = file.mime_type.startsWith('image/')
  const isVideo = file.mime_type.startsWith('video/')

  let content = ''
  if (isImage) {
    content = `<img src="${fileUrl}" alt="${file.original_filename}" style="max-width: 100%; height: auto;" />`
  } else if (isVideo) {
    content = `<video controls style="max-width: 100%; height: auto;">
      <source src="${fileUrl}" type="${file.mime_type}">
      Your browser does not support the video tag.
    </video>`
  } else {
    content = `<div class="file-info">
      <h3>${file.original_filename}</h3>
      <p>File type: ${file.mime_type}</p>
      <p>Size: ${(file.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
      <p>Click download to get this file.</p>
    </div>`
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${file.original_filename} - NexusDrop</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:title" content="${file.original_filename}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${getFileUrl(file.id, getFileExtension(file.original_filename))}">
  ${isImage ? `<meta property="og:image" content="${fileUrl}">` : ''}
  <meta property="og:site_name" content="NexusDrop">
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      width: 100%;
      text-align: center;
    }
    .header {
      margin-bottom: 30px;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 1.5rem;
    }
    .file-container {
      margin: 20px 0;
    }
    .download-btn {
      background: #007bff;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      text-decoration: none;
      display: inline-block;
      margin-top: 20px;
      font-size: 16px;
      transition: background 0.2s;
    }
    .download-btn:hover {
      background: #0056b3;
    }
    .file-info {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .stats {
      margin-top: 20px;
      color: #999;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NexusDrop</h1>
    </div>
    <div class="file-container">
      ${content}
    </div>
    <a href="/api/files/${file.id}/download" class="download-btn">Download ${file.original_filename}</a>
    <div class="stats">
      Views: ${file.view_count} | Downloads: ${file.download_count}
    </div>
  </div>
</body>
</html>`
}

fileRoutes.get('/me', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const db = c.get('db') as Database
    const collectionId = c.req.query('collection_id')
    
    let filesQuery: any
    let files: FileRecord[]

    if (collectionId === 'null' || collectionId === null || collectionId === undefined) {
      // Show all files
      filesQuery = db.prepare(`
        SELECT * FROM files 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `)
      files = filesQuery.all(user.id) as FileRecord[]
    } else {
      // Show files from specific collection
      filesQuery = db.prepare(`
        SELECT f.* FROM files f
        INNER JOIN file_collections fc ON f.id = fc.file_id
        WHERE f.user_id = ? AND fc.collection_id = ?
        ORDER BY f.created_at DESC
      `)
      files = filesQuery.all(user.id, collectionId) as FileRecord[]
    }

    const filesWithTags = files.map(file => {
      const tagsQuery = db.prepare('SELECT tag FROM file_tags WHERE file_id = ?')
      const tags = tagsQuery.all(file.id).map(row => (row as any).tag)
      return { ...file, tags }
    })

    return c.json({ files: filesWithTags })
  } catch (error) {
    console.error('Get user files error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get files' }, 500)
  }
})

// Collection routes (must be before /:filename to avoid route conflicts)
fileRoutes.get('/collections', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const db = c.get('db') as Database
    const collectionsQuery = db.prepare(`
      SELECT c.*, COUNT(fc.file_id) as file_count
      FROM collections c
      LEFT JOIN file_collections fc ON c.id = fc.collection_id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `)
    const collections = collectionsQuery.all(user.id)

    return c.json({ collections })
  } catch (error) {
    console.error('Get collections error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get collections' }, 500)
  }
})

fileRoutes.post('/collections', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const { name } = await c.req.json()
    if (!name || name.trim().length === 0) {
      return c.json({ error: 'INVALID_NAME', message: 'Collection name is required' }, 400)
    }

    const db = c.get('db') as Database
    const collectionId = nanoid()

    const insertCollectionQuery = db.prepare(`
      INSERT INTO collections (id, user_id, name, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `)

    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      insertCollectionQuery.run(collectionId, user.id, name.trim())
      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'COLLECTION_CREATE', 
        'collection', 
        collectionId, 
        JSON.stringify({ name: name.trim() })
      )
    })()

    return c.json({ 
      id: collectionId, 
      name: name.trim(), 
      created_at: new Date().toISOString(),
      file_count: 0
    })
  } catch (error) {
    console.error('Create collection error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to create collection' }, 500)
  }
})

fileRoutes.delete('/collections/:id', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const collectionId = c.req.param('id')
    const db = c.get('db') as Database

    const collectionQuery = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?')
    const collection = collectionQuery.get(collectionId, user.id)

    if (!collection) {
      return c.json({ error: 'COLLECTION_NOT_FOUND', message: 'Collection not found or not owned by user' }, 404)
    }

    const deleteCollectionQuery = db.prepare('DELETE FROM collections WHERE id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      deleteCollectionQuery.run(collectionId)
      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'COLLECTION_DELETE', 
        'collection', 
        collectionId, 
        JSON.stringify({ name: (collection as any).name })
      )
    })()

    return c.json({ message: 'Collection deleted successfully' })
  } catch (error) {
    console.error('Delete collection error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to delete collection' }, 500)
  }
})

// Search files endpoint (must be before /:filename to avoid route conflicts)
fileRoutes.get('/search', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const db = c.get('db') as Database
    const search = c.req.query('search') || ''
    const types = c.req.query('types') || ''
    const dateRange = c.req.query('date_range') || ''
    const minSize = c.req.query('min_size') || ''
    const maxSize = c.req.query('max_size') || ''
    const tags = c.req.query('tags') || ''
    const sortBy = c.req.query('sort_by') || 'created_at'
    const sortOrder = c.req.query('sort_order') || 'desc'

    let whereConditions = ['f.user_id = ?']
    let queryParams = [user.id]

    // Search query
    if (search.trim()) {
      whereConditions.push('(f.original_filename LIKE ? OR f.id LIKE ?)')
      queryParams.push(`%${search}%`, `%${search}%`)
    }

    // File types filter
    if (types) {
      const typeList = types.split(',')
      const typeConditions = typeList.map(type => {
        switch (type) {
          case 'image':
            return "f.mime_type LIKE 'image/%'"
          case 'video':
            return "f.mime_type LIKE 'video/%'"
          case 'audio':
            return "f.mime_type LIKE 'audio/%'"
          case 'document':
            return "f.mime_type IN ('application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')"
          case 'archive':
            return "f.mime_type IN ('application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/gzip')"
          default:
            return "f.mime_type NOT LIKE 'image/%' AND f.mime_type NOT LIKE 'video/%' AND f.mime_type NOT LIKE 'audio/%'"
        }
      })
      whereConditions.push(`(${typeConditions.join(' OR ')})`)
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date()
      let startDate: Date
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        default:
          startDate = new Date(0)
      }
      
      whereConditions.push('f.created_at >= ?')
      queryParams.push(startDate.toISOString())
    }

    // Size range filter
    if (minSize) {
      whereConditions.push('f.size_bytes >= ?')
      queryParams.push((parseInt(minSize) * 1024 * 1024).toString()) // Convert MB to bytes
    }
    if (maxSize) {
      whereConditions.push('f.size_bytes <= ?')
      queryParams.push((parseInt(maxSize) * 1024 * 1024).toString()) // Convert MB to bytes
    }

    // Tags filter
    if (tags) {
      const tagList = tags.split(',')
      const tagConditions = tagList.map(() => 'ft.tag = ?')
      whereConditions.push(`f.id IN (SELECT DISTINCT ft.file_id FROM file_tags ft WHERE ${tagConditions.join(' OR ')})`)
      queryParams.push(...tagList)
    }

    // Validate sort parameters
    const validSortFields = ['created_at', 'name', 'size', 'view_count', 'download_count']
    const validSortOrders = ['asc', 'desc']
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at'
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc'

    const whereClause = whereConditions.join(' AND ')
    const orderClause = finalSortBy === 'name' ? 'f.original_filename' : 
                       finalSortBy === 'size' ? 'f.size_bytes' : 
                       `f.${finalSortBy}`

    const filesQuery = db.prepare(`
      SELECT DISTINCT f.* FROM files f
      LEFT JOIN file_tags ft ON f.id = ft.file_id
      WHERE ${whereClause}
      ORDER BY ${orderClause} ${finalSortOrder.toUpperCase()}
      LIMIT 100
    `)

    const files = filesQuery.all(...queryParams) as FileRecord[]

    // Add tags to each file
    const filesWithTags = files.map(file => {
      const tagsQuery = db.prepare('SELECT tag FROM file_tags WHERE file_id = ?')
      const fileTags = tagsQuery.all(file.id).map(row => (row as any).tag)
      return { ...file, tags: fileTags }
    })

    return c.json({ files: filesWithTags })
  } catch (error) {
    console.error('Search files error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Search failed' }, 500)
  }
})

// Get all tags endpoint (must be before /:filename to avoid route conflicts)
fileRoutes.get('/tags', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const db = c.get('db') as Database
    const tagsQuery = db.prepare(`
      SELECT DISTINCT ft.tag 
      FROM file_tags ft
      JOIN files f ON ft.file_id = f.id
      WHERE f.user_id = ?
      ORDER BY ft.tag
    `)
    
    const tags = tagsQuery.all(user.id).map(row => (row as any).tag)
    
    return c.json({ tags })
  } catch (error) {
    console.error('Get tags error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get tags' }, 500)
  }
})



fileRoutes.get('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename')
    const db = c.get('db') as Database
    
    // Check if this is a file with extension (contains a dot)
    const lastDot = filename.lastIndexOf('.')
    if (lastDot > 0) {
      // This is a file with extension - serve the raw file
      const fileId = filename.substring(0, lastDot)
      const extension = filename.substring(lastDot)

      const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND expires_at > datetime("now")')
      const file = fileQuery.get(fileId) as FileRecord | null

      if (!file) {
        return c.text('File not found or expired', 404)
      }

      const subdirectory = getFileSubdirectory(file.mime_type)
      const filePath = path.join(process.cwd(), 'data', 'uploads', subdirectory, `${file.id}${extension}`)

      try {
        const fileBuffer = await fs.readFile(filePath)
        
        c.header('Content-Type', file.mime_type)
        c.header('Content-Length', file.size_bytes.toString())
        c.header('Cache-Control', 'public, max-age=31536000')
        
        return c.body(fileBuffer)
      } catch {
        return c.text('File not found on disk', 404)
      }
    } else {
      // No extension - serve the viewer HTML
      const fileId = filename

      const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND expires_at > datetime("now")')
      const file = fileQuery.get(fileId) as FileRecord | null

      if (!file) {
        return c.text('File not found or expired', 404)
      }

      const extension = getFileExtension(file.original_filename)
      const subdirectory = getFileSubdirectory(file.mime_type)
      const filePath = path.join(process.cwd(), 'data', 'uploads', subdirectory, `${file.id}${extension}`)

      try {
        await fs.access(filePath)
      } catch {
        return c.text('File not found on disk', 404)
      }

      const incrementViewQuery = db.prepare('UPDATE files SET view_count = view_count + 1 WHERE id = ?')
      incrementViewQuery.run(file.id)

      const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
      const userAgent = c.req.header('user-agent') || ''
      const referrer = c.req.header('referer') || null

      const logAnalyticsQuery = db.prepare(`
        INSERT INTO file_analytics (id, file_id, ip_address, user_agent, referrer, action, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      logAnalyticsQuery.run(nanoid(), file.id, clientIP, userAgent, referrer, 'view')

      const fileUrl = getFileUrl(file.id, extension)
      const html = createViewerHtml(file, fileUrl)

      return c.html(html)
    }
  } catch (error) {
    console.error('File serve error:', error)
    return c.text('Internal server error', 500)
  }
})

fileRoutes.get('/:id/download', async (c) => {
  try {
    const fileId = c.req.param('id')
    const db = c.get('db') as Database

    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND expires_at > datetime("now")')
    const file = fileQuery.get(fileId) as FileRecord | null

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found or expired' }, 404)
    }

    if (file.download_limit && file.download_count >= file.download_limit) {
      return c.json({ error: 'DOWNLOAD_LIMIT_EXCEEDED', message: 'Download limit exceeded for this file' }, 403)
    }

    const incrementDownloadQuery = db.prepare('UPDATE files SET download_count = download_count + 1 WHERE id = ?')
    incrementDownloadQuery.run(file.id)

    const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    const referrer = c.req.header('referer') || null

    const logAnalyticsQuery = db.prepare(`
      INSERT INTO file_analytics (id, file_id, ip_address, user_agent, referrer, action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    logAnalyticsQuery.run(nanoid(), file.id, clientIP, userAgent, referrer, 'download')

    const extension = getFileExtension(file.original_filename)
    const directUrl = getFileUrl(file.id, extension)

    return c.redirect(directUrl)
  } catch (error) {
    console.error('Download error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Download failed' }, 500)
  }
})

fileRoutes.delete('/bulk', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const { fileIds } = await c.req.json()
    
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return c.json({ error: 'INVALID_REQUEST', message: 'File IDs array is required' }, 400)
    }

    const db = c.get('db') as Database

    const filesQuery = db.prepare('SELECT * FROM files WHERE id IN (' + fileIds.map(() => '?').join(',') + ') AND user_id = ?')
    const files = filesQuery.all(...fileIds, user.id) as FileRecord[]

    if (files.length === 0) {
      return c.json({ error: 'NO_FILES_FOUND', message: 'No files found to delete' }, 404)
    }

    const deleteFileQuery = db.prepare('DELETE FROM files WHERE id = ?')
    const updateUserStorageQuery = db.prepare('UPDATE users SET storage_used_bytes = storage_used_bytes - ? WHERE id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    let totalSizeDeleted = 0
    const deletedFiles: string[] = []

    db.transaction(() => {
      for (const file of files) {
        deleteFileQuery.run(file.id)
        totalSizeDeleted += file.size_bytes
        deletedFiles.push(file.original_filename)
        
        auditLogQuery.run(
          nanoid(), 
          user.id, 
          'FILE_DELETE', 
          'file', 
          file.id, 
          JSON.stringify({ 
            filename: file.original_filename, 
            size: file.size_bytes 
          })
        )
      }
      
      if (totalSizeDeleted > 0) {
        updateUserStorageQuery.run(totalSizeDeleted, user.id)
      }
    })()

    for (const file of files) {
      try {
        const extension = getFileExtension(file.original_filename)
        const subdirectory = getFileSubdirectory(file.mime_type)
        const filePath = path.join(process.cwd(), 'data', 'uploads', subdirectory, `${file.id}${extension}`)
        await fs.unlink(filePath)
      } catch (error) {
        console.warn('Could not delete file from disk:', file.id, error)
      }
    }

    return c.json({ 
      message: `${files.length} files deleted successfully`,
      deletedCount: files.length,
      deletedFiles
    })
  } catch (error) {
    console.error('Bulk delete files error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to delete files' }, 500)
  }
})

fileRoutes.delete('/:id', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const fileId = c.req.param('id')
    const db = c.get('db') as Database

    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    const file = fileQuery.get(fileId, user.id) as FileRecord | null

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found or not owned by user' }, 404)
    }

    const extension = getFileExtension(file.original_filename)
    const subdirectory = getFileSubdirectory(file.mime_type)
    const filePath = path.join(process.cwd(), 'data', 'uploads', subdirectory, `${file.id}${extension}`)

    const deleteFileQuery = db.prepare('DELETE FROM files WHERE id = ?')
    const updateUserStorageQuery = db.prepare('UPDATE users SET storage_used_bytes = storage_used_bytes - ? WHERE id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      deleteFileQuery.run(file.id)
      updateUserStorageQuery.run(file.size_bytes, user.id)
      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'FILE_DELETE', 
        'file', 
        file.id, 
        JSON.stringify({ 
          filename: file.original_filename, 
          size: file.size_bytes 
        })
      )
    })()

    try {
      await fs.unlink(filePath)
    } catch (error) {
      console.warn('Could not delete file from disk:', filePath, error)
    }

    return c.json({ message: 'File deleted successfully' })
  } catch (error) {
    console.error('Delete file error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to delete file' }, 500)
  }
})

fileRoutes.post('/bulk/move-to-collection', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const { fileIds, collectionId } = await c.req.json()
    
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return c.json({ error: 'INVALID_REQUEST', message: 'File IDs array is required' }, 400)
    }

    if (!collectionId) {
      return c.json({ error: 'INVALID_REQUEST', message: 'Collection ID is required' }, 400)
    }

    const db = c.get('db') as Database

    const collectionQuery = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?')
    const collection = collectionQuery.get(collectionId, user.id)

    if (!collection) {
      return c.json({ error: 'COLLECTION_NOT_FOUND', message: 'Collection not found or not owned by user' }, 404)
    }

    const filesQuery = db.prepare('SELECT * FROM files WHERE id IN (' + fileIds.map(() => '?').join(',') + ') AND user_id = ?')
    const files = filesQuery.all(...fileIds, user.id) as FileRecord[]

    if (files.length === 0) {
      return c.json({ error: 'NO_FILES_FOUND', message: 'No files found to move' }, 404)
    }

    const insertQuery = db.prepare('INSERT OR IGNORE INTO file_collections (file_id, collection_id) VALUES (?, ?)')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    let movedCount = 0

    db.transaction(() => {
      for (const file of files) {
        const result = insertQuery.run(file.id, collectionId)
        if (result.changes > 0) {
          movedCount++
          auditLogQuery.run(
            nanoid(), 
            user.id, 
            'FILE_ADD_TO_COLLECTION', 
            'file', 
            file.id, 
            JSON.stringify({ 
              collection_name: (collection as any).name,
              filename: file.original_filename 
            })
          )
        }
      }
    })()

    return c.json({ 
      message: `${movedCount} files moved to collection successfully`,
      movedCount
    })
  } catch (error) {
    console.error('Bulk move to collection error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to move files to collection' }, 500)
  }
})

fileRoutes.post('/bulk/remove-from-collection', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const { fileIds, collectionId } = await c.req.json()
    
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return c.json({ error: 'INVALID_REQUEST', message: 'File IDs array is required' }, 400)
    }

    if (!collectionId) {
      return c.json({ error: 'INVALID_REQUEST', message: 'Collection ID is required' }, 400)
    }

    const db = c.get('db') as Database

    const collectionQuery = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?')
    const collection = collectionQuery.get(collectionId, user.id)

    if (!collection) {
      return c.json({ error: 'COLLECTION_NOT_FOUND', message: 'Collection not found or not owned by user' }, 404)
    }

    const filesQuery = db.prepare('SELECT * FROM files WHERE id IN (' + fileIds.map(() => '?').join(',') + ') AND user_id = ?')
    const files = filesQuery.all(...fileIds, user.id) as FileRecord[]

    if (files.length === 0) {
      return c.json({ error: 'NO_FILES_FOUND', message: 'No files found to remove' }, 404)
    }

    const deleteQuery = db.prepare('DELETE FROM file_collections WHERE file_id = ? AND collection_id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    let removedCount = 0

    db.transaction(() => {
      for (const file of files) {
        const result = deleteQuery.run(file.id, collectionId)
        if (result.changes > 0) {
          removedCount++
          auditLogQuery.run(
            nanoid(), 
            user.id, 
            'FILE_REMOVE_FROM_COLLECTION', 
            'file', 
            file.id, 
            JSON.stringify({ 
              collection_name: (collection as any).name,
              filename: file.original_filename 
            })
          )
        }
      }
    })()

    return c.json({ 
      message: `${removedCount} files removed from collection successfully`,
      removedCount
    })
  } catch (error) {
    console.error('Bulk remove from collection error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to remove files from collection' }, 500)
  }
})

fileRoutes.put('/:id', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const fileId = c.req.param('id')
    const { new_id } = await c.req.json()

    if (!new_id || new_id.trim().length === 0) {
      return c.json({ error: 'INVALID_ID', message: 'New file ID is required' }, 400)
    }

    const newFileId = new_id.trim()
    if (!/^[a-zA-Z0-9_-]+$/.test(newFileId)) {
      return c.json({ error: 'INVALID_ID', message: 'File ID can only contain letters, numbers, hyphens, and underscores' }, 400)
    }

    const db = c.get('db') as Database

    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    const file = fileQuery.get(fileId, user.id) as FileRecord | null

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found or not owned by user' }, 404)
    }

    const existingFileQuery = db.prepare('SELECT id FROM files WHERE id = ?')
    const existingFile = existingFileQuery.get(newFileId)

    if (existingFile) {
      return c.json({ error: 'ID_EXISTS', message: 'A file with this ID already exists' }, 409)
    }

    const extension = getFileExtension(file.original_filename)
    const subdirectory = getFileSubdirectory(file.mime_type)
    const oldFilePath = path.join(process.cwd(), 'data', 'uploads', subdirectory, `${file.id}${extension}`)
    const newFilePath = path.join(process.cwd(), 'data', 'uploads', subdirectory, `${newFileId}${extension}`)

    const updateFileQuery = db.prepare('UPDATE files SET id = ? WHERE id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      updateFileQuery.run(newFileId, file.id)
      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'FILE_RENAME', 
        'file', 
        newFileId, 
        JSON.stringify({ 
          old_id: file.id, 
          new_id: newFileId,
          filename: file.original_filename
        })
      )
    })()

    try {
      await fs.rename(oldFilePath, newFilePath)
    } catch (error) {
      console.warn('Could not rename file on disk:', error)
    }

    return c.json({ 
      message: 'File renamed successfully', 
      new_url: getFileUrl(newFileId, extension) 
    })
  } catch (error) {
    console.error('Rename file error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to rename file' }, 500)
  }
})

fileRoutes.patch('/:id', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const fileId = c.req.param('id')
    const { tags, expires_at, download_limit } = await c.req.json()

    const db = c.get('db') as Database

    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    const file = fileQuery.get(fileId, user.id) as FileRecord | null

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found or not owned by user' }, 404)
    }

    const updates: string[] = []
    const values: any[] = []

    if (expires_at) {
      const expiryDate = new Date(expires_at)
      if (isNaN(expiryDate.getTime())) {
        return c.json({ error: 'INVALID_DATE', message: 'Invalid expiration date' }, 400)
      }
      updates.push('expires_at = ?')
      values.push(expiryDate.toISOString())
    }

    if (download_limit !== undefined) {
      if (download_limit !== null && (typeof download_limit !== 'number' || download_limit < 0)) {
        return c.json({ error: 'INVALID_LIMIT', message: 'Download limit must be a positive number or null' }, 400)
      }
      updates.push('download_limit = ?')
      values.push(download_limit)
    }

    if (updates.length > 0) {
      values.push(fileId)
      const updateFileQuery = db.prepare(`UPDATE files SET ${updates.join(', ')} WHERE id = ?`)
      updateFileQuery.run(...values)
    }

    if (tags && Array.isArray(tags)) {
      const deleteTagsQuery = db.prepare('DELETE FROM file_tags WHERE file_id = ?')
      const insertTagQuery = db.prepare(`
        INSERT INTO file_tags (id, file_id, tag, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)

      db.transaction(() => {
        deleteTagsQuery.run(fileId)
        for (const tag of tags) {
          if (tag && tag.trim().length > 0) {
            insertTagQuery.run(nanoid(), fileId, tag.trim())
          }
        }
      })()
    }

    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    auditLogQuery.run(
      nanoid(), 
      user.id, 
      'FILE_UPDATE', 
      'file', 
      fileId, 
      JSON.stringify({ 
        filename: file.original_filename,
        updates: { tags, expires_at, download_limit }
      })
    )

    return c.json({ message: 'File updated successfully' })
  } catch (error) {
    console.error('Update file error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to update file' }, 500)
  }
})

fileRoutes.get('/:id/analytics', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const fileId = c.req.param('id')
    const db = c.get('db') as Database

    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    const file = fileQuery.get(fileId, user.id) as FileRecord | null

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found or not owned by user' }, 404)
    }

    const analyticsQuery = db.prepare(`
      SELECT action, COUNT(*) as count, 
             DATE(created_at) as date
      FROM file_analytics 
      WHERE file_id = ? 
      GROUP BY action, DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `)
    const analytics = analyticsQuery.all(fileId)

    const referrerQuery = db.prepare(`
      SELECT referrer, COUNT(*) as count
      FROM file_analytics 
      WHERE file_id = ? AND referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 10
    `)
    const referrers = referrerQuery.all(fileId)

    const tagsQuery = db.prepare(`
      SELECT tag FROM file_tags WHERE file_id = ?
    `)
    const tags = tagsQuery.all(fileId).map(row => (row as any).tag)

    return c.json({
      file: {
        id: file.id,
        original_filename: file.original_filename,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        view_count: file.view_count,
        download_count: file.download_count,
        download_limit: file.download_limit,
        expires_at: file.expires_at,
        created_at: file.created_at,
        tags
      },
      analytics,
      referrers
    })
  } catch (error) {
    console.error('Get file analytics error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get file analytics' }, 500)
  }
})

fileRoutes.post('/:id/collections/:collectionId', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const fileId = c.req.param('id')
    const collectionId = c.req.param('collectionId')
    const db = c.get('db') as Database

    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    const file = fileQuery.get(fileId, user.id)

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found or not owned by user' }, 404)
    }

    const collectionQuery = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?')
    const collection = collectionQuery.get(collectionId, user.id)

    if (!collection) {
      return c.json({ error: 'COLLECTION_NOT_FOUND', message: 'Collection not found or not owned by user' }, 404)
    }

    const existingQuery = db.prepare('SELECT * FROM file_collections WHERE file_id = ? AND collection_id = ?')
    const existing = existingQuery.get(fileId, collectionId)

    if (existing) {
      return c.json({ error: 'ALREADY_IN_COLLECTION', message: 'File is already in this collection' }, 409)
    }

    const insertQuery = db.prepare('INSERT INTO file_collections (file_id, collection_id) VALUES (?, ?)')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      insertQuery.run(fileId, collectionId)
      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'FILE_ADD_TO_COLLECTION', 
        'file', 
        fileId, 
        JSON.stringify({ 
          collection_name: (collection as any).name,
          filename: (file as any).original_filename 
        })
      )
    })()

    return c.json({ message: 'File added to collection successfully' })
  } catch (error) {
    console.error('Add file to collection error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to add file to collection' }, 500)
  }
})

fileRoutes.delete('/:id/collections/:collectionId', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const fileId = c.req.param('id')
    const collectionId = c.req.param('collectionId')
    const db = c.get('db') as Database

    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    const file = fileQuery.get(fileId, user.id)

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found or not owned by user' }, 404)
    }

    const collectionQuery = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?')
    const collection = collectionQuery.get(collectionId, user.id)

    if (!collection) {
      return c.json({ error: 'COLLECTION_NOT_FOUND', message: 'Collection not found or not owned by user' }, 404)
    }

    const deleteQuery = db.prepare('DELETE FROM file_collections WHERE file_id = ? AND collection_id = ?')
    const auditLogQuery = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    db.transaction(() => {
      deleteQuery.run(fileId, collectionId)
      auditLogQuery.run(
        nanoid(), 
        user.id, 
        'FILE_REMOVE_FROM_COLLECTION', 
        'file', 
        fileId, 
        JSON.stringify({ 
          collection_name: (collection as any).name,
          filename: (file as any).original_filename 
        })
      )
    })()

    return c.json({ message: 'File removed from collection successfully' })
  } catch (error) {
    console.error('Remove file from collection error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to remove file from collection' }, 500)
  }
})

fileRoutes.post('/upload', async (c) => {
  try {
    const user = await getUserFromSession(c)
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401)
    }

    const db = c.get('db') as Database
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return c.json({ error: 'NO_FILE', message: 'No file provided' }, 400)
    }

    const MAX_FILE_SIZE = 250 * 1024 * 1024 // 250MB
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'FILE_TOO_LARGE', message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }, 413)
    }

    if (user.storage_used_bytes + file.size > user.storage_quota_bytes) {
      return c.json({ error: 'QUOTA_EXCEEDED', message: 'Upload would exceed storage quota' }, 413)
    }

    const buffer = await file.arrayBuffer()
    
    // Proper file type detection using file-type library for security
    const fileType = await fileTypeFromBuffer(buffer)
    if (!fileType) {
      return c.json({ error: 'INVALID_FILE_TYPE', message: 'Unable to determine file type' }, 400)
    }

    const fileId = nanoid(FILE_ID_LENGTH) // Use consistent file ID length
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
          upload_method: 'session'
        })
      )
    })()

    const fileUrl = getFileUrl(fileId, extension)

    return c.json({ url: fileUrl })
  } catch (error) {
    console.error('Session upload error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Upload failed' }, 500)
  }
}) 

// Add thumbnail serving route before the main file serving route
fileRoutes.get('/:id/thumbnail', async (c) => {
  try {
    const fileId = c.req.param('id')
    const size = c.req.query('size') || 'medium'
    const db = c.get('db') as Database

    // Validate size parameter
    if (!['small', 'medium', 'large'].includes(size)) {
      return c.json({ error: 'INVALID_SIZE', message: 'Size must be small, medium, or large' }, 400)
    }

    // Check if file exists and is not expired
    const fileQuery = db.prepare('SELECT * FROM files WHERE id = ? AND expires_at > datetime("now")')
    const file = fileQuery.get(fileId) as FileRecord | null

    if (!file) {
      return c.json({ error: 'FILE_NOT_FOUND', message: 'File not found or expired' }, 404)
    }

    // Check if file type supports thumbnails
    if (!supportsThumbnails(file.mime_type)) {
      return c.json({ error: 'NO_THUMBNAIL', message: 'File type does not support thumbnails' }, 400)
    }

    // Get thumbnail URL
    const thumbnailUrl = await thumbnailGenerator.getThumbnailUrl(fileId, size as 'small' | 'medium' | 'large')
    
    if (!thumbnailUrl) {
      // Try to generate thumbnail if it doesn't exist
      try {
        const extension = getFileExtension(file.original_filename)
        const subdirectory = getFileSubdirectory(file.mime_type)
        const originalFilePath = path.join(process.cwd(), 'data', 'uploads', subdirectory, `${file.id}${extension}`)
        
        const sizeMap = {
          small: { width: 150, height: 150 },
          medium: { width: 300, height: 300 },
          large: { width: 600, height: 600 }
        }
        
        const options = sizeMap[size as keyof typeof sizeMap]
        const thumbnailPath = await thumbnailGenerator.generateThumbnail(
          originalFilePath,
          fileId,
          file.mime_type,
          options
        )

        if (!thumbnailPath) {
          return c.json({ error: 'THUMBNAIL_GENERATION_FAILED', message: 'Failed to generate thumbnail' }, 500)
        }

        // Serve the newly generated thumbnail
        const thumbnailBuffer = await fs.readFile(thumbnailPath)
        c.header('Content-Type', 'image/webp')
        c.header('Content-Length', thumbnailBuffer.length.toString())
        c.header('Cache-Control', 'public, max-age=2592000') // 30 days
        return c.body(thumbnailBuffer)

      } catch (error) {
        console.error(`Failed to generate thumbnail for ${fileId}:`, error)
        return c.json({ error: 'THUMBNAIL_GENERATION_FAILED', message: 'Failed to generate thumbnail' }, 500)
      }
    }

    // Serve existing thumbnail
    try {
      const sizeMap = {
        small: { width: 150, height: 150 },
        medium: { width: 300, height: 300 },
        large: { width: 600, height: 600 }
      }
      
      const options = sizeMap[size as keyof typeof sizeMap]
      const thumbnailPath = path.join(
        process.cwd(), 
        'data', 
        'thumbnails', 
        `${fileId}_${options.width}x${options.height}.webp`
      )
      
      const thumbnailBuffer = await fs.readFile(thumbnailPath)
      
      c.header('Content-Type', 'image/webp')
      c.header('Content-Length', thumbnailBuffer.length.toString())
      c.header('Cache-Control', 'public, max-age=2592000') // 30 days
      
      return c.body(thumbnailBuffer)
    } catch (error) {
      return c.json({ error: 'THUMBNAIL_NOT_FOUND', message: 'Thumbnail file not found' }, 404)
    }
      } catch (error) {
      console.error('Thumbnail serve error:', error)
      return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to serve thumbnail' }, 500)
    }
  })

 