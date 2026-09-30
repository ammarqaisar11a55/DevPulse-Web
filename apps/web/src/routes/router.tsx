import { createBrowserRouter, type RouteObject } from 'react-router';
import { GuestOnly, RequireAuth } from '@/features/auth/guards';
import { RouteErrorBoundary } from '@/pages/RouteErrorBoundary';

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/ui',
        lazy: () =>
          import('@/pages/dev/UiGalleryPage').then((m) => ({ Component: m.UiGalleryPage })),
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorBoundary />,
    // Shown while the first lazy route chunk loads; matches the page background to avoid a flash.
    hydrateFallbackElement: <div className="min-h-dvh bg-canvas" />,
    children: [
      {
        index: true,
        lazy: () => import('@/pages/HomePage').then((m) => ({ Component: m.HomePage })),
      },
      {
        element: <GuestOnly />,
        children: [
          {
            path: 'login',
            lazy: () =>
              import('@/features/auth/pages/LoginPage').then((m) => ({ Component: m.LoginPage })),
          },
          {
            path: 'register',
            lazy: () =>
              import('@/features/auth/pages/RegisterPage').then((m) => ({
                Component: m.RegisterPage,
              })),
          },
        ],
      },
      {
        path: 'forgot-password',
        lazy: () =>
          import('@/features/auth/pages/ForgotPasswordPage').then((m) => ({
            Component: m.ForgotPasswordPage,
          })),
      },
      {
        path: 'reset-password',
        lazy: () =>
          import('@/features/auth/pages/ResetPasswordPage').then((m) => ({
            Component: m.ResetPasswordPage,
          })),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            lazy: () =>
              import('@/layouts/AuthenticatedLayout').then((m) => ({
                Component: m.AuthenticatedLayout,
              })),
            errorElement: <RouteErrorBoundary />,
            children: [
              {
                path: 'dashboard',
                lazy: () =>
                  import('@/features/dashboard/DashboardPage').then((m) => ({
                    Component: m.DashboardPage,
                  })),
              },
            ],
          },
        ],
      },
      ...devRoutes,
      {
        path: '*',
        lazy: () => import('@/pages/NotFoundPage').then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
]);
