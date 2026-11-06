"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment } from "@/app/actions";

export function CommentForm({ drinkId }: { drinkId: string }) {
  const [state, action, pending] = useActionState(addComment, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="drink_id" value={drinkId} />
      <div className="flex gap-2">
        <input
          name="body"
          className="input"
          placeholder="Add a comment…"
          maxLength={500}
          required
          aria-label="Comment"
        />
        <button className="btn btn-primary" disabled={pending}>Post</button>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
