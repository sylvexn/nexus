import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminDataTable } from '@/components/admin/AdminDataTable'
import { adminApi, type AdminFile } from '@/lib/adminApi'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Edit, ExternalLink, Eye, Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatBytes, formatNumber } from '@/lib/utils'

export default function AdminFiles() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editDialogOpen, setEditDialogOpen] = useState<AdminFile | null>(null)
  const [newExpiryDate, setNewExpiryDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'files', page, search],
    queryFn: () => adminApi.getFiles({ page, limit: 20, search }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ fileId, expires_at }: { fileId: string; expires_at: string }) => 
      adminApi.updateFile(fileId, expires_at),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'files'] })
      setEditDialogOpen(null)
      toast({
        title: "file updated",
        description: "file updated successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "error",
        description: `failed to update file: ${error.message}`,
        variant: "destructive",
      })
    },
  })

  const openEditDialog = (file: AdminFile) => {
    const currentExpiry = new Date(file.expires_at)
    setNewExpiryDate(currentExpiry.toISOString().split('T')[0])
    setEditDialogOpen(file)
  }

  const handleSave = () => {
    if (!editDialogOpen || !newExpiryDate) return
    
    const expires_at = new Date(newExpiryDate + 'T23:59:59Z').toISOString()
    updateMutation.mutate({
      fileId: editDialogOpen.id,
      expires_at
    })
  }

  const getFileTypeIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎥'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('text')) return '📝'
    return '📁'
  }

  const getFileTypeColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'bg-blue-100 text-blue-800'
    if (mimeType.startsWith('video/')) return 'bg-purple-100 text-purple-800'
    if (mimeType.startsWith('audio/')) return 'bg-green-100 text-green-800'
    if (mimeType.includes('pdf')) return 'bg-red-100 text-red-800'
    if (mimeType.includes('text')) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getExpiryStatus = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { label: 'expired', variant: 'destructive' as const }
    } else if (diffDays <= 7) {
      return { label: `${diffDays}d left`, variant: 'secondary' as const }
    } else {
      return { label: `${diffDays}d left`, variant: 'outline' as const }
    }
  }

  const columns = [
    {
      key: 'original_filename',
      title: 'file',
      render: (value: string, row: AdminFile) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-lg">{getFileTypeIcon(row.mime_type)}</div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{value}</div>
            <div className="text-xs text-muted-foreground">
              id: {row.id}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'mime_type',
      title: 'type',
      render: (value: string) => (
        <Badge className={getFileTypeColor(value)}>
          {value.split('/')[0]}
        </Badge>
      ),
    },
    {
      key: 'owner_username',
      title: 'owner',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">
            {value?.charAt(0).toUpperCase()}
          </div>
          {value}
        </div>
      ),
    },
    {
      key: 'size_bytes',
      title: 'size',
      render: (value: number) => formatBytes(value),
    },
    {
      key: 'view_count',
      title: 'stats',
      render: (value: number, row: AdminFile) => (
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatNumber(value)}
          </div>
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {formatNumber(row.download_count)}
          </div>
        </div>
      ),
    },
    {
      key: 'expires_at',
      title: 'expires',
      render: (value: string) => {
        const status = getExpiryStatus(value)
        return <Badge variant={status.variant}>{status.label}</Badge>
      },
    },
    {
      key: 'created_at',
      title: 'uploaded',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      title: '',
      render: (_: any, row: AdminFile) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/f/${row.id}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditDialog(row)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const files = data?.files || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">file management</h1>
        <p className="text-muted-foreground">manage files across all users</p>
      </div>

      <AdminDataTable
        title="files"
        data={files}
        columns={columns}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        searchValue={search}
      />

      <Dialog open={!!editDialogOpen} onOpenChange={() => setEditDialogOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>edit file</DialogTitle>
            <DialogDescription>
              modify file settings for {editDialogOpen?.original_filename}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>file details</Label>
              <div className="text-sm space-y-1 p-3 bg-muted rounded">
                <div><span className="font-medium">filename:</span> {editDialogOpen?.original_filename}</div>
                <div><span className="font-medium">size:</span> {formatBytes(editDialogOpen?.size_bytes || 0)}</div>
                <div><span className="font-medium">type:</span> {editDialogOpen?.mime_type}</div>
                <div><span className="font-medium">owner:</span> {editDialogOpen?.owner_username}</div>
              </div>
            </div>

            <div>
              <Label htmlFor="expiry">expiry date</Label>
              <Input
                id="expiry"
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(null)}>
                cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updateMutation.isPending || !newExpiryDate}
              >
                {updateMutation.isPending ? 'saving...' : 'save changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 