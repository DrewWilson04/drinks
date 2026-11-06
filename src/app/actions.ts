"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export type FormState = { error?: string; ok?: boolean } | undefined;

async function userId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, uid: user.id };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export async function saveProfile(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase, uid } = await userId();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const display_name = String(form.get("display_name") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const is_private = form.get("is_private") === "on";
  const next = form.get("next");

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return { error: "Username must be 3–24 characters: letters, numbers or _." };
  }
  if (display_name.length > 50) return { error: "Name is too long (50 max)." };
  if (bio.length > 280) return { error: "Bio is too long (280 max)." };

  const { error } = await supabase
    .from("profiles")
    .update({ username, display_name, bio, is_private, onboarded: true })
    .eq("id", uid);

  if (error) {
    if (error.code === "23505") return { error: "That username is taken." };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  if (next !== null) redirect(safeNext(String(next)));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------
export async function follow(targetId: string, path: string) {
  const { supabase, uid } = await userId();
  await supabase
    .from("follows")
    .insert({ follower_id: uid, following_id: targetId });
  revalidatePath(path);
}

export async function unfollow(targetId: string, path: string) {
  const { supabase, uid } = await userId();
  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", uid)
    .eq("following_id", targetId);
  revalidatePath(path);
}

export async function respondToFollow(followerId: string, accept: boolean) {
  const { supabase, uid } = await userId();
  const q = supabase.from("follows");
  if (accept) {
    await q
      .update({ status: "accepted" })
      .eq("follower_id", followerId)
      .eq("following_id", uid);
  } else {
    await q.delete().eq("follower_id", followerId).eq("following_id", uid);
  }
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Drinks, cheers, comments
// ---------------------------------------------------------------------------
export async function deleteDrink(drinkId: string) {
  const { supabase, uid } = await userId();
  const { data } = await supabase
    .from("drinks")
    .delete()
    .eq("id", drinkId)
    .eq("user_id", uid)
    .select("photo_path")
    .single();
  if (data?.photo_path) {
    await supabase.storage.from("drink-photos").remove([data.photo_path]);
  }
  revalidatePath("/", "layout");
  redirect("/feed");
}

export async function toggleCheers(drinkId: string, cheered: boolean) {
  const { supabase, uid } = await userId();
  if (cheered) {
    await supabase
      .from("cheers")
      .delete()
      .eq("drink_id", drinkId)
      .eq("user_id", uid);
  } else {
    await supabase.from("cheers").insert({ drink_id: drinkId });
  }
  revalidatePath("/", "layout");
}

export async function addComment(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase } = await userId();
  const drinkId = String(form.get("drink_id"));
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };
  if (body.length > 500) return { error: "Comment is too long (500 max)." };
  const { error } = await supabase
    .from("comments")
    .insert({ drink_id: drinkId, body });
  if (error) return { error: error.message };
  revalidatePath(`/drinks/${drinkId}`);
  return { ok: true };
}

export async function deleteComment(commentId: string, drinkId: string) {
  const { supabase } = await userId();
  await supabase.from("comments").delete().eq("id", commentId);
  revalidatePath(`/drinks/${drinkId}`);
}

// ---------------------------------------------------------------------------
// Groups & events
// ---------------------------------------------------------------------------
export async function createGroup(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase, uid } = await userId();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const kind = form.get("kind") === "event" ? "event" : "group";
  const startsAt = String(form.get("starts_at") ?? "");
  const endsAt = String(form.get("ends_at") ?? "");
  const tz = Number(form.get("tz_offset") ?? 0);

  if (!name) return { error: "Give it a name." };
  if (name.length > 60) return { error: "Name is too long (60 max)." };

  // datetime-local values have no zone; apply the browser's offset.
  const toIso = (v: string) => {
    if (!v) return null;
    const d = new Date(v + "Z");
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() + tz * 60_000).toISOString();
  };

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name,
      description,
      kind,
      created_by: uid,
      starts_at: kind === "event" ? toIso(startsAt) : null,
      ends_at: kind === "event" ? toIso(endsAt) : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Couldn't create it. Try again." };
  }
  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}

export async function joinGroup(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase } = await userId();
  let code = String(form.get("code") ?? "").trim();
  // Accept a full invite link too.
  const m = code.match(/\/groups\/join\/([a-z0-9]+)/i);
  if (m) code = m[1];
  const { data, error } = await supabase.rpc("join_group", { code });
  if (error || !data) return { error: "That invite code didn't work." };
  revalidatePath("/groups");
  redirect(`/groups/${data}`);
}

export async function leaveGroup(groupId: string) {
  const { supabase, uid } = await userId();
  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", uid);
  revalidatePath("/groups");
  redirect("/groups");
}

export async function removeMember(groupId: string, memberId: string) {
  const { supabase } = await userId();
  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId);
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroup(groupId: string) {
  const { supabase } = await userId();
  await supabase.from("groups").delete().eq("id", groupId);
  revalidatePath("/groups");
  redirect("/groups");
}
