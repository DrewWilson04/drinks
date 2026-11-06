import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { safeNext } from "@/lib/safe-next";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const me = await getMe();
  if (!me) redirect("/login");
  const { next } = await searchParams;
  if (me.onboarded) redirect(safeNext(next));

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Set up your profile</h1>
      <p className="mt-1 text-muted">Pick a username so friends can find you.</p>
      <div className="mt-6">
        <ProfileForm profile={me} next={safeNext(next)} submitLabel="Let's go" />
      </div>
    </div>
  );
}
