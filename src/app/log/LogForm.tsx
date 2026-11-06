"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DRINK_TYPES, SIZE_PRESETS, drinkMeta, formatStd, standardDrinks } from "@/lib/drinks";
import type { Drink, DrinkType } from "@/lib/types";

type Recent = Pick<Drink, "drink_type" | "name" | "volume_ml" | "abv">;

function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Shrink a photo to at most 1600px on the long side, as JPEG. */
async function compress(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function LogForm({
  userId,
  groups,
  recent,
  defaultGroup,
}: {
  userId: string;
  groups: { id: string; name: string }[];
  recent: Recent[];
  defaultGroup?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<DrinkType>("beer");
  const [name, setName] = useState("");
  const [volume, setVolume] = useState("355");
  const [abv, setAbv] = useState("5");
  const [when, setWhen] = useState("");
  // Set after mount so server and browser time zones never disagree.
  useEffect(() => setWhen(localNow()), []);
  const [groupId, setGroupId] = useState(defaultGroup ?? "");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const std = useMemo(() => {
    const v = Number(volume);
    const a = Number(abv);
    return v > 0 && a >= 0 ? standardDrinks(v, a) : 0;
  }, [volume, abv]);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  function pickType(t: DrinkType) {
    const m = drinkMeta(t);
    setType(t);
    setVolume(String(m.volumeMl));
    setAbv(String(m.abv));
  }

  function applyRecent(r: Recent) {
    setType(r.drink_type);
    setName(r.name);
    setVolume(String(Number(r.volume_ml)));
    setAbv(String(Number(r.abv)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = Number(volume);
    const a = Number(abv);
    if (!(v > 0 && v <= 5000)) return setError("Size must be between 1 and 5000 ml.");
    if (!(a >= 0 && a <= 100)) return setError("ABV must be between 0 and 100%.");
    const consumed = new Date(when);
    if (Number.isNaN(consumed.getTime())) return setError("Pick a valid time.");

    setSaving(true);
    const supabase = createClient();
    let photo_path: string | null = null;

    if (photo) {
      const blob = await compress(photo);
      photo_path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("drink-photos")
        .upload(photo_path, blob, { contentType: "image/jpeg" });
      if (upErr) {
        setSaving(false);
        return setError(`Photo upload failed: ${upErr.message}`);
      }
    }

    const { data, error: insErr } = await supabase
      .from("drinks")
      .insert({
        drink_type: type,
        name: name.trim(),
        volume_ml: v,
        abv: a,
        notes: notes.trim(),
        photo_path,
        group_id: groupId || null,
        consumed_at: consumed.toISOString(),
      })
      .select("id")
      .single();

    if (insErr || !data) {
      if (photo_path) await supabase.storage.from("drink-photos").remove([photo_path]);
      setSaving(false);
      return setError(insErr?.message ?? "Couldn't save. Try again.");
    }

    router.push(groupId ? `/groups/${groupId}` : "/feed");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      {recent.length > 0 && (
        <div>
          <div className="label">Again?</div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyRecent(r)}
                className="btn px-3 py-1.5"
              >
                {drinkMeta(r.drink_type).emoji} {r.name || drinkMeta(r.drink_type).label}
                <span className="text-muted">{Number(r.volume_ml)}ml</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <fieldset>
        <legend className="label">Type</legend>
        <div className="grid grid-cols-4 gap-2">
          {DRINK_TYPES.map((d) => (
            <button
              key={d.type}
              type="button"
              onClick={() => pickType(d.type)}
              aria-pressed={type === d.type}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition ${
                type === d.type
                  ? "border-accent bg-accent-soft font-medium text-accent-strong"
                  : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              <span className="text-2xl">{d.emoji}</span>
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="name">What is it? (optional)</label>
        <input
          id="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder={type === "beer" ? "e.g. Guinness" : "e.g. Margarita"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="volume">Size (ml)</label>
          <input
            id="volume"
            className="input"
            type="number"
            inputMode="decimal"
            min={1}
            max={5000}
            step="any"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="abv">ABV (%)</label>
          <input
            id="abv"
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.1"
            value={abv}
            onChange={(e) => setAbv(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="-mt-3 flex flex-wrap gap-1">
        {SIZE_PRESETS.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`tab text-xs ${Number(volume) === s.ml ? "tab-active" : ""}`}
            onClick={() => setVolume(String(s.ml))}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card flex items-center justify-between bg-surface-2">
        <span className="text-muted">Standard drinks</span>
        <span className="text-2xl font-bold tabular-nums">{formatStd(std)}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="when">When</label>
          <input
            id="when"
            className="input"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="group">Group / event</label>
          <select
            id="group"
            className="input"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">None</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder="Tasting notes, where you are, who's buying…"
        />
      </div>

      <div>
        <label className="label" htmlFor="photo">Photo</label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-text"
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="mt-2 max-h-60 rounded-xl object-cover" />
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary py-3 text-base" disabled={saving}>
        {saving ? "Saving…" : "Log it 🍻"}
      </button>
    </form>
  );
}
