import { memo, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import { 
  File as FileIcon, 
  Video, 
  Eye,
  Download,
  MoreVertical,
  Loader2,
  ExternalLink
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLazyLoading, useLazyImage } from '@/hooks/useLazyLoading'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTheme } from '@/contexts/ThemeContext'
import { formatBytes, getFileIcon } from '@/lib/utils'
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton'
import type { File } from '@/types'

interface LazyFileGridProps {
  collectionId?: string | null
  onFileSelect?: (file: File) => void
  onFileAction?: (action: string, file: File) => void
  searchQuery?: string
  filters?: Record<string, any>
}

interface FileGridItemProps {
  file: File
  onSelect?: (file: File) => void
  onAction?: (action: string, file: File) => void
  style?: React.CSSProperties
}

const FileGridItem = memo(({ file, onSelect, onAction, style }: FileGridItemProps) => {
  const { gradients } = useTheme()
  const isMobile = useIsMobile()
  const [isHovered, setIsHovered] = useState(false)

  const { elementRef, imageSrc, isLoaded, hasError } = useLazyImage({
    src: `/api/files/${file.id}/thumbnail`,
    placeholder: '/placeholder-thumbnail.png',
    fallback: '/default-file-icon.png'
  })

  const isImage = file.mime_type.startsWith('image/')
  const isVideo = file.mime_type.startsWith('video/')

  const handleAction = useCallback((action: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onAction?.(action, file)
  }, [onAction, file])

  return (
    <motion.div
      style={style}
      className="p-2"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        ref={elementRef as React.RefObject<HTMLDivElement>}
        className={`group relative overflow-hidden cursor-pointer transition-all duration-300 ${
          isHovered 
            ? 'shadow-lg shadow-purple-500/20 border-purple-400/50' 
            : 'hover:shadow-md hover:border-purple-300/30'
        }`}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        onClick={() => onSelect?.(file)}
      >
        <CardContent className="p-0">
          {/* Thumbnail/Preview */}
          <div className="relative aspect-square bg-muted/30">
            {isImage && isLoaded ? (
              <motion.img
                src={imageSrc}
                alt={file.original_filename}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            ) : isVideo && isLoaded ? (
              <div className="relative w-full h-full">
                <motion.img
                  src={imageSrc}
                  alt={file.original_filename}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Video className="w-8 h-8 text-white" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                {!isLoaded && !hasError ? (
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : (
                  getFileIcon(file.mime_type, 'w-12 h-12 text-muted-foreground')
                )}
              </div>
            )}

            {/* Hover Overlay */}
            <AnimatePresence>
              {(isHovered || isMobile) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 bg-gradient-to-t ${gradients.accent} flex items-end justify-between p-2`}
                >
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                      onClick={(e) => handleAction('preview', e)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                      onClick={(e) => handleAction('view', e)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                      onClick={(e) => handleAction('download', e)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => handleAction('copy-link', e)}>
                        copy link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleAction('rename', e)}>
                        rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleAction('move', e)}>
                        move to collection
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => handleAction('delete', e)}
                        className="text-destructive"
                      >
                        delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              )}
            </AnimatePresence>

            {/* File Type Badge */}
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs bg-white/90">
                {file.mime_type.split('/')[0]}
              </Badge>
            </div>

            {/* Download Limit Indicator */}
            {file.download_limit && (
              <div className="absolute top-2 right-2">
                <Badge variant="outline" className="text-xs bg-white/90">
                  {file.download_count}/{file.download_limit}
                </Badge>
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="p-3">
            <div className="space-y-1">
              <h3 className="font-medium text-sm truncate" title={file.original_filename}>
                {file.original_filename}
              </h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatBytes(file.size_bytes)}</span>
                <span>{file.view_count} views</span>
              </div>
              
              {/* Tags */}
              {file.tags && file.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {file.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {file.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{file.tags.length - 2}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})

FileGridItem.displayName = 'FileGridItem'

export function LazyFileGrid({ 
  collectionId, 
  onFileSelect, 
  onFileAction,
  searchQuery,
  filters 
}: LazyFileGridProps) {
  const isMobile = useIsMobile()
  const parentRef = useRef<HTMLDivElement>(null)

  // API query function for lazy loading
  const queryFn = useCallback(async ({ pageParam, pageSize }: { pageParam: number; pageSize: number }) => {
    const { filesApi } = await import('@/lib/api')
    
    const params = {
      page: pageParam,
      limit: pageSize,
      ...(collectionId ? { collection_id: collectionId } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
      ...Object.entries(filters || {}).reduce((acc, [key, value]) => ({
        ...acc,
        [key]: value.toString()
      }), {})
    }
    
    const response = await filesApi.getMyFiles(params)
    
    return {
      items: response.files,
      hasNextPage: response.files.length === pageSize,
      totalCount: response.total
    }
  }, [collectionId, searchQuery, filters])

  const {
    items: files,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    loadingRef
  } = useLazyLoading({
    queryKey: ['files', 'lazy', collectionId || 'all', searchQuery || '', JSON.stringify(filters || {})],
    queryFn,
    pageSize: isMobile ? 12 : 24,
    threshold: 500
  })

  // Virtual scrolling for better performance
  const virtualizer = useVirtualizer({
    count: Math.ceil(files.length / (isMobile ? 2 : 4)),
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 220 : 280),
    overscan: 5
  })

  const items = virtualizer.getVirtualItems()
  const columnsPerRow = isMobile ? 2 : 4

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <EnhancedSkeleton key={i} variant="file-card" />
        ))}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">no files found</h3>
        <p className="text-sm text-muted-foreground">
          {searchQuery ? 'try adjusting your search terms' : 'upload some files to get started'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Total count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount ? `${totalCount} files` : `${files.length} files`}
        </p>
      </div>

      {/* Virtual scrolling container */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '70vh' }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative'
          }}
        >
          {items.map((virtualRow) => {
            const startIndex = virtualRow.index * columnsPerRow
            const rowFiles = files.slice(startIndex, startIndex + columnsPerRow)

            return (
              <div
                key={virtualRow.index}
                className={`grid gap-4 ${
                  isMobile 
                    ? 'grid-cols-2' 
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                }`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {rowFiles.map((file) => (
                  <FileGridItem
                    key={file.id}
                    file={file}
                    onSelect={onFileSelect}
                    onAction={onFileAction}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Loading indicator for infinite scroll */}
      <div ref={loadingRef} className="flex justify-center py-4">
        <AnimatePresence>
          {isFetchingNextPage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              loading more files...
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* End of list indicator */}
      {!hasNextPage && files.length > 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            you've reached the end of your files
          </p>
        </div>
      )}
    </div>
  )
} 