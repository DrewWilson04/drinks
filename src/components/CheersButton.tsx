"use client";

import { useOptimistic, useTransition } from "react";
import { toggleCheers } from "@/app/actions";

export function CheersButton({
  drinkId,
  count,
  cheered,
}: {
  drinkId: string;
  count: number;
  cheered: boolean;
}) {
  const [state, setState] = useOptimistic({ count, cheered });
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={state.cheered}
      onClick={() =>
        startTransition(async () => {
          setState({
            cheered: !state.cheered,
            count: state.count + (state.cheered ? -1 : 1),
          });
          await toggleCheers(drinkId, state.cheered);
        })
      }
      className={`tab flex items-center gap-1 ${state.cheered ? "tab-active" : ""}`}
    >
      🍻 <span>{state.count > 0 ? state.count : "Cheers"}</span>
    </button>
  );
}
