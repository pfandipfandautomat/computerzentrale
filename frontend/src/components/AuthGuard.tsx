import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, authRequired, checkAuthStatus } = useAuthStore();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      await checkAuthStatus();
      setHasChecked(true);
    };
    check();
  }, [checkAuthStatus]);

  useEffect(() => {
    if (hasChecked && authRequired && !isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location } });
    }
  }, [isAuthenticated, hasChecked, authRequired, navigate, location]);

  // Show loading until we've checked auth status
  if (isLoading || !hasChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If auth required but not authenticated, show nothing (will redirect)
  if (authRequired && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
