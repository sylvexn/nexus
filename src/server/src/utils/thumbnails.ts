import sharp from 'sharp'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'

interface ThumbnailOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
}

interface VideoThumbnailOptions extends ThumbnailOptions {
  timestamp?: string // Format: "00:00:05" for 5 seconds
}

const DEFAULT_THUMBNAIL_OPTIONS: Required<ThumbnailOptions> = {
  width: 300,
  height: 300,
  quality: 80,
  format: 'webp'
}

export class ThumbnailGenerator {
  private thumbnailsDir: string
  private cacheDir: string

  constructor() {
    this.thumbnailsDir = path.join(process.cwd(), 'data', 'thumbnails')
    this.cacheDir = path.join(this.thumbnailsDir, 'cache')
    this.ensureDirectories()
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.thumbnailsDir, { recursive: true })
      await fs.mkdir(this.cacheDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create thumbnail directories:', error)
    }
  }

  private getThumbnailPath(fileId: string, options: ThumbnailOptions): string {
    const { width, height, format } = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options }
    const filename = `${fileId}_${width}x${height}.${format}`
    return path.join(this.thumbnailsDir, filename)
  }

  private getCacheKey(fileId: string, options: ThumbnailOptions): string {
    const { width, height, format, quality } = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options }
    return `${fileId}_${width}x${height}_q${quality}.${format}`
  }

  async generateImageThumbnail(
    inputPath: string,
    fileId: string,
    options: ThumbnailOptions = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options }
    const outputPath = this.getThumbnailPath(fileId, opts)

    // Check if thumbnail already exists
    if (existsSync(outputPath)) {
      return outputPath
    }

    try {
      await sharp(inputPath)
        .resize(opts.width, opts.height, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: opts.quality })
        .toFile(outputPath)

      console.log(`✅ Generated image thumbnail: ${outputPath}`)
      return outputPath
    } catch (error) {
      console.error(`❌ Failed to generate image thumbnail for ${fileId}:`, error)
      throw new Error(`Thumbnail generation failed: ${error}`)
    }
  }

  async generateVideoThumbnail(
    inputPath: string,
    fileId: string,
    options: VideoThumbnailOptions = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, timestamp: '00:00:05', ...options }
    const outputPath = this.getThumbnailPath(fileId, opts)

    // Check if thumbnail already exists
    if (existsSync(outputPath)) {
      return outputPath
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(opts.timestamp)
        .frames(1)
        .size(`${opts.width}x${opts.height}`)
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Generated video thumbnail: ${outputPath}`)
          resolve(outputPath)
        })
        .on('error', (error) => {
          console.error(`❌ Failed to generate video thumbnail for ${fileId}:`, error)
          reject(new Error(`Video thumbnail generation failed: ${error.message}`))
        })
        .run()
    })
  }

  async generateThumbnail(
    inputPath: string,
    fileId: string,
    mimeType: string,
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    try {
      if (mimeType.startsWith('image/')) {
        return await this.generateImageThumbnail(inputPath, fileId, options)
      } else if (mimeType.startsWith('video/')) {
        return await this.generateVideoThumbnail(inputPath, fileId, options)
      } else {
        console.log(`⚠️  No thumbnail generation for MIME type: ${mimeType}`)
        return null
      }
    } catch (error) {
      console.error(`❌ Thumbnail generation failed for ${fileId}:`, error)
      return null
    }
  }

  async generateMultipleSizes(
    inputPath: string,
    fileId: string,
    mimeType: string
  ): Promise<Record<string, string>> {
    const sizes = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 600, height: 600 }
    ]

    const results: Record<string, string> = {}

    for (const size of sizes) {
      try {
        const thumbnailPath = await this.generateThumbnail(
          inputPath,
          fileId,
          mimeType,
          { width: size.width, height: size.height }
        )
        if (thumbnailPath) {
          results[size.name] = thumbnailPath
        }
      } catch (error) {
        console.error(`Failed to generate ${size.name} thumbnail:`, error)
      }
    }

    return results
  }

  async getThumbnailUrl(fileId: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<string | null> {
    const sizeMap = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 }
    }

    const options = sizeMap[size]
    const thumbnailPath = this.getThumbnailPath(fileId, options)

    if (existsSync(thumbnailPath)) {
      // Return relative URL for serving
      return `/api/files/${fileId}/thumbnail?size=${size}`
    }

    return null
  }

  async deleteThumbnails(fileId: string): Promise<void> {
    try {
      // Find all thumbnails for this file
      const files = await fs.readdir(this.thumbnailsDir)
      const thumbnailFiles = files.filter(file => file.startsWith(`${fileId}_`))

      for (const file of thumbnailFiles) {
        const filePath = path.join(this.thumbnailsDir, file)
        try {
          await fs.unlink(filePath)
          console.log(`🗑️  Deleted thumbnail: ${file}`)
        } catch (error) {
          console.warn(`⚠️  Failed to delete thumbnail ${file}:`, error)
        }
      }
    } catch (error) {
      console.error(`❌ Failed to delete thumbnails for ${fileId}:`, error)
    }
  }

  async cleanupOrphanedThumbnails(validFileIds: string[]): Promise<number> {
    try {
      const files = await fs.readdir(this.thumbnailsDir)
      let deletedCount = 0

      for (const file of files) {
        // Extract file ID from thumbnail filename (format: fileId_widthxheight.ext)
        const match = file.match(/^([a-zA-Z0-9_-]+)_\d+x\d+\.(webp|jpeg|jpg|png)$/)
        if (match) {
          const fileId = match[1]
          if (!validFileIds.includes(fileId)) {
            try {
              await fs.unlink(path.join(this.thumbnailsDir, file))
              deletedCount++
              console.log(`🧹 Cleaned up orphaned thumbnail: ${file}`)
            } catch (error) {
              console.warn(`⚠️  Failed to delete orphaned thumbnail ${file}:`, error)
            }
          }
        }
      }

      console.log(`✨ Cleaned up ${deletedCount} orphaned thumbnails`)
      return deletedCount
    } catch (error) {
      console.error('❌ Failed to cleanup orphaned thumbnails:', error)
      return 0
    }
  }

  async getStorageStats(): Promise<{
    totalThumbnails: number
    totalSize: number
    avgFileSize: number
  }> {
    try {
      const files = await fs.readdir(this.thumbnailsDir)
      let totalSize = 0

      for (const file of files) {
        try {
          const filePath = path.join(this.thumbnailsDir, file)
          const stats = await fs.stat(filePath)
          totalSize += stats.size
        } catch (error) {
          console.warn(`Failed to get stats for ${file}:`, error)
        }
      }

      return {
        totalThumbnails: files.length,
        totalSize,
        avgFileSize: files.length > 0 ? Math.round(totalSize / files.length) : 0
      }
    } catch (error) {
      console.error('Failed to get thumbnail storage stats:', error)
      return { totalThumbnails: 0, totalSize: 0, avgFileSize: 0 }
    }
  }
}

// Export singleton instance
export const thumbnailGenerator = new ThumbnailGenerator()

// Helper function to check if a file type supports thumbnail generation
export function supportsThumbnails(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/')
}

// Helper function to get appropriate thumbnail format based on input
export function getOptimalThumbnailFormat(mimeType: string): 'webp' | 'jpeg' | 'png' {
  // WebP for most cases (best compression)
  if (mimeType.startsWith('image/png') && mimeType.includes('alpha')) {
    return 'png' // Preserve transparency
  }
  return 'webp' // Default to WebP for best compression
} 