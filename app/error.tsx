'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <h2 className="text-xl font-bold mb-4">Something went wrong!</h2>
      <p className="text-zinc-500 mb-6 text-sm">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
