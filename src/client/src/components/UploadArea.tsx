import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from '@/store/auth'
import { useCollection } from '@/contexts/CollectionContext'
import { useTheme } from '@/contexts/ThemeContext'

interface UploadAreaProps {
  variant?: 'full' | 'compact'
  className?: string
}

export function UploadArea({ variant = 'full', className }: UploadAreaProps) {
  const { user } = useAuthStore()
  const { selectedCollectionId } = useCollection()
  const { toast } = useToast()
  const { gradients } = useTheme()
  const queryClient = useQueryClient()

  const [isUploading, setIsUploading] = useState(false)
  
  // Get collections for showing which collection is selected
  const { data: collectionsData } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { collectionsApi } = await import('@/lib/api')
      return collectionsApi.getMyCollections()
    },
    staleTime: 60000, // Collections don't change often
  })
  const selectedCollection = collectionsData?.collections?.find(c => c.id === selectedCollectionId)

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const results = []
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        
        // Include collection_id if a collection is selected
        if (selectedCollectionId) {
          formData.append('collection_id', selectedCollectionId)
        }

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(error || `HTTP ${response.status}`)
        }
        
        results.push(await response.json())
      }
      return results
    },
    onSuccess: (results) => {
      toast({
        title: "upload complete",
        description: `${results.length} file(s) uploaded successfully`,
      })
      
      // Immediately invalidate all file-related queries to refresh the display
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      
      // Force refetch the current files query to show new files immediately
      queryClient.refetchQueries({ 
        queryKey: ['files', 'me', { collection: selectedCollectionId }],
        exact: false 
      })
      
      // Add a brief success animation
      const uploadArea = document.querySelector('[data-upload-area]')
      if (uploadArea) {
        uploadArea.classList.add('animate-pulse', 'bg-green-50', 'border-green-200')
        setTimeout(() => {
          uploadArea.classList.remove('animate-pulse', 'bg-green-50', 'border-green-200')
        }, 1000)
      }
    },
    onError: (error: any) => {
      toast({
        title: "upload failed",
        description: error.message || "failed to upload files",
        variant: "destructive",
      })
    },
    onSettled: () => {
      setIsUploading(false)
    }
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      toast({
        title: "authentication required",
        description: "please log in to upload files",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    toast({
      title: "upload started",
      description: `uploading ${acceptedFiles.length} file(s)...`,
    })

    uploadMutation.mutate(acceptedFiles)
  }, [user, toast, uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 250 * 1024 * 1024, // 250MB
    disabled: isUploading,
  })

  if (variant === 'compact') {
    return (
      <Card 
        {...getRootProps()} 
        data-upload-area
        className={`relative overflow-hidden border-dashed border-2 cursor-pointer transition-all duration-300 ${
          isDragActive 
            ? 'border-purple-500 bg-gradient-to-br from-purple-500/10 via-purple-400/5 to-transparent shadow-lg shadow-purple-500/20' 
            : 'border-muted-foreground/25 hover:border-purple-400/50 hover:bg-gradient-to-br hover:from-purple-500/5 hover:to-transparent'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`absolute inset-0 bg-gradient-to-r ${gradients.accent} pointer-events-none`}
          />
        )}
        <CardContent className="flex flex-col items-center justify-center py-4">
          <Upload className={`w-6 h-6 mb-2 ${isDragActive ? 'text-purple-500' : 'text-muted-foreground'} ${isUploading ? 'animate-pulse' : ''}`} />
          <p className="text-sm font-medium mb-1">
            {isUploading ? 'uploading...' : isDragActive ? 'drop files here' : 'drag & drop files'}
          </p>
          <p className="text-xs text-muted-foreground mb-1">
            {isUploading ? 'please wait' : 'or click to select'}
          </p>
          {selectedCollectionId ? (
            <p className="text-xs text-primary mb-2 text-center">
              → {selectedCollection?.name || 'collection'}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-2 text-center">
              → all files
            </p>
          )}
          <Button variant="secondary" size="sm" className="text-xs h-6" disabled={isUploading}>
            {isUploading ? 'uploading...' : 'select files'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <Card 
        {...getRootProps()} 
        data-upload-area
        className={`relative overflow-hidden border-dashed border-2 cursor-pointer transition-all duration-300 ${
          isDragActive 
            ? 'border-purple-500 bg-gradient-to-br from-purple-500/10 via-purple-400/5 to-transparent shadow-xl shadow-purple-500/20' 
            : 'border-muted-foreground/25 hover:border-purple-400/50 hover:bg-gradient-to-br hover:from-purple-500/5 hover:to-transparent'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`absolute inset-0 bg-gradient-to-r ${gradients.accent} pointer-events-none`}
          />
        )}
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Upload className={`w-10 h-10 mb-4 ${isDragActive ? 'text-purple-500' : 'text-muted-foreground'} ${isUploading ? 'animate-pulse' : ''}`} />
          <p className="text-lg font-medium mb-2">
            {isUploading ? 'uploading files...' : isDragActive ? 'drop files here' : 'drag & drop files to upload'}
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            {isUploading ? 'please wait while files are being uploaded' : 'or click to select files (max 250mb each)'}
          </p>
          {selectedCollectionId ? (
            <p className="text-xs text-primary mb-4 flex items-center justify-center">
              <span className="bg-primary/10 px-2 py-1 rounded-full">
                uploading to: {selectedCollection?.name || 'collection'}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-4">
              uploading to: all files
            </p>
          )}
          <Button variant="secondary" disabled={isUploading}>
            {isUploading ? 'uploading...' : 'select files'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
} 