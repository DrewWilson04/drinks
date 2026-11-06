"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/actions";
import type { Profile } from "@/lib/types";

export function ProfileForm({
  profile,
  next,
  submitLabel,
}: {
  profile: Profile;
  next?: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const placeholder = profile.username.startsWith("user_") && !profile.onboarded;

  return (
    <form action={action} className="flex flex-col gap-4">
      {next !== undefined && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="label" htmlFor="username">Username</label>
        <div className="flex items-center gap-1">
          <span className="text-muted">@</span>
          <input
            id="username"
            name="username"
            className="input"
            defaultValue={placeholder ? "" : profile.username}
            placeholder="yourname"
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]{3,24}"
            autoCapitalize="none"
            autoComplete="username"
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="display_name">Display name</label>
        <input
          id="display_name"
          name="display_name"
          className="input"
          defaultValue={profile.display_name}
          maxLength={50}
        />
      </div>
      <div>
        <label className="label" htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          name="bio"
          className="input"
          rows={2}
          defaultValue={profile.bio}
          maxLength={280}
          placeholder="IPA enjoyer. Never says no to a negroni."
        />
      </div>
      <label className="card flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="is_private"
          defaultChecked={profile.is_private}
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
        />
        <span>
          <span className="font-medium">Private account</span>
          <span className="block text-sm text-muted">
            Only followers you approve can see your drinks. Drinks you log to a
            group are still visible to that group.
          </span>
        </span>
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-accent-strong">Saved.</p>}
      <button className="btn btn-primary py-3" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
