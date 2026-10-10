export type CaptionLine = {
  /** Startzeit in Sekunden */
  start: number;
  /** Endzeit in Sekunden */
  end: number;
  /** Text; *Wort* = manuell orange */
  text: string;
};

export type CaptionsFile = {
  orangeColor?: string;
  autoHighlightEveryNthWord?: number;
  captions: CaptionLine[];
};

export type Word = { text: string; orange: boolean };

export type Chunk = { start: number; end: number; words: Word[] };

export const MAX_WORDS_PER_LINE = 6;

// Füllwörter, die nie automatisch orange werden.
const FILLER_WORDS = new Set(
  [
    "und", "oder", "aber", "denn", "doch", "sondern", "dass", "ob", "wenn", "als", "wie", "weil",
    "der", "die", "das", "den", "dem", "des",
    "ein", "eine", "einen", "einem", "einer", "eines",
    "ich", "du", "er", "sie", "es", "wir", "ihr", "man", "mich", "dich", "sich", "uns", "euch",
    "mir", "dir", "ihm", "ihn", "ihnen",
    "mein", "meine", "meinen", "meinem", "meiner", "dein", "deine", "deinen", "deinem", "deiner",
    "sein", "seine", "seinen", "seinem", "seiner", "unser", "unsere", "unseren", "unserem", "euer", "eure",
    "in", "im", "an", "am", "auf", "aus", "bei", "mit", "nach", "von", "vom", "zu", "zum", "zur",
    "für", "über", "unter", "um", "vor", "durch", "gegen", "ohne", "bis",
    "ist", "sind", "war", "waren", "bin", "bist", "hat", "haben", "habe", "wird", "werden", "kann",
    "so", "auch", "noch", "nur", "schon", "dann", "da", "hier", "ja", "nein", "nicht", "mal",
    "sehr", "eben", "halt", "also", "jetzt", "ganz",
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "is", "it", "for",
  ]
);

const isFiller = (word: string) => {
  const clean = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return clean.length === 0 || FILLER_WORDS.has(clean);
};

/**
 * Zerlegt die Untertitel in Wörter, färbt manuelle (*Wort*) und automatische
 * Highlights und teilt zu lange Zeilen in Blöcke à max. 6 Wörter auf
 * (Zeit wird anteilig nach Wortanzahl verteilt).
 */
export const buildChunks = (file: CaptionsFile): Chunk[] => {
  const every = file.autoHighlightEveryNthWord ?? 10;
  let sinceLastOrange = 0;
  const chunks: Chunk[] = [];

  for (const line of file.captions) {
    const words: Word[] = line.text
      .split(/\s+/)
      .filter(Boolean)
      .map((raw) => {
        const manual = /^\*.+\*[.,!?:;]*$/.test(raw);
        const text = manual ? raw.replace(/^\*/, "").replace(/\*(?=[.,!?:;]*$)/, "") : raw;
        return { text, orange: manual };
      });

    for (const word of words) {
      sinceLastOrange++;
      if (word.orange) {
        sinceLastOrange = 0;
      } else if (every > 0 && sinceLastOrange >= every && !isFiller(word.text)) {
        // ab dem 10. Wort: erstes Nicht-Füllwort wird orange
        word.orange = true;
        sinceLastOrange = 0;
      }
    }

    const duration = line.end - line.start;
    for (let i = 0; i < words.length; i += MAX_WORDS_PER_LINE) {
      const part = words.slice(i, i + MAX_WORDS_PER_LINE);
      chunks.push({
        start: line.start + (duration * i) / words.length,
        end: line.start + (duration * (i + part.length)) / words.length,
        words: part,
      });
    }
  }
  return chunks;
};
