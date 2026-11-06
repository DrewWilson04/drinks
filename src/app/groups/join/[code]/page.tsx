import { createClient, requireMe } from "@/lib/supabase/server";
import { joinGroup } from "@/app/actions";
import { redirect } from "next/navigation";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const me = await requireMe();
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("group_for_invite", { code });
  const group = (data as { id: string; name: string; kind: string; member_count: number }[] | null)?.[0];

  if (!group) {
    return (
      <div className="card py-10 text-center">
        <div className="text-4xl">🤷</div>
        <p className="mt-3 font-medium">That invite link isn&apos;t valid.</p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", group.id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (member) redirect(`/groups/${group.id}`);

  async function join(form: FormData) {
    "use server";
    await joinGroup(undefined, form);
  }

  return (
    <div className="card mx-auto max-w-sm py-10 text-center">
      <div className="text-5xl">{group.kind === "event" ? "🎉" : "👯"}</div>
      <h1 className="mt-3 text-xl font-bold">{group.name}</h1>
      <p className="mt-1 text-sm text-muted">{group.member_count} members</p>
      <form action={join} className="mt-6">
        <input type="hidden" name="code" value={code} />
        <button className="btn btn-primary px-6">
          Join {group.kind === "event" ? "event" : "group"}
        </button>
      </form>
    </div>
  );
}
