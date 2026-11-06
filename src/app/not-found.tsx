import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card py-12 text-center">
      <div className="text-5xl">🫗</div>
      <h1 className="mt-3 text-xl font-bold">Nothing here</h1>
      <p className="mt-1 text-muted">This page doesn&apos;t exist, or you can&apos;t see it.</p>
      <Link href="/feed" className="btn btn-primary mt-6">Back to the feed</Link>
    </div>
  );
}
