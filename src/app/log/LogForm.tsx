"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DRINK_TYPES, SIZE_PRESETS, drinkMeta, formatStd, standardDrinks } from "@/lib/drinks";
import type { Drink, DrinkType } from "@/lib/types";
import type { RecognitionResult, RecognizedDrink } from "@/lib/recognize";

type Recent = Pick<Drink, "drink_type" | "name" | "volume_ml" | "abv">;

const MAX_QUANTITY = 30;

function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Shrink a photo to at most 1600px on the long side, as JPEG. */
async function compress(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
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
  const [quantity, setQuantity] = useState(1);
  const [when, setWhen] = useState("");
  // Set after mount so server and browser time zones never disagree.
  useEffect(() => setWhen(localNow()), []);
  const [groupId, setGroupId] = useState(defaultGroup ?? "");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [scan, setScan] = useState<RecognitionResult | null>(null);
  const [picked, setPicked] = useState(0);

  const std = useMemo(() => {
    const v = Number(volume);
    const a = Number(abv);
    return v > 0 && a >= 0 ? standardDrinks(v, a) : 0;
  }, [volume, abv]);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

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

  function applyRecognized(d: RecognizedDrink, i: number) {
    setPicked(i);
    setType(d.drink_type);
    setName(d.name);
    setVolume(String(Math.round(d.volume_ml * 10) / 10));
    setAbv(String(Math.round(d.abv * 10) / 10));
    setQuantity(Math.min(MAX_QUANTITY, Math.max(1, d.quantity)));
  }

  async function runScan(opts: { image?: File; text?: string }) {
    setError(null);
    setScan(null);
    setScanning(true);
    try {
      const body = new FormData();
      if (opts.image) body.set("image", opts.image);
      if (opts.text) body.set("text", opts.text);
      const res = await fetch("/api/scan", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed.");
      const result = json as RecognitionResult;
      setScan(result);
      if (result.drinks.length > 0) applyRecognized(result.drinks[0], 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function onCameraPick(file: File | undefined) {
    if (!file) return;
    const small = await compress(file);
    setPhoto(small);
    await runScan({ image: small });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = Number(volume);
    const a = Number(abv);
    if (!(v > 0 && v <= 5000)) return setError("Size must be between 1 and 5000 ml.");
    if (!(a >= 0 && a <= 100)) return setError("ABV must be between 0 and 100%.");
    if (!(quantity >= 1 && quantity <= MAX_QUANTITY)) return setError(`Log between 1 and ${MAX_QUANTITY} at a time.`);
    const consumed = new Date(when);
    if (Number.isNaN(consumed.getTime())) return setError("Pick a valid time.");

    setSaving(true);
    const supabase = createClient();
    let photo_path: string | null = null;

    if (photo) {
      const file = photo.type === "image/jpeg" ? photo : await compress(photo);
      photo_path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("drink-photos")
        .upload(photo_path, file, { contentType: "image/jpeg" });
      if (upErr) {
        setSaving(false);
        return setError(`Photo upload failed: ${upErr.message}`);
      }
    }

    const base = {
      drink_type: type,
      name: name.trim(),
      volume_ml: v,
      abv: a,
      notes: notes.trim(),
      group_id: groupId || null,
      consumed_at: consumed.toISOString(),
    };
    // One row per drink; the photo and notes go on the first.
    const rows = Array.from({ length: quantity }, (_, i) => ({
      ...base,
      notes: i === 0 ? base.notes : "",
      photo_path: i === 0 ? photo_path : null,
    }));

    const { error: insErr } = await supabase.from("drinks").insert(rows);

    if (insErr) {
      if (photo_path) await supabase.storage.from("drink-photos").remove([photo_path]);
      setSaving(false);
      return setError(insErr.message);
    }

    router.push(groupId ? `/groups/${groupId}` : "/feed");
    router.refresh();
  }

  const scannedDrink = scan?.drinks[picked];

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      {/* Scanner */}
      <section className="card flex flex-col gap-3 bg-accent-soft/40">
        <label
          className={`btn btn-primary cursor-pointer py-3 text-base ${scanning ? "pointer-events-none opacity-60" : ""}`}
        >
          {scanning ? "Reading the label…" : "📷 Scan a drink"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={scanning}
            onChange={(e) => {
              onCameraPick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <div className="flex gap-2">
          <input
            className="input"
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (quickText.trim()) runScan({ text: quickText });
              }
            }}
            placeholder={'Or type it: "3 modelos"'}
            aria-label="Describe what you drank"
            maxLength={200}
            disabled={scanning}
          />
          <button
            type="button"
            className="btn"
            disabled={scanning || !quickText.trim()}
            onClick={() => runScan({ text: quickText })}
          >
            Fill in
          </button>
        </div>

        {scan && (
          <div className="flex flex-col gap-2 text-sm">
            <p>{scan.message}</p>
            {scan.drinks.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {scan.drinks.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyRecognized(d, i)}
                    className={`tab border border-border ${picked === i ? "tab-active" : ""}`}
                  >
                    {drinkMeta(d.drink_type).emoji} {d.quantity > 1 && `${d.quantity}× `}
                    {d.name || drinkMeta(d.drink_type).label}
                  </button>
                ))}
              </div>
            )}
            {scannedDrink && !scannedDrink.read_from_label && (
              <p className="text-xs text-muted">
                Size and ABV are typical values for this drink. Check them below.
              </p>
            )}
          </div>
        )}
      </section>

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

      <div className="card flex items-center justify-between gap-3 bg-surface-2">
        <div className="flex items-center gap-2">
          <span className="text-muted">How many?</span>
          <button
            type="button"
            className="btn h-9 w-9 p-0"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="One fewer"
          >
            −
          </button>
          <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            className="btn h-9 w-9 p-0"
            onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
            aria-label="One more"
          >
            +
          </button>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{formatStd(std * quantity)}</div>
          <div className="text-xs text-muted">std drinks</div>
        </div>
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
        {preview ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="max-h-48 rounded-xl object-cover" />
            <button type="button" className="btn px-3 py-1.5" onClick={() => setPhoto(null)}>
              Remove
            </button>
          </div>
        ) : (
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-text"
          />
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary py-3 text-base" disabled={saving || scanning}>
        {saving
          ? "Saving…"
          : quantity > 1
            ? `Log ${quantity} drinks 🍻`
            : "Log it 🍻"}
      </button>
    </form>
  );
}
