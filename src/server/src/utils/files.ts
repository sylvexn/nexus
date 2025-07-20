import path from 'path'

export function getFileExtension(filename: string, mimeType?: string): string {
  const originalExt = path.extname(filename)
  if (originalExt) {
    return originalExt
  }

  // Fallback to MIME type mapping if no extension and MIME type provided
  if (mimeType) {
    const commonExtensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'text/plain': '.txt',
      'application/pdf': '.pdf',
      'application/json': '.json'
    }
    return commonExtensions[mimeType] || ''
  }

  return ''
}

export function getFileSubdirectory(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return 'img'
  } else if (mimeType.startsWith('video/')) {
    return 'vid'
  } else {
    return 'other'
  }
} 