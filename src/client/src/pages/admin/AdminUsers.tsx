import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminDataTable } from '@/components/admin/AdminDataTable'
import { adminApi, type AdminUser } from '@/lib/adminApi'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Edit, Shield, User, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatBytes } from '@/lib/utils'

export default function AdminUsers() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editDialogOpen, setEditDialogOpen] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState({
    default_expiry_days: 30,
    storage_quota_bytes: 21474836480,
    role: 'user' as 'user' | 'admin'
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () => adminApi.getUsers({ page, limit: 20, search }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: typeof editForm }) => 
      adminApi.updateUser(userId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setEditDialogOpen(null)
      toast({
        title: "user updated",
        description: "user updated successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "error",
        description: `failed to update user: ${error.message}`,
        variant: "destructive",
      })
    },
  })

  const openEditDialog = (user: AdminUser) => {
    setEditForm({
      default_expiry_days: user.default_expiry_days,
      storage_quota_bytes: user.storage_quota_bytes,
      role: user.role
    })
    setEditDialogOpen(user)
  }

  const handleSave = () => {
    if (!editDialogOpen) return
    updateMutation.mutate({
      userId: editDialogOpen.id,
      updates: editForm
    })
  }

  const columns = [
    {
      key: 'username',
      title: 'username',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            {value.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: 'role',
      title: 'role',
      render: (value: string) => (
        <Badge variant={value === 'admin' ? 'destructive' : 'secondary'}>
          <div className="flex items-center gap-1">
            {value === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {value}
          </div>
        </Badge>
      ),
    },
    {
      key: 'file_count',
      title: 'files',
      render: (value: number) => value || 0,
    },
    {
      key: 'storage_used_bytes',
      title: 'storage used',
      render: (value: number, row: AdminUser) => (
        <div className="space-y-1">
          <div className="text-sm">{formatBytes(value)}</div>
          <div className="text-xs text-muted-foreground">
            {((value / row.storage_quota_bytes) * 100).toFixed(1)}% of {formatBytes(row.storage_quota_bytes)}
          </div>
        </div>
      ),
    },
    {
      key: 'default_expiry_days',
      title: 'default expiry',
      render: (value: number) => `${value} days`,
    },
    {
      key: 'created_at',
      title: 'joined',
      render: (value: string) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(value).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'actions',
      title: '',
      render: (_: any, row: AdminUser) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openEditDialog(row)}
        >
          <Edit className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const users = data?.users || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">user management</h1>
        <p className="text-muted-foreground">manage user accounts and permissions</p>
      </div>

      <AdminDataTable
        title="users"
        data={users}
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
            <DialogTitle>edit user</DialogTitle>
            <DialogDescription>
              modify user settings and permissions for {editDialogOpen?.username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="role">role</Label>
              <Select 
                value={editForm.role} 
                onValueChange={(value: 'user' | 'admin') => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expiry">default file expiry (days)</Label>
              <Input
                id="expiry"
                type="number"
                min="1"
                max="365"
                value={editForm.default_expiry_days}
                onChange={(e) => setEditForm({ 
                  ...editForm, 
                  default_expiry_days: parseInt(e.target.value) || 30 
                })}
              />
            </div>

            <div>
              <Label htmlFor="quota">storage quota (GB)</Label>
              <Input
                id="quota"
                type="number"
                min="1"
                max="1000"
                value={Math.round(editForm.storage_quota_bytes / (1024 * 1024 * 1024))}
                onChange={(e) => setEditForm({ 
                  ...editForm, 
                  storage_quota_bytes: (parseInt(e.target.value) || 20) * 1024 * 1024 * 1024
                })}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(null)}>
                cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updateMutation.isPending}
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