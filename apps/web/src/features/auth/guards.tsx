import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { LogoMark } from '@/components/Logo';
import { useAuth } from './auth-context';
import { safeNextPath } from './redirect';

function FullPageLoader() {
  return (
    <div role="status" aria-label="Loading DevPulse" className="grid min-h-dvh place-items-center">
      <LogoMark className="size-9 animate-pulse" />
    </div>
  );
}

/** Only renders children for signed-in users; otherwise redirects to sign-in and returns afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'unauthenticated') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

/** Sends signed-in users away from sign-in/registration pages, honouring ?next=. */
export function GuestOnly() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to={safeNextPath(params.get('next'))} replace />;
  return <Outlet />;
}
