import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-sm">404</p>
        <h1 className="mt-2 text-2xl font-semibold">This page does not exist</h1>
        <Link to="/" className="mt-6 inline-block underline">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
