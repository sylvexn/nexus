import { useEffect, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/lib/api'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DashboardPage from '@/pages/DashboardPage'
import SettingsPage from '@/pages/SettingsPage'
import { CollectionProvider } from '@/contexts/CollectionContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton'
import { Routes as LazyRoutes, preloadComponent } from '@/utils/performance'

import { AdminLayout } from '@/components/admin/AdminLayout'

// Loading skeleton for admin pages
function AdminLoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <EnhancedSkeleton className="h-8 w-48" />
        <EnhancedSkeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <EnhancedSkeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <EnhancedSkeleton className="h-64 w-full" />
    </div>
  )
}

function App() {
  const { isAuthenticated, setUser, setLoading } = useAuthStore()

  const { data: authData, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,
  })

  useEffect(() => {
    if (authData) {
      setUser(authData.user)
      
      // Preload admin components if user is admin
      if (authData.user.role === 'admin') {
        preloadComponent(() => import('@/pages/admin/AdminDashboard'))
        preloadComponent(() => import('@/pages/admin/AdminUsers'))
        preloadComponent(() => import('@/pages/admin/AdminFiles'))
      }
    } else if (error) {
      setUser(null)
    }
    setLoading(isLoading)
  }, [authData, error, isLoading, setUser, setLoading])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <CollectionProvider>
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
                  ) : (
          <>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={
                <Suspense fallback={<AdminLoadingSkeleton />}>
                  <LazyRoutes.AdminDashboard />
                </Suspense>
              } />
              <Route path="users" element={
                <Suspense fallback={<AdminLoadingSkeleton />}>
                  <LazyRoutes.AdminUsers />
                </Suspense>
              } />
              <Route path="files" element={
                <Suspense fallback={<AdminLoadingSkeleton />}>
                  <LazyRoutes.AdminFiles />
                </Suspense>
              } />
              <Route path="invites" element={
                <Suspense fallback={<AdminLoadingSkeleton />}>
                  <LazyRoutes.AdminInvites />
                </Suspense>
              } />
              <Route path="logs" element={
                <Suspense fallback={<AdminLoadingSkeleton />}>
                  <LazyRoutes.AdminLogs />
                </Suspense>
              } />
              <Route path="settings" element={
                <Suspense fallback={<AdminLoadingSkeleton />}>
                  <LazyRoutes.AdminSettings />
                </Suspense>
              } />
            </Route>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </>
        )}
        </Routes>
      </CollectionProvider>
    </ThemeProvider>
  )
}

export default App 