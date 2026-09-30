import type { ComponentType } from 'react';
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router';
import { GuestOnly, RequireAuth } from '@/features/auth/guards';
import { RouteErrorBoundary } from '@/pages/RouteErrorBoundary';

/** Lazily loads a named page component so every route is its own chunk. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return async () => ({ Component: (await load())[name] });
}

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'dev/ui', lazy: page(() => import('@/pages/dev/UiGalleryPage'), 'UiGalleryPage') }]
  : [];

const appRoutes: RouteObject[] = [
  {
    path: 'dashboard',
    lazy: page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage'),
  },
  {
    path: 'projects',
    lazy: page(() => import('@/features/projects/ProjectsPage'), 'ProjectsPage'),
  },
  {
    path: 'projects/:projectId',
    lazy: page(() => import('@/features/projects/ProjectDetailPage'), 'ProjectDetailPage'),
  },
  { path: 'devices', lazy: page(() => import('@/features/devices/DevicesPage'), 'DevicesPage') },
  { path: 'goals', lazy: page(() => import('@/features/goals/GoalsPage'), 'GoalsPage') },
  {
    path: 'notifications',
    lazy: page(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage'),
  },
  {
    path: 'leaderboard',
    lazy: page(() => import('@/features/leaderboard/LeaderboardPage'), 'LeaderboardPage'),
  },
  {
    path: 'settings',
    lazy: page(() => import('@/features/settings/SettingsLayout'), 'SettingsLayout'),
    children: [
      { index: true, element: <Navigate to="profile" replace /> },
      {
        path: 'profile',
        lazy: page(
          () => import('@/features/settings/pages/ProfileSettingsPage'),
          'ProfileSettingsPage',
        ),
      },
      {
        path: 'appearance',
        lazy: page(
          () => import('@/features/settings/pages/AppearanceSettingsPage'),
          'AppearanceSettingsPage',
        ),
      },
      {
        path: 'integrations',
        lazy: page(
          () => import('@/features/integrations/IntegrationsSettingsPage'),
          'IntegrationsSettingsPage',
        ),
      },
      {
        path: 'security',
        lazy: page(
          () => import('@/features/settings/pages/SecuritySettingsPage'),
          'SecuritySettingsPage',
        ),
      },
    ],
  },
];

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorBoundary />,
    // Shown while the first lazy route chunk loads; matches the page background to avoid a flash.
    hydrateFallbackElement: <div className="min-h-dvh bg-canvas" />,
    children: [
      { index: true, lazy: page(() => import('@/pages/HomePage'), 'HomePage') },
      {
        element: <GuestOnly />,
        children: [
          {
            path: 'login',
            lazy: page(() => import('@/features/auth/pages/LoginPage'), 'LoginPage'),
          },
          {
            path: 'register',
            lazy: page(() => import('@/features/auth/pages/RegisterPage'), 'RegisterPage'),
          },
        ],
      },
      {
        path: 'forgot-password',
        lazy: page(() => import('@/features/auth/pages/ForgotPasswordPage'), 'ForgotPasswordPage'),
      },
      {
        path: 'reset-password',
        lazy: page(() => import('@/features/auth/pages/ResetPasswordPage'), 'ResetPasswordPage'),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            lazy: page(() => import('@/layouts/AuthenticatedLayout'), 'AuthenticatedLayout'),
            errorElement: <RouteErrorBoundary />,
            children: appRoutes,
          },
        ],
      },
      ...devRoutes,
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage'), 'NotFoundPage') },
    ],
  },
]);
