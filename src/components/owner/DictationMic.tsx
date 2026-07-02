"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { getRecognitionCtor, type SpeechRecognitionLike } from "@/lib/owner/speechRecognition";

/**
 * Dictation mode (continuous + interim) for the owner form's voice notes.
 * Distinct from the search VoiceButton (one-shot → query); both share
 * getRecognitionCtor(). Appends finalized speech to the field; shows interim
 * text live while listening.
 */
export function DictationMic({
  onAppend,
  disabled = false,
}: {
  onAppend: (text: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const interimRef = useRef("");
  // True from the moment the user taps Stop until onend: swallows the final
  // onresult that stop() delivers for the pending utterance, which would
  // otherwise re-append text we already flushed from the interim buffer.
  const stoppingRef = useRef(false);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const toggle = () => {
    if (listening) {
      // flush any un-finalized speech before stopping so it isn't lost, then
      // ignore the final result stop() delivers for that same speech.
      stoppingRef.current = true;
      if (interimRef.current.trim()) onAppend(interimRef.current.trim());
      interimRef.current = "";
      recRef.current?.stop();
      return;
    }
    setError(null);
    stoppingRef.current = false;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      if (stoppingRef.current) return; // the post-stop() final result — already flushed
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) {
          const trimmed = text.trim();
          if (trimmed) onAppend(trimmed);
        } else {
          interimText += text;
        }
      }
      interimRef.current = interimText;
      setInterim(interimText);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      interimRef.current = "";
    };
    rec.onerror = (e) => {
      setListening(false);
      setInterim("");
      interimRef.current = "";
      setError(
        e?.error === "not-allowed" || e?.error === "service-not-allowed"
          ? "Mic blocked — allow microphone access to dictate."
          : e?.error === "no-speech"
            ? "Didn't catch that — try again."
            : null,
      );
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  if (!supported) {
    return (
      <p className="text-xs text-ink/50">
        Voice input isn&apos;t supported in this browser — try Chrome or Edge. You can still type.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        className={`relative flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors ${
          listening ? "bg-blaze text-white" : "bg-ink text-paper hover:bg-ink-raise"
        }`}
      >
        {listening ? <Square className="h-3.5 w-3.5" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
        {listening ? "Stop" : "Voice note"}
        {listening && <span className="absolute inset-0 animate-ping rounded-lg bg-blaze/30" aria-hidden />}
      </button>
      {interim && <span className="truncate text-xs italic text-ink/50">{interim}…</span>}
      {!listening && error && <span className="text-xs text-blaze-deep">{error}</span>}
    </div>
  );
}
