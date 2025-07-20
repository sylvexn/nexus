import { Database } from 'bun:sqlite'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'

interface ExpiredFile {
  id: string
  user_id: string
  size_bytes: number
  mime_type: string
  created_at: string
  expires_at: string
}

interface UserStorageUpdate {
  user_id: string
  total_size: number
  file_count: number
}

function getFileSubdirectory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'img'
  if (mimeType.startsWith('video/')) return 'vid'
  return 'other'
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()
  return ext ? `.${ext}` : ''
}

export function cleanupExpiredFiles() {
  console.log('🧹 Starting expired files cleanup...')
  
  const dbPath = process.env.DATABASE_URL || 'data/db/nexus.db'
  const db = new Database(dbPath)
  
  let totalCleaned = 0
  let totalSizeFreed = 0
  let filesNotFound = 0
  const userUpdates = new Map<string, UserStorageUpdate>()

  try {
    // Start a transaction for atomic operations
    db.exec('BEGIN TRANSACTION')

    // Find all expired files
    const expiredFiles = db.query<ExpiredFile, []>(`
      SELECT id, user_id, size_bytes, mime_type, created_at, expires_at
      FROM files
      WHERE expires_at <= datetime('now')
    `).all()

    console.log(`📋 Found ${expiredFiles.length} expired files`)

    if (expiredFiles.length === 0) {
      console.log('✨ No expired files to clean up')
      db.exec('COMMIT')
      return { cleaned: 0, sizeFreed: 0, errors: 0 }
    }

    // Prepare statements for efficient batch operations
    const deleteFileStmt = db.prepare('DELETE FROM files WHERE id = ?')
    const deleteTagsStmt = db.prepare('DELETE FROM file_tags WHERE file_id = ?')
    const deleteCollectionsStmt = db.prepare('DELETE FROM file_collections WHERE file_id = ?')
    const deleteAnalyticsStmt = db.prepare('DELETE FROM file_analytics WHERE file_id = ?')
    const updateUserStorageStmt = db.prepare(`
      UPDATE users 
      SET storage_used_bytes = storage_used_bytes - ? 
      WHERE id = ?
    `)
    const insertAuditLogStmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, 'FILE_EXPIRED_CLEANUP', 'file', ?, ?, datetime('now'))
    `)

    // Process each expired file
    for (const file of expiredFiles) {
      try {
        // Determine file path
        const subdirectory = getFileSubdirectory(file.mime_type)
        const filePath = join(process.cwd(), 'data', 'uploads', subdirectory, `${file.id}`)
        
        // Try to find the file with common extensions if no extension in ID
        let actualFilePath = filePath
        let fileExists = existsSync(filePath)
        
        if (!fileExists) {
          // Try common extensions
          const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.pdf', '.txt', '.doc', '.docx']
          for (const ext of extensions) {
            const pathWithExt = filePath + ext
            if (existsSync(pathWithExt)) {
              actualFilePath = pathWithExt
              fileExists = true
              break
            }
          }
        }

        // Delete file from filesystem if it exists
        if (fileExists) {
          try {
            unlinkSync(actualFilePath)
            console.log(`🗑️  Deleted file: ${actualFilePath}`)
          } catch (fsError) {
            console.warn(`⚠️  Failed to delete file ${actualFilePath}:`, fsError)
          }
        } else {
          console.warn(`⚠️  File not found on filesystem: ${filePath}`)
          filesNotFound++
        }

        // Delete related records from database
        deleteAnalyticsStmt.run(file.id)
        deleteTagsStmt.run(file.id)
        deleteCollectionsStmt.run(file.id)
        deleteFileStmt.run(file.id)

        // Update user storage usage
        updateUserStorageStmt.run(file.size_bytes, file.user_id)

        // Track user updates for summary
        if (userUpdates.has(file.user_id)) {
          const existing = userUpdates.get(file.user_id)!
          userUpdates.set(file.user_id, {
            user_id: file.user_id,
            total_size: existing.total_size + file.size_bytes,
            file_count: existing.file_count + 1
          })
        } else {
          userUpdates.set(file.user_id, {
            user_id: file.user_id,
            total_size: file.size_bytes,
            file_count: 1
          })
        }

        // Create audit log entry
        const auditId = crypto.randomUUID()
        insertAuditLogStmt.run(
          auditId,
          file.user_id,
          file.id,
          JSON.stringify({
            original_filename: `file_${file.id}`,
            size_bytes: file.size_bytes,
            expired_at: file.expires_at,
            file_path: actualFilePath,
            cleanup_timestamp: new Date().toISOString()
          })
        )

        totalCleaned++
        totalSizeFreed += file.size_bytes

      } catch (fileError) {
        console.error(`❌ Error processing file ${file.id}:`, fileError)
        continue
      }
    }

    // Commit the transaction
    db.exec('COMMIT')

    // Generate cleanup summary
    console.log('\n📊 Cleanup Summary:')
    console.log(`✅ Files cleaned: ${totalCleaned}`)
    console.log(`💾 Space freed: ${formatBytes(totalSizeFreed)}`)
    console.log(`👥 Users affected: ${userUpdates.size}`)
    
    if (filesNotFound > 0) {
      console.log(`⚠️  Files not found on filesystem: ${filesNotFound}`)
    }

    // Log per-user summary
    console.log('\n👤 Per-user cleanup:')
    for (const [userId, update] of userUpdates) {
      console.log(`   User ${userId}: ${update.file_count} files, ${formatBytes(update.total_size)} freed`)
    }

    return {
      cleaned: totalCleaned,
      sizeFreed: totalSizeFreed,
      errors: filesNotFound,
      userUpdates: Array.from(userUpdates.values())
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    try {
      db.exec('ROLLBACK')
      console.log('🔄 Transaction rolled back')
    } catch (rollbackError) {
      console.error('❌ Error rolling back transaction:', rollbackError)
    }
    throw error
  } finally {
    db.close()
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Allow running this script directly
if (import.meta.main) {
  try {
    const result = cleanupExpiredFiles()
    console.log('\n🎉 Cleanup completed successfully!')
    console.log(`Final stats: ${result.cleaned} files cleaned, ${formatBytes(result.sizeFreed)} freed`)
    process.exit(0)
  } catch (error) {
    console.error('💥 Cleanup failed:', error)
    process.exit(1)
  }
} 