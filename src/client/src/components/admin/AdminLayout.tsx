import { Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard, 
  Users, 
  Files, 
  Mail, 
  Settings, 
  Activity,
  ArrowLeft
} from 'lucide-react'

const adminNavItems = [
  {
    title: 'dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    exact: true
  },
  {
    title: 'users',
    href: '/admin/users',
    icon: Users
  },
  {
    title: 'files',
    href: '/admin/files',
    icon: Files
  },
  {
    title: 'invites',
    href: '/admin/invites',
    icon: Mail
  },
  {
    title: 'audit logs',
    href: '/admin/logs',
    icon: Activity
  },
  {
    title: 'settings',
    href: '/admin/settings',
    icon: Settings
  }
]

export function AdminLayout() {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="w-64 border-r bg-muted/40 min-h-screen">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <div className="h-8 w-8 rounded bg-primary"></div>
              <div>
                <h2 className="text-lg font-semibold">nexusdrop</h2>
                <p className="text-sm text-muted-foreground">admin panel</p>
              </div>
            </div>

            <nav className="space-y-2">
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start"
              >
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  back to app
                </Link>
              </Button>
              
              <div className="h-2"></div>
              
              {adminNavItems.map((item) => {
                const isActive = item.exact 
                  ? location.pathname === item.href
                  : location.pathname.startsWith(item.href)
                
                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start',
                      isActive && 'bg-secondary'
                    )}
                  >
                    <Link to={item.href}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.title}
                    </Link>
                  </Button>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
} 