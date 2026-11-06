/** Only allow redirects to paths on this site. */
export function safeNext(next: string | null | undefined, fallback = "/feed") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
