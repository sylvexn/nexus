import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBytes, formatNumber } from '@/lib/utils'

interface AdminMetricCardProps {
  title: string
  value: number | string
  type?: 'number' | 'bytes' | 'string'
  icon?: React.ReactNode
  description?: string
  className?: string
}

export function AdminMetricCard({ 
  title, 
  value, 
  type = 'number', 
  icon, 
  description,
  className 
}: AdminMetricCardProps) {
  const formatValue = () => {
    if (type === 'bytes' && typeof value === 'number') {
      return formatBytes(value)
    }
    if (type === 'number' && typeof value === 'number') {
      return formatNumber(value)
    }
    return value.toString()
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="h-4 w-4 text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue()}</div>
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
} 