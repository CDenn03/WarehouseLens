import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
        404
      </p>
      <h1 className="mt-2 text-lg font-semibold text-slate-900">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
      >
        ← Back to the dashboard
      </Link>
    </div>
  );
}
