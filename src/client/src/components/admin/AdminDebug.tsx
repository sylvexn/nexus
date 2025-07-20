import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/adminApi'

export function AdminDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testApiCall = async () => {
    setLoading(true)
    setError(null)
    setDebugInfo(null)

    try {
      console.log('Testing admin API call...')
      const data = await adminApi.getDashboard()
      console.log('API call successful:', data)
      setDebugInfo(data)
    } catch (err) {
      console.error('API call failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>admin dashboard debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testApiCall} disabled={loading}>
          {loading ? 'testing...' : 'test api call'}
        </Button>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <h4 className="font-medium text-red-800">error:</h4>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {debugInfo && (
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h4 className="font-medium text-green-800">success:</h4>
            <pre className="text-sm text-green-600 overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 