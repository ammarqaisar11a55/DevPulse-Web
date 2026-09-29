import { createBrowserRouter, type RouteObject } from 'react-router';
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
    children: [
      {
        index: true,
        lazy: () => import('@/pages/HomePage').then((m) => ({ Component: m.HomePage })),
      },
      ...devRoutes,
      {
        path: '*',
        lazy: () => import('@/pages/NotFoundPage').then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
]);
