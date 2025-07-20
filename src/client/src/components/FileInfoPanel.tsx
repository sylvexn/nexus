import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import {
  Eye,
  Download,
  Copy,
  BarChart3,
  Edit,
  Save,
  AlertCircle,
  ExternalLink,
  Clock,
  Globe
} from 'lucide-react'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"

import { filesApi } from '@/lib/api'
import { getFileUrl, getFileViewUrl, getShareableFileUrl, getFileDirectUrl } from '@/lib/config'
import { formatBytes, formatDate, getFileType } from '@/lib/utils'
import type { File as FileType } from '@/types'

interface FileInfoPanelProps {
  file: FileType | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileUpdate?: () => void
}

export default function FileInfoPanel({ file, open, onOpenChange, onFileUpdate }: FileInfoPanelProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editingTags, setEditingTags] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [editingExpiry, setEditingExpiry] = useState(false)
  const [expiryInput, setExpiryInput] = useState('')
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitInput, setLimitInput] = useState('')

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['file-analytics', file?.id],
    queryFn: () => file ? filesApi.getFileAnalytics(file.id) : null,
    enabled: !!file && open,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => filesApi.updateFile(id, data),
    onSuccess: () => {
      toast({
        title: "file updated",
        description: "file properties have been updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['file-analytics', file?.id] })
      onFileUpdate?.()
    },
    onError: (error: any) => {
      toast({
        title: "error",
        description: error.message || "failed to update file",
        variant: "destructive",
      })
    },
  })

  useEffect(() => {
    if (file) {
      setTagInput(file.tags?.join(', ') || '')
      setExpiryInput(file.expires_at ? format(new Date(file.expires_at), 'yyyy-MM-dd\'T\'HH:mm') : '')
      setLimitInput(file.download_limit ? file.download_limit.toString() : '')
    }
  }, [file])

  if (!file) return null

  const copyFileLink = () => {
    const url = getShareableFileUrl(file.id)
    navigator.clipboard.writeText(url)
    toast({
      title: "link copied",
      description: "file link copied to clipboard",
    })
  }

  const handleTagsUpdate = () => {
    const tags = tagInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    updateMutation.mutate({ id: file.id, data: { tags } })
    setEditingTags(false)
  }

  const handleExpiryUpdate = () => {
    const expires_at = expiryInput ? new Date(expiryInput).toISOString() : null
    if (expires_at) {
      updateMutation.mutate({ id: file.id, data: { expires_at } })
    }
    setEditingExpiry(false)
  }

  const handleLimitUpdate = () => {
    const download_limit = limitInput ? parseInt(limitInput) : null
    updateMutation.mutate({ id: file.id, data: { download_limit } })
    setEditingLimit(false)
  }

  const downloadFile = () => {
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
  }

  const viewFile = () => {
    const extension = `.${file.original_filename.split('.').pop()}`
    window.open(getFileDirectUrl(file.id, extension), '_blank')
  }

  const previewFile = () => {
    window.open(getFileViewUrl(file.id), '_blank')
  }

  const fileType = getFileType(file.mime_type)
  const isExpired = new Date(file.expires_at) < new Date()
  const daysUntilExpiry = Math.ceil((new Date(file.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold truncate">
                {file.original_filename}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                file details and analytics
              </p>
            </div>
          </div>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 mt-6"
        >
          {/* File Preview */}
          <Card>
            <CardContent className="p-6">
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-4">
                {fileType === 'image' ? (
                  <img 
                    src={getFileUrl(file.id, `.${file.original_filename.split('.').pop()}`)}
                    alt={file.original_filename}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Globe className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {fileType} file
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button onClick={previewFile} className="flex-1">
                  <Eye className="mr-2 h-4 w-4" />
                  preview
                </Button>
                <Button onClick={viewFile} className="flex-1">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  view
                </Button>
                <Button variant="outline" onClick={downloadFile} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  download
                </Button>
                <Button variant="outline" onClick={copyFileLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">details</TabsTrigger>
              <TabsTrigger value="analytics">analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">file information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">size</p>
                      <p className="font-medium">{formatBytes(file.size_bytes)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">type</p>
                      <Badge variant="secondary">{fileType}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">uploaded</p>
                      <p className="font-medium">{formatDate(file.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">views</p>
                      <p className="font-medium">{file.view_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expiration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    expiration
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingExpiry(!editingExpiry)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingExpiry ? (
                    <div className="space-y-2">
                      <Input
                        type="datetime-local"
                        value={expiryInput}
                        onChange={(e) => setExpiryInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleExpiryUpdate}>
                          <Save className="mr-2 h-4 w-4" />
                          save
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingExpiry(false)}>
                          cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {isExpired ? (
                        <div className="flex items-center space-x-2 text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">expired {formatDate(file.expires_at)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''} ({formatDate(file.expires_at)})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    tags
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTags(!editingTags)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingTags ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="tag1, tag2, tag3"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleTagsUpdate}>
                          <Save className="mr-2 h-4 w-4" />
                          save
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingTags(false)}>
                          cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {file.tags && file.tags.length > 0 ? (
                        file.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">no tags</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Download Limit */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    download limit
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingLimit(!editingLimit)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingLimit ? (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        placeholder="unlimited"
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleLimitUpdate}>
                          <Save className="mr-2 h-4 w-4" />
                          save
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingLimit(false)}>
                          cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">downloads</span>
                        <span className="text-sm font-medium">
                          {file.download_count} / {file.download_limit || '∞'}
                        </span>
                      </div>
                      {file.download_limit && (
                        <Progress 
                          value={(file.download_count / file.download_limit) * 100} 
                          className="h-2"
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              {analyticsLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                      <div className="h-4 bg-muted rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : analytics ? (
                <>
                  {/* Stats Overview */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">engagement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{analytics.file.view_count}</p>
                          <p className="text-sm text-muted-foreground">views</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{analytics.file.download_count}</p>
                          <p className="text-sm text-muted-foreground">downloads</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Activity */}
                  {analytics.analytics.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">recent activity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analytics.analytics.slice(0, 5).map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                {item.action === 'view' ? (
                                  <Eye className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <Download className="h-4 w-4 text-green-500" />
                                )}
                                <span>{item.action}</span>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{item.count}</p>
                                <p className="text-muted-foreground">{item.date}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Top Referrers */}
                  {analytics.referrers.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">top referrers</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analytics.referrers.slice(0, 5).map((referrer, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2 min-w-0">
                                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{referrer.referrer}</span>
                              </div>
                              <span className="font-medium">{referrer.count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">no analytics data available</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </SheetContent>
    </Sheet>
  )
} 