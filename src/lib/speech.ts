// Voice input for the composer (Web Speech API, Thai). Chrome and Safari have it; the LIFF browser and
// Firefox may not, so the composer hides the button when it is missing.
import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return ((w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recognition) | undefined) ?? null;
}

export function useSpeech(onText: (text: string) => void) {
  const supported = recognitionClass() != null;
  const [listening, setListening] = useState(false);
  const [failed, setFailed] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => rec.current?.stop(), []);

  const toggle = useCallback(() => {
    if (rec.current) {
      rec.current.stop();
      return;
    }
    const Cls = recognitionClass();
    if (!Cls) return;
    const r = new Cls();
    r.lang = "th-TH";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onTextRef.current(text);
    };
    r.onerror = () => setFailed(true);
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setFailed(false);
    setListening(true);
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
      setFailed(true);
    }
  }, []);

  return { supported, listening, failed, toggle };
}
