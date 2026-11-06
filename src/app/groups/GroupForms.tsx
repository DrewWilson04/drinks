"use client";

import { useActionState, useEffect, useState } from "react";
import { createGroup, joinGroup } from "@/app/actions";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroup, undefined);
  const [kind, setKind] = useState<"group" | "event">("group");
  const [tz, setTz] = useState(0);
  useEffect(() => setTz(new Date().getTimezoneOffset()), []);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="tz_offset" value={tz} />
      <div className="flex gap-1">
        {(["group", "event"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`tab ${kind === k ? "tab-active" : ""}`}
          >
            {k === "group" ? "👯 Group" : "🎉 Event"}
          </button>
        ))}
      </div>
      <input
        name="name"
        className="input"
        placeholder={kind === "event" ? "Sam's birthday" : "The usual crew"}
        maxLength={60}
        required
        aria-label="Name"
      />
      <textarea
        name="description"
        className="input"
        rows={2}
        maxLength={280}
        placeholder="What's it about? (optional)"
        aria-label="Description"
      />
      {kind === "event" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="starts_at">Starts</label>
            <input id="starts_at" name="starts_at" type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ends_at">Ends</label>
            <input id="ends_at" name="ends_at" type="datetime-local" className="input" />
          </div>
        </div>
      )}
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Creating…" : kind === "event" ? "Create event" : "Create group"}
      </button>
    </form>
  );
}

export function JoinGroupForm() {
  const [state, action, pending] = useActionState(joinGroup, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="code"
        className="input"
        placeholder="Invite code or link"
        required
        aria-label="Invite code"
        autoCapitalize="none"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Joining…" : "Join"}</button>
    </form>
  );
}
