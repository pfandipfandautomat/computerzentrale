import { Routes, Route, useLocation } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { AuthGuard } from './components/AuthGuard'
import { Dashboard } from './pages/Dashboard'
import { Settings } from './pages/Settings'
import { Nodes } from './pages/Nodes'
import { Management } from './pages/Management'
import { Login } from './pages/Login'
import { Toaster } from './components/ui/toaster'
import { ThemeProvider } from './components/ThemeProvider'

function App() {
  const location = useLocation()
  
  // Pages that need full width (have their own sidebar layout)
  const fullWidthPages = ['/', '/nodes', '/management', '/settings']
  const isFullWidth = fullWidthPages.includes(location.pathname)

  return (
    <ThemeProvider>
      <div className="h-screen flex flex-col bg-background">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="*"
            element={
              <AuthGuard>
                <Header />
                <main className={isFullWidth ? 'flex-1 overflow-hidden' : 'flex-1 overflow-auto container mx-auto py-6'}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/nodes" element={<Nodes />} />
                    <Route path="/management" element={<Management />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </main>
              </AuthGuard>
            }
          />
        </Routes>
        <Toaster />
      </div>
    </ThemeProvider>
  )
}

export default App
