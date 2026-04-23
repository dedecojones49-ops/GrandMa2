import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <h2 className="text-xl font-bold mb-4">404 - Not Found</h2>
      <p className="text-zinc-500 mb-6 text-sm">Could not find requested resource</p>
      <Link
        href="/"
        className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
