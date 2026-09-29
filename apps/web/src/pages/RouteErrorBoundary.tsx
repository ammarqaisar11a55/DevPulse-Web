import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const isChunkError =
    error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
  const title =
    isRouteErrorResponse(error) && error.status === 404
      ? 'Page not found'
      : 'This page failed to load';
  const description = isChunkError
    ? 'A new version of DevPulse is available. Reload to continue.'
    : 'An unexpected error occurred while rendering this page.';

  return (
    <main role="alert" className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 opacity-70">{description}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 underline">
          Reload page
        </button>
      </div>
    </main>
  );
}
