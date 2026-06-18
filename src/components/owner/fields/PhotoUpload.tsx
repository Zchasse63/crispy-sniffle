"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { PhotoEntry } from "@/lib/owner/answerTypes";

const MAX = 8;
const MAX_BYTES = 15 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const CANVAS_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUGGESTIONS = ["Main floor", "Rack / free-weights", "Recovery", "Locker room", "Exterior"];

/** Downscale large JPG/PNG/WEBP to ~2000px before upload (phone photos are huge).
 *  HEIC can't be canvas-decoded reliably → uploaded as-is within the 15MB cap. */
async function downscale(file: File): Promise<Blob> {
  if (!CANVAS_TYPES.includes(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const maxDim = 2000;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_500_000) return file;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ?? file;
}

export function PhotoUpload({
  token,
  value,
  onChange,
}: {
  token: string;
  value: PhotoEntry[];
  onChange: (v: PhotoEntry[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    // capture before the async loop — onChange isn't a functional setter, so a
    // re-render mid-upload must not let us spread a stale `value` at the end.
    const currentValue = value;
    const room = MAX - currentValue.length;
    if (room <= 0) {
      setError(`Up to ${MAX} photos.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    setBusy(true);
    const sb = getBrowserClient();
    const added: PhotoEntry[] = [];
    for (const file of picked) {
      if (!OK_TYPES.includes(file.type)) {
        setError("Use JPG, PNG, WEBP or HEIC.");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError("Each photo must be under 15MB.");
        continue;
      }
      try {
        const blob = await downscale(file);
        const ext =
          blob.type === "image/jpeg"
            ? "jpg"
            : file.type === "image/png"
              ? "png"
              : file.type === "image/webp"
                ? "webp"
                : "heic";
        const path = `${token}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await sb.storage
          .from("owner-photos")
          .upload(path, blob, { contentType: blob.type || file.type });
        if (upErr) {
          setError(`Upload failed — ${upErr.message}`);
          continue;
        }
        const { data } = sb.storage.from("owner-photos").getPublicUrl(path);
        added.push({ path, url: data.publicUrl });
      } catch {
        setError("Couldn't process that image — try another.");
      }
    }
    setBusy(false);
    if (added.length) onChange([...currentValue, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (path: string) => onChange(value.filter((p) => p.path !== path));

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {value.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((p) => (
            <div key={p.path} className="group relative aspect-square overflow-hidden rounded-lg border border-paper-line bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Gym photo" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(p.path)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-paper opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || value.length >= MAX}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-contour-deep/40 bg-paper-raise px-6 py-7 text-center hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-ink/40" aria-hidden />
        ) : (
          <ImagePlus className="h-6 w-6 text-ink/40" aria-hidden />
        )}
        <span className="text-sm font-medium text-ink/70">
          {busy ? "Uploading…" : value.length >= MAX ? `Max ${MAX} photos` : "Add photos of your space"}
        </span>
        <span className="text-xs text-ink/45">JPG, PNG, WEBP or HEIC · up to 15MB each · {value.length}/{MAX}</span>
      </button>

      {error && <p className="mt-2 text-xs text-blaze-deep">{error}</p>}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <span key={s} className="readout rounded-full border border-paper-line bg-paper px-2.5 py-1 text-ink/45">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
