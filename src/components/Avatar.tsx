/* eslint-disable @next/next/no-img-element */
import type { ProfileLite } from "@/lib/types";

export function Avatar({
  profile,
  size = 40,
}: {
  profile: Pick<ProfileLite, "username" | "display_name" | "avatar_url">;
  size?: number;
}) {
  const name = profile.display_name || profile.username;
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full bg-surface-2 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
