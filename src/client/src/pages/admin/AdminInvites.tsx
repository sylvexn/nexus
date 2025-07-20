import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminDataTable } from '@/components/admin/AdminDataTable'
import { adminApi, type AdminInvite } from '@/lib/adminApi'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Copy, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function AdminInvites() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin'>('user')
  const [revokeDialogOpen, setRevokeDialogOpen] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'invites', page],
    queryFn: () => adminApi.getInvites({ page, limit: 20 }),
  })

  const createMutation = useMutation({
    mutationFn: (role: 'user' | 'admin') => adminApi.createInvite(role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      setCreateDialogOpen(false)
      toast({
        title: "invite created",
        description: "invite code created successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "error",
        description: `failed to create invite: ${error.message}`,
        variant: "destructive",
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => adminApi.revokeInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      setRevokeDialogOpen(null)
      toast({
        title: "invite revoked",
        description: "invite code revoked successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "error",
        description: `failed to revoke invite: ${error.message}`,
        variant: "destructive",
      })
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "copied",
      description: "invite code copied to clipboard",
    })
  }

  const columns = [
    {
      key: 'id',
      title: 'invite code',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
            {value}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(value)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    {
      key: 'role_to_grant',
      title: 'role',
      render: (value: string) => (
        <Badge variant={value === 'admin' ? 'destructive' : 'secondary'}>
          {value}
        </Badge>
      ),
    },
    {
      key: 'created_by_username',
      title: 'created by',
      render: (value: string) => value || 'system',
    },
    {
      key: 'used_by_username',
      title: 'status',
      render: (value: string) => {
        if (value) {
          return (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">used by {value}</span>
            </div>
          )
        }
        return <Badge variant="outline">unused</Badge>
      },
    },
    {
      key: 'created_at',
      title: 'created',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      title: '',
      render: (_: any, row: AdminInvite) => {
        if (row.used_by_id) {
          return null
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevokeDialogOpen(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )
      },
    },
  ]

  const invites = data?.invites || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">invite management</h1>
        <p className="text-muted-foreground">manage user registration invites</p>
      </div>

      <AdminDataTable
        title="invite codes"
        data={invites}
        columns={columns}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            create invite
          </Button>
        }
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>create invite code</DialogTitle>
            <DialogDescription>
              generate a new invite code for user registration
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">role to grant</label>
              <Select value={selectedRole} onValueChange={(value: 'user' | 'admin') => setSelectedRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                cancel
              </Button>
              <Button 
                onClick={() => createMutation.mutate(selectedRole)}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'creating...' : 'create invite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeDialogOpen} onOpenChange={() => setRevokeDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>revoke invite code</AlertDialogTitle>
            <AlertDialogDescription>
              are you sure you want to revoke this invite code? this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeDialogOpen && revokeMutation.mutate(revokeDialogOpen)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? 'revoking...' : 'revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 