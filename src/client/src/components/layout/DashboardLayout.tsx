import { Outlet, Link } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Files, 
  Settings, 
  Search,
  LogOut,
  Folder,
  FolderOpen,
  Plus,
  Trash,
  MoreVertical,
  Shield
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from '@/store/auth'
import { authApi, collectionsApi } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatBytes } from '@/lib/utils'
import { AdvancedSearch } from '@/components/AdvancedSearch'
import { useCollection } from '@/contexts/CollectionContext'
import type { Collection } from '@/types'
import { UploadArea } from '@/components/UploadArea'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const navigation = [
  { name: 'files', href: '/', icon: Files },
  { name: 'settings', href: '/settings', icon: Settings },
]

export default function DashboardLayout() {
  const { user, logout } = useAuthStore()
  const { selectedCollectionId, setSelectedCollectionId } = useCollection()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')

  const { data: collectionsData, isLoading: collectionsLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: collectionsApi.getMyCollections,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => collectionsApi.createCollection(data),
    onSuccess: () => {
      toast({
        title: "collection created",
        description: "new collection has been created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setCreateDialogOpen(false)
      setNewCollectionName('')
    },
    onError: (error: any) => {
      toast({
        title: "error",
        description: error.message || "failed to create collection",
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collectionsApi.deleteCollection(id),
    onSuccess: () => {
      toast({
        title: "collection deleted",
        description: "collection has been deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setDeleteDialogOpen(false)
      setCollectionToDelete(null)
      if (selectedCollectionId === collectionToDelete?.id) {
        setSelectedCollectionId(null)
      }
    },
    onError: (error: any) => {
      toast({
        title: "error",
        description: error.message || "failed to delete collection",
        variant: "destructive",
      })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      logout()
      navigate('/login')
    },
  })

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCollectionName.trim()) return
    createMutation.mutate({ name: newCollectionName.trim() })
  }



  const confirmDelete = () => {
    if (collectionToDelete) {
      deleteMutation.mutate(collectionToDelete.id)
    }
  }

  const getInitials = (identifier: string | undefined) => {
    if (!identifier) return 'U'
    
    // If it's an email, use the part before @
    if (identifier.includes('@')) {
      return identifier.split('@')[0].slice(0, 2).toUpperCase()
    }
    
    // Otherwise use first 2 characters
    return identifier.slice(0, 2).toUpperCase()
  }

  const collections = collectionsData?.collections || []

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r">
          <SidebarHeader className="border-b">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 px-2 py-2"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Files className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">nexusdrop</span>
            </motion.div>
          </SidebarHeader>

          <SidebarContent className="flex flex-col overflow-hidden">
            <div className="py-3">
              <SidebarMenu>
                {navigation.map((item, index) => (
                  <SidebarMenuItem key={item.name}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <SidebarMenuButton asChild>
                        <Link to={item.href} className="flex items-center space-x-3">
                          <item.icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </motion.div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>

            <Separator className="mx-2" />

            {/* Collections Section */}
            <div className="flex-1 min-h-0 py-3">
              <div className="px-2 mb-3 flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  collections
                </h3>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </motion.div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-2">
                <div className="space-y-1">
                  <motion.div
                    whileHover={{ x: 2 }}
                    className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                      selectedCollectionId === null 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedCollectionId(null)
                      queryClient.invalidateQueries({ queryKey: ['files', 'me'] })
                    }}
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <Files className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium">all files</span>
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {collections.map((collection) => (
                      <motion.div
                        key={collection.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        whileHover={{ x: 2 }}
                        className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                          selectedCollectionId === collection.id 
                            ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          setSelectedCollectionId(collection.id)
                          queryClient.invalidateQueries({ queryKey: ['files', 'me'] })
                        }}
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          {selectedCollectionId === collection.id ? (
                            <FolderOpen className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <Folder className="w-4 h-4 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">
                            {collection.name}
                          </span>
                          <Badge variant="secondary" className="text-xs ml-auto">
                            {(collection as any).file_count || 0}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                setCollectionToDelete(collection)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive"
                            >
                              <Trash className="w-4 h-4 mr-2" />
                              delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {!collectionsLoading && collections.length === 0 && (
                    <div className="text-center py-4">
                      <Folder className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-2">no collections</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => setCreateDialogOpen(true)}
                      >
                        create first collection
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SidebarContent>

          {/* Upload Area */}
          <div className="px-2 py-2 border-t">
            <UploadArea variant="compact" />
          </div>

          <SidebarFooter className="border-t">
            {user && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2"
              >
                <div className="text-xs text-muted-foreground mb-2">
                  storage: {formatBytes(user.storage_used_bytes)} / {formatBytes(user.storage_quota_bytes)}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start p-2">
                      <Avatar className="w-6 h-6 mr-2">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user?.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start">
                        <span className="text-sm">{user.username}</span>
                        <span className="text-xs text-muted-foreground">{user.role}</span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      settings
                    </DropdownMenuItem>
                    {user.role === 'admin' && (
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        <Shield className="mr-2 h-4 w-4" />
                        admin panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      disabled={logoutMutation.isPending}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {logoutMutation.isPending ? 'signing out...' : 'sign out'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )}
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="relative border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-purple-400/3 to-transparent pointer-events-none" />
            <div className="relative flex h-12 items-center px-4 lg:px-6">
              <SidebarTrigger className="h-8 w-8" />
              
              <div className="flex-1 flex justify-center px-6">
                <div className="w-full max-w-md">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="search files... (⌘k)"
                      className="pl-8"
                      onClick={() => setIsCommandOpen(true)}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Right side controls */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </header>

          <div className="flex-1 p-4 lg:p-6 overflow-auto">
            <Outlet />
          </div>
        </main>

        <AdvancedSearch 
          open={isCommandOpen} 
          onOpenChange={setIsCommandOpen} 
        />

        {/* Create Collection Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="create-dialog-description">
            <DialogHeader>
              <DialogTitle>create collection</DialogTitle>
              <DialogDescription id="create-dialog-description">
                create a new collection to organize your files
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div className="space-y-2">
                <Input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="collection name"
                  autoFocus
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCreateDialogOpen(false)}
                >
                  cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || !newCollectionName.trim()}
                >
                  {createMutation.isPending ? 'creating...' : 'create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Collection Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>delete collection</AlertDialogTitle>
              <AlertDialogDescription>
                are you sure you want to delete "{collectionToDelete?.name}"? 
                files in this collection will not be deleted, only the collection itself.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete} 
                className="bg-destructive hover:bg-destructive/90"
              >
                delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarProvider>
  )
} 