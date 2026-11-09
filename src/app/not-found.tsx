import Link from "next/link";

export default function NotFound() {
  return (
    <main className="safe-top mx-auto max-w-xl px-4 pt-10 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">This page does not exist in FitFlow.</p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-accent px-5 font-semibold text-accentfg">
        Go to Today
      </Link>
    </main>
  );
}
