import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { 
  Search, 
  Filter, 
  Calendar, 
  HardDrive,
  Tag,
  FileType,
  Clock,
  SortAsc,
  SortDesc,
  X,
  CheckCircle,
  Circle
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'

import { 
  CommandDialog,
  CommandInput,
} from "@/components/ui/command"
import { DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { formatBytes, getFileIcon } from '@/lib/utils'
import type { File } from '@/types'

interface AdvancedSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelect?: (file: File) => void
  onFiltersChange?: (filters: SearchFilters) => void
}

interface SearchFilters {
  query: string
  fileType: string[]
  dateRange: string
  sizeRange: [number, number]
  tags: string[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

const defaultFilters: SearchFilters = {
  query: '',
  fileType: [],
  dateRange: 'all',
  sizeRange: [0, 250],
  tags: [],
  sortBy: 'created_at',
  sortOrder: 'desc'
}

const fileTypes = [
  { value: 'image', label: 'images', icon: '🖼️' },
  { value: 'video', label: 'videos', icon: '🎥' },
  { value: 'audio', label: 'audio', icon: '🎵' },
  { value: 'document', label: 'documents', icon: '📄' },
  { value: 'archive', label: 'archives', icon: '📦' },
  { value: 'other', label: 'other', icon: '📁' }
]

const dateRanges = [
  { value: 'all', label: 'all time' },
  { value: 'today', label: 'today' },
  { value: 'week', label: 'this week' },
  { value: 'month', label: 'this month' },
  { value: 'year', label: 'this year' }
]

const sortOptions = [
  { value: 'created_at', label: 'date created' },
  { value: 'name', label: 'name' },
  { value: 'size', label: 'size' },
  { value: 'view_count', label: 'views' },
  { value: 'download_count', label: 'downloads' }
]

export function AdvancedSearch({ 
  open, 
  onOpenChange, 
  onFileSelect,
  onFiltersChange 
}: AdvancedSearchProps) {
  const { isAuthenticated } = useAuthStore()
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [showFilters, setShowFilters] = useState(false)

  // Fetch files based on search filters
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['files', 'search', filters],
    queryFn: async () => {
      if (!filters.query.trim() && filters.fileType.length === 0) {
        return { files: [] }
      }
      
      const { filesApi } = await import('@/lib/api')
      return filesApi.searchFiles(filters)
    },
    enabled: open && (!!filters.query.trim() || filters.fileType.length > 0)
  })

  // Get available tags
  const { data: tagsData } = useQuery({
    queryKey: ['files', 'tags'],
    queryFn: async () => {
      const { filesApi } = await import('@/lib/api')
      return filesApi.getAllTags()
    },
    enabled: open && isAuthenticated
  })

  const availableTags = useMemo(() => {
    return tagsData?.tags || []
  }, [tagsData])

  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    const updated = { ...filters, ...newFilters }
    setFilters(updated)
    onFiltersChange?.(updated)
  }

  const toggleFileType = (type: string) => {
    const newTypes = filters.fileType.includes(type)
      ? filters.fileType.filter(t => t !== type)
      : [...filters.fileType, type]
    updateFilters({ fileType: newTypes })
  }

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag]
    updateFilters({ tags: newTags })
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
    onFiltersChange?.(defaultFilters)
  }

  const hasActiveFilters = filters.fileType.length > 0 || 
    filters.dateRange !== 'all' || 
    filters.tags.length > 0 ||
    filters.sizeRange[0] !== 0 || 
    filters.sizeRange[1] !== 250

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'f' && (e.metaKey || e.ctrlKey) && open) {
        e.preventDefault()
        setShowFilters(!showFilters)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange, showFilters])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">search files</DialogTitle>
      <div className="relative">
        <CommandInput 
          placeholder="search files... (⌘k)" 
          value={filters.query}
          onValueChange={(value) => updateFilters({ query: value })}
        />
        
        {/* Filter Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          className={`absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 ${
            showFilters ? 'bg-accent' : ''
          }`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden border-b border-border bg-gradient-to-r from-purple-500/5 via-purple-400/3 to-transparent"
          >
            <div className="p-4 space-y-4">
              {/* File Types */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <FileType className="h-4 w-4" />
                    file types
                  </label>
                  {filters.fileType.length > 0 && (
                    <Badge variant="secondary">{filters.fileType.length}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {fileTypes.map((type) => (
                    <motion.button
                      key={type.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleFileType(type.value)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                        filters.fileType.includes(type.value)
                          ? 'bg-purple-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Date Range and Size Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    date range
                  </label>
                  <Select 
                    value={filters.dateRange} 
                    onValueChange={(value) => updateFilters({ dateRange: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    size range (mb)
                  </label>
                  <div className="px-2">
                    <Slider
                      value={filters.sizeRange}
                      onValueChange={(value) => updateFilters({ sizeRange: value as [number, number] })}
                      max={250}
                      min={0}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{filters.sizeRange[0]}mb</span>
                      <span>{filters.sizeRange[1]}mb</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tags */}
              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      tags
                    </label>
                    {filters.tags.length > 0 && (
                      <Badge variant="secondary">{filters.tags.length}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {availableTags.map((tag) => (
                      <motion.button
                        key={tag}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleTag(tag)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                          filters.tags.includes(tag)
                            ? 'bg-purple-500 text-white'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {filters.tags.includes(tag) ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        {tag}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">sort by</label>
                  <Select 
                    value={filters.sortBy} 
                    onValueChange={(value) => updateFilters({ sortBy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">order</label>
                  <div className="flex gap-2">
                    <Button
                      variant={filters.sortOrder === 'asc' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateFilters({ sortOrder: 'asc' })}
                      className="flex-1"
                    >
                      <SortAsc className="h-4 w-4 mr-1" />
                      asc
                    </Button>
                    <Button
                      variant={filters.sortOrder === 'desc' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateFilters({ sortOrder: 'desc' })}
                      className="flex-1"
                    >
                      <SortDesc className="h-4 w-4 mr-1" />
                      desc
                    </Button>
                  </div>
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="flex items-center gap-2"
                  >
                    <X className="h-3 w-3" />
                    clear filters
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
            <span className="text-muted-foreground">searching files...</span>
          </div>
        )}

        {!isLoading && searchResults?.files && searchResults.files.length > 0 && (
          <div className="overflow-y-auto max-h-96">
            <div className="px-2 py-2 text-xs font-medium text-muted-foreground border-b">
              {searchResults.files.length} files found
            </div>
            <div className="divide-y">
              {searchResults.files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => {
                    onFileSelect?.(file)
                    onOpenChange(false)
                  }}
                  className="w-full text-left p-3 hover:bg-accent focus:bg-accent focus:outline-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden">
                      {file.mime_type.startsWith('image/') ? (
                        <img 
                          src={`/api/files/${file.id}/thumbnail?size=small`}
                          alt={file.original_filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        getFileIcon(file.mime_type, 'h-6 w-6')
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{file.original_filename}</span>
                        {file.tags && file.tags.length > 0 && (
                          <div className="flex gap-1">
                            {file.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {file.tags.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{file.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>{formatBytes(file.size_bytes)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(file.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isLoading && searchResults && (!searchResults.files || searchResults.files.length === 0) && (
          <div className="flex flex-col items-center justify-center py-8">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-1">no files found matching your criteria</p>
            <p className="text-xs text-muted-foreground">
              try adjusting your search terms or filters
            </p>
          </div>
        )}

        {!isLoading && !searchResults && !filters.query.trim() && filters.fileType.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-1">start typing to search files</p>
            <p className="text-xs text-muted-foreground">
              press ⌘f to open advanced filters
            </p>
          </div>
        )}


      </div>
    </CommandDialog>
  )
} 