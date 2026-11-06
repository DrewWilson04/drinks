"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn px-3 py-1.5"
      onClick={async () => {
        try {
          if (navigator.share && /Mobi/.test(navigator.userAgent)) {
            await navigator.share({ url: text });
            return;
          }
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* user cancelled share */
        }
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
