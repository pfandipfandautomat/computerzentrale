import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Settings, LayoutDashboard, Server, Boxes, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppearancePopover } from '@/components/AppearancePopover'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/button'

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, authRequired } = useAuthStore()
  const [needsSetup, setNeedsSetup] = useState(false)

  // Check if SSH key is configured
  useEffect(() => {
    fetch('/api/monitoring/ssh-key-status')
      .then(r => r.json())
      .then(status => setNeedsSetup(!status.hasSSHKey))
      .catch(() => {})
  }, [location.pathname]) // Re-check when navigating (user may have just saved a key)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/nodes', label: 'Nodes', icon: Server },
    { path: '/management', label: 'Management', icon: Boxes },
  ]

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border bg-card">
      <div className="flex h-full items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Computerzentrale
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  location.pathname === path
                    ? 'bg-secondary/80 text-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-1">
            <AppearancePopover />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              className={cn(
                "text-muted-foreground hover:text-foreground hover:bg-secondary relative",
                location.pathname === '/settings' && "text-foreground bg-secondary/80"
              )}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
              {needsSetup && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-card animate-pulse" />
              )}
            </Button>
            {authRequired && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
