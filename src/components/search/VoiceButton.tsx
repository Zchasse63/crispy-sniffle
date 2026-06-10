"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

/* Minimal Web Speech API surface (lib.dom omits it). */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voice is just an input method: speech → transcript → the same NL search
 * pipeline as typing. No separate voice pipeline (a prior-Scout failure).
 */
export function VoiceButton({
  onTranscript,
  disabled = false,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || !supported}
      aria-label={
        !supported
          ? "Voice input is not supported in this browser"
          : listening
            ? "Stop listening"
            : "Search by voice"
      }
      title={
        !supported
          ? "Voice input isn't supported in this browser — try Chrome or Edge"
          : listening
            ? "Listening… tap to stop"
            : "Describe your ideal gym out loud"
      }
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
        listening
          ? "bg-blaze text-white"
          : supported
            ? "bg-ink text-paper hover:bg-ink-raise"
            : "cursor-not-allowed bg-paper-line text-ink/40"
      }`}
    >
      {supported ? <Mic className="h-4.5 w-4.5" aria-hidden /> : <MicOff className="h-4.5 w-4.5" aria-hidden />}
      {listening && (
        <span className="absolute inset-0 animate-ping rounded-lg bg-blaze/40" aria-hidden />
      )}
    </button>
  );
}
