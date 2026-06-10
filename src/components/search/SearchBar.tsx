"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { parseQuery } from "@/lib/search/aiSearch";
import { useFilterStore } from "@/stores/filterStore";
import { VoiceButton } from "./VoiceButton";

export function SearchBar() {
  const [value, setValue] = useState("");
  const isParsing = useFilterStore((s) => s.isParsing);
  const setParsing = useFilterStore((s) => s.setParsing);
  const setFilters = useFilterStore((s) => s.setFilters);

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
      className="flex items-center gap-2 rounded-xl border border-ink-line bg-ink-raise p-2 shadow-[0_18px_44px_-30px_rgba(22,36,46,0.9)]"
      role="search"
    >
      <Search className="ml-2 h-5 w-5 shrink-0 text-blaze" aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Describe your ideal gym — “squat racks, sauna, near Hyde Park”"
        aria-label="Describe your ideal gym"
        disabled={isParsing}
        className="font-mono w-full min-w-0 bg-transparent text-sm text-paper placeholder:text-mist/70 focus:outline-none disabled:opacity-60"
      />
      <VoiceButton onTranscript={(t) => void runSearch(t)} disabled={isParsing} />
      <button
        type="submit"
        disabled={isParsing || value.trim().length === 0}
        className="display flex h-10 shrink-0 items-center gap-2 rounded-lg bg-blaze px-4 text-sm tracking-wider text-white transition-colors hover:bg-blaze-deep disabled:opacity-50"
      >
        {isParsing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Plotting
          </>
        ) : (
          "Scout it"
        )}
      </button>
    </form>
  );
}
