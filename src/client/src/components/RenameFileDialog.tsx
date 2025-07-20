import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

import { filesApi } from '@/lib/api'
import { getShareableFileUrl } from '@/lib/config'
import type { File as FileType } from '@/types'

interface RenameFileDialogProps {
  file: FileType | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileRenamed?: () => void
}

export default function RenameFileDialog({ 
  file, 
  open, 
  onOpenChange, 
  onFileRenamed 
}: RenameFileDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [newId, setNewId] = useState('')
  const [error, setError] = useState('')

  const renameMutation = useMutation({
    mutationFn: ({ id, new_id }: { id: string; new_id: string }) => 
      filesApi.renameFile(id, new_id),
    onSuccess: () => {
      toast({
        title: "file renamed",
        description: `file has been renamed successfully`,
      })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      onFileRenamed?.()
      onOpenChange(false)
      setNewId('')
      setError('')
    },
    onError: (error: any) => {
      const message = error.message || "failed to rename file"
      if (message.includes('ID_EXISTS')) {
        setError('a file with this name already exists')
      } else if (message.includes('INVALID_ID')) {
        setError('file name can only contain letters, numbers, hyphens, and underscores')
      } else {
        setError(message)
      }
    },
  })

  useEffect(() => {
    if (file && open) {
      setNewId(file.id)
      setError('')
    }
  }, [file, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !newId.trim()) return

    const trimmedId = newId.trim()
    
    if (trimmedId === file.id) {
      onOpenChange(false)
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedId)) {
      setError('file name can only contain letters, numbers, hyphens, and underscores')
      return
    }

    setError('')
    renameMutation.mutate({ id: file.id, new_id: trimmedId })
  }


  const currentUrl = file ? getShareableFileUrl(file.id) : ''
  const previewUrl = newId.trim() ? getShareableFileUrl(newId.trim()) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="rename-dialog-description">
        <DialogHeader>
          <DialogTitle>rename file</DialogTitle>
          <DialogDescription id="rename-dialog-description">
            change the url slug for this file. the previous link will no longer work.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newId">new file name</Label>
            <Input
              id="newId"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="enter new file name"
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {file && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">current url:</span>
                <p className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                  {currentUrl}
                </p>
              </div>
              {newId.trim() && newId.trim() !== file.id && (
                <div>
                  <span className="text-muted-foreground">new url:</span>
                  <p className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                    {previewUrl}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              cancel
            </Button>
            <Button 
              type="submit" 
              disabled={renameMutation.isPending || !newId.trim() || newId.trim() === file?.id}
            >
              {renameMutation.isPending ? 'renaming...' : 'rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 