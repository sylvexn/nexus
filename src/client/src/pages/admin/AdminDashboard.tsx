import { useQuery } from '@tanstack/react-query'
import { AdminMetricCard } from '@/components/admin/AdminMetricCard'
import { adminApi } from '@/lib/adminApi'
import { formatNumber } from '@/lib/utils'
import { 
  Users, 
  Files, 
  HardDrive, 
  Mail,
  TrendingUp,
  PieChart,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminDashboard() {
  const { data: dashboardData, isLoading, error, isError } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      console.log('AdminDashboard: Starting dashboard query...')
      try {
        const result = await adminApi.getDashboard()
        console.log('AdminDashboard: Query successful:', result)
        return result
      } catch (err) {
        console.error('AdminDashboard: Query failed:', err)
        throw err
      }
    },
    retry: 1,
    retryDelay: 2000,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })

  console.log('AdminDashboard render:', { 
    isLoading, 
    isError, 
    error, 
    data: dashboardData,
    hasMetrics: !!dashboardData?.metrics,
    hasCharts: !!dashboardData?.charts,
    metrics: dashboardData?.metrics,
    charts: dashboardData?.charts
  })

  if (isError) {
    console.error('Admin dashboard error:', error)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">admin dashboard</h1>
          <p className="text-muted-foreground">overview of your nexusdrop instance</p>
        </div>
        
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-800">failed to load dashboard data</span>
          </div>
          <p className="text-red-600 mt-2">
            please try refreshing the page.
            {error instanceof Error && (
              <div className="mt-2 text-sm">
                error: {error.message}
              </div>
            )}
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">admin dashboard</h1>
          <p className="text-muted-foreground">overview of your nexusdrop instance</p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const metrics = dashboardData?.metrics
  const charts = dashboardData?.charts

  console.log('Rendering dashboard with data:', { metrics, charts })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">admin dashboard</h1>
        <p className="text-muted-foreground">overview of your nexusdrop instance</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCard
          title="total users"
          value={metrics?.totalUsers || 0}
          type="number"
          icon={<Users />}
          description="registered users"
        />
        <AdminMetricCard
          title="total files"
          value={metrics?.totalFiles || 0}
          type="number"
          icon={<Files />}
          description="uploaded files"
        />
        <AdminMetricCard
          title="storage used"
          value={metrics?.totalStorage || 0}
          type="bytes"
          icon={<HardDrive />}
          description="across all users"
        />
        <AdminMetricCard
          title="active invites"
          value={metrics?.activeInvites || 0}
          type="number"
          icon={<Mail />}
          description="unused invite codes"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">recent uploads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {charts?.uploadStats?.slice(0, 10).map((stat, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(stat.date).toLocaleDateString()}
                  </span>
                  <span className="font-medium">{formatNumber(stat.count)} files</span>
                </div>
              )) || (
                <p className="text-sm text-muted-foreground">no upload data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">file types</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {charts?.fileTypes?.map((type, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ 
                        backgroundColor: `hsl(${(index * 137) % 360}, 60%, 50%)` 
                      }}
                    />
                    <span className="capitalize">{type.type}</span>
                  </div>
                  <span className="font-medium">{formatNumber(type.count)}</span>
                </div>
              )) || (
                <p className="text-sm text-muted-foreground">no file type data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 