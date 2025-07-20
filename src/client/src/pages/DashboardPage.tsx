import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  File,
  Grid3X3,
  List,
  MoreVertical,
  Eye,
  Download,
  Copy,
  Trash,
  Edit,
  Info,
  FolderPlus,
  FolderMinus,
  X,
  ExternalLink
} from 'lucide-react'

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

import { filesApi, collectionsApi } from '@/lib/api'
import { getFileViewUrl, getShareableFileUrl, getFileUrl, getFileDirectUrl } from '@/lib/config'
import { useAuthStore } from '@/store/auth'
import { formatBytes, formatDate, getFileType, getFileIcon } from '@/lib/utils'
import { File as FileType } from '@/types'
import FileInfoPanel from '@/components/FileInfoPanel'
import RenameFileDialog from '@/components/RenameFileDialog'
import { useCollection } from '@/contexts/CollectionContext'

type ViewMode = 'grid' | 'list'
type SortBy = 'created_at' | 'original_filename' | 'size_bytes'



export default function DashboardPage() {
  const { user } = useAuthStore()
  const { selectedCollectionId } = useCollection()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortBy, setSortBy] = useState<SortBy>('created_at')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileType | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkMoveToCollectionOpen, setBulkMoveToCollectionOpen] = useState(false)
  const [bulkRemoveFromCollectionOpen, setBulkRemoveFromCollectionOpen] = useState(false)
  const [infoPanelOpen, setInfoPanelOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [fileToRename, setFileToRename] = useState<FileType | null>(null)
  const [moveToCollectionOpen, setMoveToCollectionOpen] = useState(false)
  const [fileToMove, setFileToMove] = useState<FileType | null>(null)
  const [removeFromCollectionDialogOpen, setRemoveFromCollectionDialogOpen] = useState(false)
  const [fileToRemoveFromCollection, setFileToRemoveFromCollection] = useState<FileType | null>(null)
  const [newlyUploadedFiles, setNewlyUploadedFiles] = useState<Set<string>>(new Set())
  const previousFilesRef = useRef<Set<string>>(new Set())

  const { data: filesData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['files', 'me', { sort: sortBy, collection: selectedCollectionId }],
    queryFn: () => filesApi.getMyFiles({ 
      limit: 50,
      collection_id: selectedCollectionId || undefined
    }),
    staleTime: 10000, // Consider data fresh for 10 seconds (reduced for more responsive updates)
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchInterval: 30000, // Refetch every 30 seconds to catch any external changes
  })

  const { data: collectionsData } = useQuery({
    queryKey: ['collections'],
    queryFn: collectionsApi.getMyCollections,
  })

  // Track newly uploaded files for visual feedback
  useEffect(() => {
    if (filesData?.files) {
      const currentFileIds = new Set(filesData.files.map(f => f.id))
      const previousFileIds = previousFilesRef.current
      
      // Get seen files from localStorage
      const seenFilesKey = `nexusdrop_seen_files_${user?.id || 'anonymous'}`
      const seenFiles = new Set(JSON.parse(localStorage.getItem(seenFilesKey) || '[]') as string[])
      
      // Find new files that weren't in the previous set AND haven't been seen before
      const newFiles = new Set<string>()
      currentFileIds.forEach(id => {
        if (!previousFileIds.has(id) && !seenFiles.has(id)) {
          newFiles.add(id)
        }
      })
      
      if (newFiles.size > 0) {
        setNewlyUploadedFiles(newFiles)
        
        // Clear the highlight after 3 seconds and mark as seen
        setTimeout(() => {
          markFilesAsSeen([...newFiles])
        }, 3000)
      }
      
      previousFilesRef.current = currentFileIds
      
      // Clean up old seen files periodically
      cleanupSeenFiles()
    }
  }, [filesData?.files, user?.id])



  const handleDeleteFile = (file: FileType) => {
    setFileToDelete(file)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!fileToDelete) return

    try {
      await filesApi.deleteFile(fileToDelete.id)
      toast({
        title: "file deleted",
        description: `${fileToDelete.original_filename} has been deleted`,
      })
      refetch()
    } catch (error) {
      toast({
        title: "error",
        description: "failed to delete file",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setFileToDelete(null)
    }
  }

  const confirmBulkDelete = async () => {
    if (selectedFiles.size === 0) return

    try {
      const result = await filesApi.deleteFiles([...selectedFiles])
      toast({
        title: "files deleted",
        description: result.message,
      })
      setSelectedFiles(new Set())
      refetch()
    } catch (error) {
      toast({
        title: "error",
        description: "failed to delete files",
        variant: "destructive",
      })
    } finally {
      setBulkDeleteDialogOpen(false)
    }
  }

  const confirmBulkMoveToCollection = async (collectionId: string) => {
    if (selectedFiles.size === 0) return

    try {
      const result = await filesApi.moveFilesToCollection([...selectedFiles], collectionId)
      toast({
        title: "files moved",
        description: result.message,
      })
      setSelectedFiles(new Set())
      refetch()
    } catch (error) {
      toast({
        title: "error",
        description: "failed to move files",
        variant: "destructive",
      })
    } finally {
      setBulkMoveToCollectionOpen(false)
    }
  }

  const confirmBulkRemoveFromCollection = async () => {
    if (selectedFiles.size === 0 || !selectedCollectionId) return

    try {
      const result = await filesApi.removeFilesFromCollection([...selectedFiles], selectedCollectionId)
      toast({
        title: "files removed",
        description: result.message,
      })
      setSelectedFiles(new Set())
      refetch()
    } catch (error) {
      toast({
        title: "error",
        description: "failed to remove files from collection",
        variant: "destructive",
      })
    } finally {
      setBulkRemoveFromCollectionOpen(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)))
    }
  }

  const handleSelectFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedFiles(newSelected)
  }

  const copyFileLink = (file: FileType) => {
    const url = getShareableFileUrl(file.id)
    navigator.clipboard.writeText(url)
    toast({
      title: "link copied",
      description: "file link copied to clipboard",
    })
    markFilesAsSeen([file.id])
  }

  const handlePreviewFile = (file: FileType) => {
    window.open(getFileViewUrl(file.id), '_blank')
    markFilesAsSeen([file.id])
  }

  const handleViewFile = (file: FileType) => {
    const extension = `.${file.original_filename.split('.').pop()}`
    window.open(getFileDirectUrl(file.id, extension), '_blank')
    markFilesAsSeen([file.id])
  }

  const handleDownloadFile = (file: FileType) => {
    const extension = `.${file.original_filename.split('.').pop()}`
    const url = getFileDirectUrl(file.id, extension)
    
    // Use fetch to get the file and create a blob URL
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = file.original_filename
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(blobUrl)
      })
      .catch(error => {
        console.error('Download failed:', error)
        // Fallback to direct link
        const link = document.createElement('a')
        link.href = url
        link.download = file.original_filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      })
    
    markFilesAsSeen([file.id])
  }

  const handleShowFileInfo = (file: FileType) => {
    setSelectedFile(file)
    setInfoPanelOpen(true)
    markFilesAsSeen([file.id])
  }

  const handleRenameFile = (file: FileType) => {
    setFileToRename(file)
    setRenameDialogOpen(true)
  }

  const handleMoveToCollection = (file: FileType) => {
    setFileToMove(file)
    setMoveToCollectionOpen(true)
  }

  const moveFileToCollection = async (collectionId: string) => {
    if (!fileToMove) return
    
    try {
      await collectionsApi.addFileToCollection(fileToMove.id, collectionId)
      toast({
        title: "file moved",
        description: "file has been moved to collection successfully",
      })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setMoveToCollectionOpen(false)
      setFileToMove(null)
    } catch (error: any) {
      toast({
        title: "error",
        description: error.message || "failed to move file to collection",
        variant: "destructive",
      })
    }
  }

  const handleRemoveFromCollection = (file: FileType) => {
    setFileToRemoveFromCollection(file)
    setRemoveFromCollectionDialogOpen(true)
  }

  const confirmRemoveFromCollection = async () => {
    if (!fileToRemoveFromCollection || !selectedCollectionId) return
    
    try {
      await collectionsApi.removeFileFromCollection(fileToRemoveFromCollection.id, selectedCollectionId)
      toast({
        title: "file removed",
        description: `${fileToRemoveFromCollection.original_filename} removed from collection`,
      })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setRemoveFromCollectionDialogOpen(false)
      setFileToRemoveFromCollection(null)
    } catch (error: any) {
      toast({
        title: "error",
        description: error.message || "failed to remove file from collection",
        variant: "destructive",
      })
    }
  }



  // Mark files as seen in localStorage
  const markFilesAsSeen = (fileIds: string[]) => {
    if (!user?.id) return
    
    const seenFilesKey = `nexusdrop_seen_files_${user.id}`
    const seenFiles = new Set(JSON.parse(localStorage.getItem(seenFilesKey) || '[]'))
    
    fileIds.forEach(id => seenFiles.add(id))
    
    localStorage.setItem(seenFilesKey, JSON.stringify([...seenFiles]))
    
    // Remove from newly uploaded files state
    setNewlyUploadedFiles(prev => {
      const updated = new Set(prev)
      fileIds.forEach(id => updated.delete(id))
      return updated
    })
  }

  // Clean up old seen files from localStorage
  const cleanupSeenFiles = () => {
    if (!user?.id || !filesData?.files) return
    
    const seenFilesKey = `nexusdrop_seen_files_${user.id}`
    const seenFiles = new Set(JSON.parse(localStorage.getItem(seenFilesKey) || '[]') as string[])
    const currentFileIds = new Set(filesData.files.map(f => f.id))
    
    // Remove seen files that no longer exist
    const validSeenFiles = [...seenFiles].filter(id => currentFileIds.has(id))
    
    localStorage.setItem(seenFilesKey, JSON.stringify(validSeenFiles))
  }

  // Mark all visible files as seen
  const markAllAsSeen = () => {
    if (!filesData?.files) return
    markFilesAsSeen(filesData.files.map(f => f.id))
  }

  const files = filesData?.files || []
  const storagePercentage = user ? (user.storage_used_bytes / user.storage_quota_bytes) * 100 : 0
  const selectedCollection = collectionsData?.collections?.find(c => c.id === selectedCollectionId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {selectedCollectionId ? (selectedCollection?.name || 'collection') : 'all files'}
          </h1>
          <p className="text-muted-foreground">
            {selectedCollectionId 
              ? `files in "${selectedCollection?.name || 'collection'}" collection`
              : 'manage your uploads and shared files'
            }
          </p>
        </div>
        {newlyUploadedFiles.size > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={markAllAsSeen}
            className="text-xs"
          >
            mark all as seen ({newlyUploadedFiles.size})
          </Button>
        )}
      </div>



      {/* Filters and View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          {files.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedFiles.size === files.length && files.length > 0}
                onCheckedChange={handleSelectAll}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-sm text-muted-foreground">
                select all ({files.length})
              </span>
            </div>
          )}
          {user && (
            <div className="flex items-center space-x-3">
              <File className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {formatBytes(user.storage_used_bytes)} / {formatBytes(user.storage_quota_bytes)}
                </span>
                <Progress value={storagePercentage} className="w-24" />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">recent</SelectItem>
              <SelectItem value="original_filename">name</SelectItem>
              <SelectItem value="size_bytes">size</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList>
              <TabsTrigger value="grid">
                <Grid3X3 className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Separator />

      {/* Bulk Actions Bar */}
      {selectedFiles.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg"
        >
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">
              {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFiles(new Set())}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4 mr-1" />
              clear
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            {!selectedCollectionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkMoveToCollectionOpen(true)}
              >
                <FolderPlus className="w-4 h-4 mr-1" />
                move to collection
              </Button>
            )}
            {selectedCollectionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkRemoveFromCollectionOpen(true)}
              >
                <FolderMinus className="w-4 h-4 mr-1" />
                remove from collection
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash className="w-4 h-4 mr-1" />
              delete
            </Button>
          </div>
        </motion.div>
      )}

      {/* Files Display */}
      {isFetching && !isLoading && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4"
        >
          <div className="flex items-center space-x-2 text-sm text-primary bg-primary/5 px-3 py-2 rounded-lg border border-primary/10">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>refreshing files...</span>
          </div>
        </motion.div>
      )}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-32 bg-muted rounded mb-4" />
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <File className="w-10 h-10 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">no files found</p>
            <p className="text-sm text-muted-foreground text-center">
              upload your first file to get started
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence>
            {files.map((file, index) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={newlyUploadedFiles.has(file.id) ? {
                  opacity: 1, 
                  scale: [1, 1.02, 1], 
                  y: 0,
                  transition: {
                    opacity: { duration: 0.3, delay: index * 0.05 },
                    scale: { duration: 0.6, repeat: 2, repeatType: "reverse" },
                    y: { duration: 0.3, delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }
                  }
                } : { 
                  opacity: 1, 
                  scale: 1, 
                  y: 0 
                }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ 
                  duration: 0.3,
                  delay: index * 0.05, // Stagger animation for new files
                  type: "spring",
                  stiffness: 300,
                  damping: 25
                }}
              >
                <ContextMenu>
                  <ContextMenuTrigger>
                    <Card 
                      className={`hover:shadow-md transition-all relative ${
                        newlyUploadedFiles.has(file.id) 
                          ? 'ring-2 ring-primary/50 bg-primary/5 shadow-lg' 
                          : ''
                      }`}
                    >
                      <div className="absolute top-2 left-2 z-10">
                        <Checkbox
                          checked={selectedFiles.has(file.id)}
                          onCheckedChange={() => handleSelectFile(file.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div onClick={() => markFilesAsSeen([file.id])} className="cursor-pointer">
                      <CardContent className="p-4">
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                          {getFileType(file.mime_type) === 'image' ? (
                            <img 
                              src={getFileUrl(file.id, `.${file.original_filename.split('.').pop()}`)}
                              alt={file.original_filename}
                              className="w-full h-full object-cover rounded-lg"
                              loading="lazy"
                            />
                          ) : (
                            getFileIcon(file.mime_type)
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="font-medium truncate" title={file.original_filename}>
                            {file.original_filename}
                          </p>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{formatBytes(file.size_bytes)}</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => copyFileLink(file)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  copy link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePreviewFile(file)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  preview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewFile(file)}>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  view
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  download
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleShowFileInfo(file)}>
                                  <Info className="mr-2 h-4 w-4" />
                                  details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleRenameFile(file)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleMoveToCollection(file)}>
                                  <FolderPlus className="mr-2 h-4 w-4" />
                                  move to collection
                                </DropdownMenuItem>
                                {selectedCollectionId && (
                                  <DropdownMenuItem onClick={() => handleRemoveFromCollection(file)}>
                                    <FolderMinus className="mr-2 h-4 w-4" />
                                    remove from collection
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteFile(file)}
                                  className="text-destructive"
                                >
                                  <Trash className="mr-2 h-4 w-4" />
                                  delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="text-xs">
                              {getFileType(file.mime_type)}
                            </Badge>
                            {newlyUploadedFiles.has(file.id) && (
                              <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">
                                new
                              </Badge>
                            )}
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Eye className="w-3 h-3 mr-1" />
                              {file.view_count}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                    </Card>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => copyFileLink(file)}>
                      <Copy className="mr-2 h-4 w-4" />
                      copy link
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handlePreviewFile(file)}>
                      <Eye className="mr-2 h-4 w-4" />
                      preview
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleViewFile(file)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      view
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleDownloadFile(file)}>
                      <Download className="mr-2 h-4 w-4" />
                      download
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleShowFileInfo(file)}>
                      <Info className="mr-2 h-4 w-4" />
                      details
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleRenameFile(file)}>
                      <Edit className="mr-2 h-4 w-4" />
                      rename
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleMoveToCollection(file)}>
                      <FolderPlus className="mr-2 h-4 w-4" />
                      move to collection
                    </ContextMenuItem>
                    {selectedCollectionId && (
                      <ContextMenuItem onClick={() => handleRemoveFromCollection(file)}>
                        <FolderMinus className="mr-2 h-4 w-4" />
                        remove from collection
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem 
                      onClick={() => handleDeleteFile(file)}
                      className="text-destructive"
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {files.map((file) => (
                <ContextMenu key={file.id}>
                  <ContextMenuTrigger>
                    <div 
                      className={`flex items-center p-4 hover:bg-muted/50 transition-all ${
                        newlyUploadedFiles.has(file.id) 
                          ? 'bg-primary/5 border-l-4 border-l-primary' 
                          : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Checkbox
                          checked={selectedFiles.has(file.id)}
                          onCheckedChange={() => handleSelectFile(file.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div 
                          className="flex items-center flex-1 min-w-0 cursor-pointer"
                          onClick={() => markFilesAsSeen([file.id])}
                        >
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center mr-3 overflow-hidden">
                            {getFileType(file.mime_type) === 'image' ? (
                              <img 
                                src={getFileUrl(file.id, `.${file.original_filename.split('.').pop()}`)}
                                alt={file.original_filename}
                                className="w-full h-full object-cover rounded"
                                loading="lazy"
                              />
                            ) : (
                              getFileIcon(file.mime_type)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.original_filename}</p>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>{formatBytes(file.size_bytes)}</span>
                              <span>{formatDate(file.created_at)}</span>
                              <div className="flex items-center">
                                <Eye className="w-3 h-3 mr-1" />
                                {file.view_count}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 mr-4">
                            <Badge variant="secondary">
                              {getFileType(file.mime_type)}
                            </Badge>
                            {newlyUploadedFiles.has(file.id) && (
                              <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">
                                new
                              </Badge>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => copyFileLink(file)}>
                                <Copy className="mr-2 h-4 w-4" />
                                copy link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePreviewFile(file)}>
                                <Eye className="mr-2 h-4 w-4" />
                                preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewFile(file)}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                view
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                                <Download className="mr-2 h-4 w-4" />
                                download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleShowFileInfo(file)}>
                                <Info className="mr-2 h-4 w-4" />
                                details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRenameFile(file)}>
                                <Edit className="mr-2 h-4 w-4" />
                                rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMoveToCollection(file)}>
                                <FolderPlus className="mr-2 h-4 w-4" />
                                move to collection
                              </DropdownMenuItem>
                              {selectedCollectionId && (
                                <DropdownMenuItem onClick={() => handleRemoveFromCollection(file)}>
                                  <FolderMinus className="mr-2 h-4 w-4" />
                                  remove from collection
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDeleteFile(file)}
                                className="text-destructive"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => copyFileLink(file)}>
                      <Copy className="mr-2 h-4 w-4" />
                      copy link
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handlePreviewFile(file)}>
                      <Eye className="mr-2 h-4 w-4" />
                      preview
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleViewFile(file)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      view
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleDownloadFile(file)}>
                      <Download className="mr-2 h-4 w-4" />
                      download
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleShowFileInfo(file)}>
                      <Info className="mr-2 h-4 w-4" />
                      details
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleRenameFile(file)}>
                      <Edit className="mr-2 h-4 w-4" />
                      rename
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleMoveToCollection(file)}>
                      <FolderPlus className="mr-2 h-4 w-4" />
                      move to collection
                    </ContextMenuItem>
                    {selectedCollectionId && (
                      <ContextMenuItem onClick={() => handleRemoveFromCollection(file)}>
                        <FolderMinus className="mr-2 h-4 w-4" />
                        remove from collection
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem 
                      onClick={() => handleDeleteFile(file)}
                      className="text-destructive"
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete file</AlertDialogTitle>
            <AlertDialogDescription>
              are you sure you want to delete "{fileToDelete?.original_filename}"? 
              this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Info Panel */}
      <FileInfoPanel
        file={selectedFile}
        open={infoPanelOpen}
        onOpenChange={setInfoPanelOpen}
        onFileUpdate={() => queryClient.invalidateQueries({ queryKey: ['files'] })}
      />

      {/* Rename File Dialog */}
      <RenameFileDialog
        file={fileToRename}
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onFileRenamed={() => queryClient.invalidateQueries({ queryKey: ['files'] })}
      />

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete files</AlertDialogTitle>
            <AlertDialogDescription>
              are you sure you want to delete {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}? 
              this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive hover:bg-destructive/90">
              delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Move to Collection Dialog */}
      <Dialog open={bulkMoveToCollectionOpen} onOpenChange={setBulkMoveToCollectionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>move to collection</DialogTitle>
            <DialogDescription>
              select a collection to move {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {collectionsData?.collections.map((collection) => (
              <Button
                key={collection.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => confirmBulkMoveToCollection(collection.id)}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                {collection.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveToCollectionOpen(false)}>
              cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Remove from Collection Dialog */}
      <AlertDialog open={bulkRemoveFromCollectionOpen} onOpenChange={setBulkRemoveFromCollectionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>remove from collection</AlertDialogTitle>
            <AlertDialogDescription>
              are you sure you want to remove {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} from this collection?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkRemoveFromCollection}>
              remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to Collection Dialog */}
      <Dialog open={moveToCollectionOpen} onOpenChange={setMoveToCollectionOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="move-dialog-description">
          <DialogHeader>
            <DialogTitle>move to collection</DialogTitle>
            <DialogDescription id="move-dialog-description">
              select a collection to move "{fileToMove?.original_filename}" to
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {collectionsData?.collections.map((collection) => (
              <Button
                key={collection.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => moveFileToCollection(collection.id)}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                {collection.name}
                <Badge variant="secondary" className="ml-auto">
                  {(collection as any).file_count || 0}
                </Badge>
              </Button>
            ))}
            {(!collectionsData?.collections || collectionsData.collections.length === 0) && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  no collections available. create a collection first.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setMoveToCollectionOpen(false)}
            >
              cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove from Collection Confirmation Dialog */}
      <AlertDialog open={removeFromCollectionDialogOpen} onOpenChange={setRemoveFromCollectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>remove from collection</AlertDialogTitle>
            <AlertDialogDescription>
              are you sure you want to remove "{fileToRemoveFromCollection?.original_filename}" from this collection? 
              the file will still exist in "all files" but will no longer be in "{selectedCollection?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveFromCollection}>
              remove from collection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 