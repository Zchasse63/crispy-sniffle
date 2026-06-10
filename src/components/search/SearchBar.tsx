"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { parseQuery } from "@/lib/search/aiSearch";
import { useFilterStore } from "@/stores/filterStore";
import { VoiceButton } from "./VoiceButton";

export function SearchBar() {
  const [value, setValue] = useState("");
  const isParsing = useFilterStore((s) => s.isParsing);
  const setParsing = useFilterStore((s) => s.setParsing);
  const setFilters = useFilterStore((s) => s.setFilters);
  const rawQuery = useFilterStore((s) => s.filters.rawQuery);

  // Single source of truth: the input always mirrors the active query —
  // clearing the chip or resetting filters clears the box too.
  useEffect(() => {
    setValue(rawQuery);
  }, [rawQuery]);

  const runSearch = async (query: string) => {
    const q = query.trim();
    if (!q || isParsing) return;
    setValue(q);
    setParsing(true);
    try {
      const { filterSet, via } = await parseQuery(q);
      setFilters(filterSet, via);
    } finally {
      setParsing(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void runSearch(value);
      }}
      className="flex flex-col gap-2 rounded-xl border border-ink-line bg-ink-raise p-2 shadow-[0_18px_44px_-30px_rgba(22,36,46,0.9)] sm:flex-row sm:items-center"
      role="search"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
        <Search className="ml-1 h-5 w-5 shrink-0 text-blaze" aria-hidden />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe your ideal gym — “squat racks, sauna, near Hyde Park”"
          aria-label="Describe your ideal gym"
          disabled={isParsing}
          className="font-mono h-10 w-full min-w-0 bg-transparent text-sm text-paper placeholder:text-mist/85 focus:outline-none disabled:opacity-60"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <VoiceButton onTranscript={(t) => void runSearch(t)} disabled={isParsing} />
        <button
          type="submit"
          disabled={isParsing || value.trim().length === 0}
          className="display flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blaze-deep px-4 text-sm tracking-wider text-white transition-colors hover:bg-blaze disabled:opacity-50 sm:flex-initial"
        >
          {isParsing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Plotting
            </>
          ) : (
            "Scout it"
          )}
        </button>
      </div>
    </form>
  );
}
