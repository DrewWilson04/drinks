import { LoginButtons } from "./LoginButtons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <h1 className="text-2xl font-bold">Sign in to drinks</h1>
      <p className="mt-2 text-sm text-muted">New here? Signing in creates your account.</p>
      {error && (
        <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent-strong">
          Sign in didn&apos;t work. Please try again.
        </p>
      )}
      <LoginButtons next={next} />
    </div>
  );
}
