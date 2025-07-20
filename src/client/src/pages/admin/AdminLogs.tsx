import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AdminDataTable } from '@/components/admin/AdminDataTable'
import { adminApi, type AdminAuditLog } from '@/lib/adminApi'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Activity, 
  User, 
  FileText, 
  Key, 
  Mail, 
  Shield,
  Calendar,
  Info
} from 'lucide-react'

const actionIcons: Record<string, React.ReactNode> = {
  USER_LOGIN: <User className="h-4 w-4" />,
  USER_REGISTER: <User className="h-4 w-4" />,
  USER_UPDATE: <User className="h-4 w-4" />,
  FILE_UPLOAD: <FileText className="h-4 w-4" />,
  FILE_DELETE: <FileText className="h-4 w-4" />,
  FILE_UPDATE: <FileText className="h-4 w-4" />,
  API_KEY_CREATE: <Key className="h-4 w-4" />,
  API_KEY_DELETE: <Key className="h-4 w-4" />,
  INVITE_CREATE: <Mail className="h-4 w-4" />,
  INVITE_REVOKE: <Mail className="h-4 w-4" />,
  SETTINGS_UPDATE: <Shield className="h-4 w-4" />,
}

const actionColors: Record<string, string> = {
  USER_LOGIN: 'bg-green-100 text-green-800',
  USER_REGISTER: 'bg-blue-100 text-blue-800',
  USER_UPDATE: 'bg-yellow-100 text-yellow-800',
  FILE_UPLOAD: 'bg-blue-100 text-blue-800',
  FILE_DELETE: 'bg-red-100 text-red-800',
  FILE_UPDATE: 'bg-yellow-100 text-yellow-800',
  API_KEY_CREATE: 'bg-green-100 text-green-800',
  API_KEY_DELETE: 'bg-red-100 text-red-800',
  INVITE_CREATE: 'bg-green-100 text-green-800',
  INVITE_REVOKE: 'bg-red-100 text-red-800',
  SETTINGS_UPDATE: 'bg-purple-100 text-purple-800',
}

export default function AdminLogs() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'logs', page, actionFilter, userFilter],
    queryFn: () => adminApi.getAuditLogs({ 
      page, 
      limit: 50, 
      action: actionFilter,
      user_id: userFilter
    }),
  })

  const formatDetails = (details: string | null) => {
    if (!details) return null
    
    try {
      const parsed = JSON.parse(details)
      return Object.entries(parsed).map(([key, value]) => (
        <div key={key} className="text-xs">
          <span className="font-medium">{key}:</span> {String(value)}
        </div>
      ))
    } catch {
      return <span className="text-xs">{details}</span>
    }
  }

  const columns = [
    {
      key: 'created_at',
      title: 'timestamp',
      render: (value: string) => (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <div>
            <div>{new Date(value).toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(value).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      title: 'action',
      render: (value: string) => (
        <Badge className={actionColors[value] || 'bg-gray-100 text-gray-800'}>
          <div className="flex items-center gap-1">
            {actionIcons[value] || <Activity className="h-3 w-3" />}
            {value.toLowerCase().replace(/_/g, ' ')}
          </div>
        </Badge>
      ),
    },
    {
      key: 'user_username',
      title: 'user',
      render: (value: string) => {
        if (!value) {
          return <span className="text-muted-foreground text-sm">system</span>
        }
        return (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">
              {value.charAt(0).toUpperCase()}
            </div>
            {value}
          </div>
        )
      },
    },
    {
      key: 'target_type',
      title: 'target',
      render: (value: string | null, row: AdminAuditLog) => {
        if (!value || !row.target_id) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return (
          <div className="text-sm">
            <div className="font-medium">{value}</div>
            <div className="text-xs text-muted-foreground font-mono">
              {row.target_id}
            </div>
          </div>
        )
      },
    },
    {
      key: 'details',
      title: 'details',
      render: (value: string | null) => {
        if (!value) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        
        const details = formatDetails(value)
        if (!details) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        
        return (
          <div className="space-y-1 text-sm">
            {details}
          </div>
        )
      },
    },
  ]

  const logs = data?.logs || []
  const actions = data?.actions || []
  const pagination = data?.pagination

  const actionFilterOptions = actions.map(action => ({
    value: action,
    label: action.toLowerCase().replace(/_/g, ' ')
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">audit logs</h1>
        <p className="text-muted-foreground">system activity and user actions</p>
      </div>

      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>
              audit logs track all significant actions in the system including user logins, 
              file uploads, admin changes, and more. logs are retained indefinitely for compliance.
            </span>
          </div>
        </CardContent>
      </Card>

      <AdminDataTable
        title="audit logs"
        data={logs}
        columns={columns}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        onFilter={(key, value) => {
          const filterValue = value === 'all' ? '' : value
          if (key === 'action') setActionFilter(filterValue)
          if (key === 'user_id') setUserFilter(filterValue)
        }}
        filters={[
          {
            key: 'action',
            label: 'action',
            options: actionFilterOptions,
            value: actionFilter || 'all'
          }
        ]}
        emptyMessage="no audit logs found"
      />
    </div>
  )
} 