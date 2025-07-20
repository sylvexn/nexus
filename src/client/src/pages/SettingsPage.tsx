import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { 
  User, 
  Key, 
  HardDrive, 
  Copy, 
  Plus, 
  Trash, 
  Eye, 
  EyeOff,

  Calendar,
  Activity,
  Clock
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"

import { useAuthStore } from '@/store/auth'
import { apiKeysApi } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'
import { ApiKey, CreateApiKeyRequest } from '@/types'

const createApiKeySchema = z.object({
  label: z.string().min(1, 'Label is required').max(50, 'Label too long'),
})

type CreateApiKeyForm = z.infer<typeof createApiKeySchema>

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [showNewKey, setShowNewKey] = useState(false)

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: apiKeysApi.getMyApiKeys,
  })

  const createApiKeyForm = useForm<CreateApiKeyForm>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      label: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateApiKeyRequest) => apiKeysApi.createApiKey(data),
    onSuccess: (response) => {
      setNewApiKey(response.key)
      setCreateDialogOpen(false)
      createApiKeyForm.reset()
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      toast({
        title: "api key created",
        description: "your new api key has been generated",
      })
    },
    onError: (error: any) => {
      toast({
        title: "error",
        description: error.message || "failed to create api key",
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      setDeleteDialogOpen(false)
      setKeyToDelete(null)
      toast({
        title: "api key deleted",
        description: "the api key has been removed",
      })
    },
    onError: (error: any) => {
      toast({
        title: "error",
        description: error.message || "failed to delete api key",
        variant: "destructive",
      })
    },
  })

  const handleCreateApiKey = (data: CreateApiKeyForm) => {
    createMutation.mutate(data)
  }

  const handleDeleteApiKey = (apiKey: ApiKey) => {
    setKeyToDelete(apiKey)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!keyToDelete) return
    deleteMutation.mutate(keyToDelete.id)
  }

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "copied to clipboard",
      description,
    })
  }

  const storagePercentage = user ? (user.storage_used_bytes / user.storage_quota_bytes) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">settings</h1>
        <p className="text-muted-foreground">
          manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList>
          <TabsTrigger value="account">account</TabsTrigger>
          <TabsTrigger value="api-keys">api keys</TabsTrigger>
          <TabsTrigger value="storage">storage</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>profile</span>
                </CardTitle>
                <CardDescription>
                  view and manage your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {user && (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                                      <Label>username</Label>
              <div className="mt-1 text-sm font-medium">{user.username}</div>
                      </div>
                      <div>
                        <Label>role</Label>
                        <div className="mt-1">
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label>member since</Label>
                        <div className="mt-1 text-sm font-medium">
                          {formatDate(user.created_at)}
                        </div>
                      </div>
                      <div>
                        <Label>default expiry</Label>
                        <div className="mt-1 text-sm font-medium">
                          {user.default_expiry_days} days
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Key className="w-5 h-5" />
                      <span>api keys</span>
                    </CardTitle>
                    <CardDescription>
                      manage api keys for uploading files
                    </CardDescription>
                  </div>
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        create api key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>create new api key</DialogTitle>
                        <DialogDescription>
                          give your api key a descriptive label to help you identify it later
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...createApiKeyForm}>
                        <form onSubmit={createApiKeyForm.handleSubmit(handleCreateApiKey)}>
                          <div className="space-y-4">
                            <FormField
                              control={createApiKeyForm.control}
                              name="label"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>label</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g., ShareX, Personal Laptop"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    a friendly name to identify this api key
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <DialogFooter className="mt-6">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCreateDialogOpen(false)}
                            >
                              cancel
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                              {createMutation.isPending ? 'creating...' : 'create api key'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : apiKeys?.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">no api keys</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      create your first api key to start uploading files
                    </p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      create api key
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiKeys?.map((apiKey) => (
                      <motion.div
                        key={apiKey.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-medium">{apiKey.label}</h3>
                                  <Badge variant="outline" className="text-xs">
                                    {apiKey.key_prefix}...
                                  </Badge>
                                </div>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                  <div className="flex items-center">
                                    <Activity className="w-3 h-3 mr-1" />
                                    {apiKey.total_uploads} uploads
                                  </div>
                                  <div className="flex items-center">
                                    <HardDrive className="w-3 h-3 mr-1" />
                                    {formatBytes(apiKey.total_bytes_uploaded)}
                                  </div>
                                  <div className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    created {formatDate(apiKey.created_at)}
                                  </div>
                                  {apiKey.last_used_at && (
                                    <div className="flex items-center">
                                      <Clock className="w-3 h-3 mr-1" />
                                      last used {formatDate(apiKey.last_used_at)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteApiKey(apiKey)}
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <HardDrive className="w-5 h-5" />
                  <span>storage usage</span>
                </CardTitle>
                <CardDescription>
                  monitor your storage quota and usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>used storage</span>
                        <span className="font-medium">
                          {formatBytes(user.storage_used_bytes)} / {formatBytes(user.storage_quota_bytes)}
                        </span>
                      </div>
                      <Progress value={storagePercentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {(100 - storagePercentage).toFixed(1)}% remaining
                      </p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {formatBytes(user.storage_used_bytes)}
                        </div>
                        <p className="text-sm text-muted-foreground">used</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {formatBytes(user.storage_quota_bytes - user.storage_used_bytes)}
                        </div>
                        <p className="text-sm text-muted-foreground">available</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold">
                          {formatBytes(user.storage_quota_bytes)}
                        </div>
                        <p className="text-sm text-muted-foreground">total</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* New API Key Display Dialog */}
      <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>api key created</DialogTitle>
            <DialogDescription>
              copy your api key now. for security reasons, it won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Input value={newApiKey || ''} readOnly type={showNewKey ? 'text' : 'password'} />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNewKey(!showNewKey)}
              >
                {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(newApiKey || '', 'api key copied to clipboard')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewApiKey(null)}>
              done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete API Key Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete api key</AlertDialogTitle>
            <AlertDialogDescription>
              are you sure you want to delete the api key "{keyToDelete?.label}"? 
              this action cannot be undone and any applications using this key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'deleting...' : 'delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 