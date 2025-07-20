import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/adminApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { Settings, Save, Info, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function AdminSettings() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [hasChanges, setHasChanges] = useState(false)
  const [formData, setFormData] = useState({
    defaultExpiryDays: 30,
    defaultStorageQuota: 20
  })

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: adminApi.getSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  const updateMutation = useMutation({
    mutationFn: (settings: typeof formData) => adminApi.updateSettings({
      defaultExpiryDays: settings.defaultExpiryDays,
      defaultStorageQuota: settings.defaultStorageQuota * 1024 * 1024 * 1024
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      setHasChanges(false)
      toast({
        title: "settings updated",
        description: "settings updated successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "error",
        description: `failed to update settings: ${error.message}`,
        variant: "destructive",
      })
    },
  })

  useEffect(() => {
    if (settingsData) {
      const newFormData = {
        defaultExpiryDays: settingsData.globalSettings.defaultExpiryDays,
        defaultStorageQuota: Math.round(settingsData.globalSettings.defaultStorageQuota / (1024 * 1024 * 1024))
      }
      setFormData(newFormData)
    }
  }, [settingsData])

  const handleInputChange = (field: keyof typeof formData, value: number) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      const originalData = settingsData?.globalSettings
      
      if (originalData) {
        const hasChanged = newData.defaultExpiryDays !== originalData.defaultExpiryDays ||
                          newData.defaultStorageQuota !== Math.round(originalData.defaultStorageQuota / (1024 * 1024 * 1024))
        setHasChanges(hasChanged)
      }
      
      return newData
    })
  }

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  const handleReset = () => {
    if (settingsData) {
      setFormData({
        defaultExpiryDays: settingsData.globalSettings.defaultExpiryDays,
        defaultStorageQuota: Math.round(settingsData.globalSettings.defaultStorageQuota / (1024 * 1024 * 1024))
      })
      setHasChanges(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">global settings</h1>
          <p className="text-muted-foreground">configure system-wide defaults</p>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">loading settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">global settings</h1>
        <p className="text-muted-foreground">configure system-wide defaults</p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">
                global settings notice
              </p>
              <p className="text-sm text-amber-700">
                these settings show the current default values for new users. to change defaults for new users, 
                modify individual user settings or update the system defaults below.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              system defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="defaultExpiry">new user expiry (days)</Label>
                <Input
                  id="defaultExpiry"
                  type="number"
                  min="1"
                  max="365"
                  value={formData.defaultExpiryDays}
                  onChange={(e) => handleInputChange('defaultExpiryDays', parseInt(e.target.value) || 30)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  default expiry for new user registrations
                </p>
              </div>

              <div>
                <Label htmlFor="defaultQuota">new user storage quota (GB)</Label>
                <Input
                  id="defaultQuota"
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.defaultStorageQuota}
                  onChange={(e) => handleInputChange('defaultStorageQuota', parseInt(e.target.value) || 20)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  default storage quota for new user registrations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              current default values
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <span className="font-medium">default expiry:</span>{' '}
                {settingsData?.globalSettings.defaultExpiryDays || 30} days
              </div>
              <div>
                <span className="font-medium">default storage quota:</span>{' '}
                {Math.round((settingsData?.globalSettings.defaultStorageQuota || 21474836480) / (1024 * 1024 * 1024))} GB
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasChanges && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  you have unsaved changes
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  reset
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? 'saving...' : 'save changes'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 