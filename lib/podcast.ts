/**
 * Lern-Podcast: Skriptaufbau und TTS-Helfer.
 *
 * Option A (Groq-first, pragmatisch): Skript wird per Groq-Chat erzeugt.
 * Audio nur, wenn Groq TTS das Modell/Terms erlaubt; Deutsch ist als
 * Orpheus-Stimme nicht nativ verfügbar - dann liefern wir Skript + Hinweis.
 */

export type PodcastKarte = {
  frage: string;
  antwort: string;
  beispielsatz?: string | null;
  beispielUebersetzung?: string | null;
};

export type PodcastAnfrage = {
  setName: string;
  spracheName: string;
  grundsprache: string;
  karten: PodcastKarte[];
};

export type PodcastSkript = {
  titel: string;
  skript: string;
};

/** Harte Grenze, damit Prompt/Audio nicht ausufern. */
export const MAX_PODCAST_KARTEN = 12;
/** Groq Orpheus: 200 Zeichen pro Request. */
export const TTS_MAX_ZEICHEN = 200;

export function normalisiereGrundsprache(wert: unknown): string {
  const text = typeof wert === "string" ? wert.trim().replace(/\s+/g, " ") : "";
  if (!text) return "Deutsch";
  return text.slice(0, 40);
}

export function waehlePodcastKarten<T>(karten: T[], max = MAX_PODCAST_KARTEN): T[] {
  if (karten.length <= max) return karten;
  // Gleichmäßig verteilt, damit das Set repräsentiert wird.
  const auswahl: T[] = [];
  const schritt = (karten.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) {
    auswahl.push(karten[Math.round(i * schritt)]);
  }
  return auswahl;
}

export function bauePodcastPrompt(anfrage: PodcastAnfrage): { system: string; user: string } {
  const kartenText = anfrage.karten
    .map((k, i) => {
      const beispiel = k.beispielsatz?.trim()
        ? ` | Beispielsatz: ${k.beispielsatz.trim()}${k.beispielUebersetzung?.trim() ? ` (${k.beispielUebersetzung.trim()})` : ""}`
        : "";
      return `${i + 1}. ${k.frage} = ${k.antwort}${beispiel}`;
    })
    .join("\n");

  const system =
    "Du schreibst kurze, lernpsychologisch wirksame Lern-Podcast-Skripte für Vokabeln. " +
    "Du antwortest NUR mit JSON.";

  const user =
    `Erstelle ein gesprochenes Lern-Podcast-Skript.\n\n` +
    `Set: ${anfrage.setName}\n` +
    `Zielsprache der Vokabeln: ${anfrage.spracheName}\n` +
    `Grundsprache/Erklärungssprache: ${anfrage.grundsprache}\n\n` +
    `Vokabeln:\n${kartenText}\n\n` +
    `Anforderungen:\n` +
    `- Länge: ca. 60-90 Sekunden beim Sprechen (ca. 130-180 Wörter).\n` +
    `- Grundsprache für Erklärungen/Moderation: ${anfrage.grundsprache}.\n` +
    `- Nenne das Zielwort in der Zielsprache deutlich, dann Bedeutung in der Grundsprache.\n` +
    `- Lernpsychologisch: kurzer Hook, Chunking in kleine Gruppen, aktive Abruf-Frage („Was heißt ...?“), kurze Pause-Hinweise als Text [kurze Pause], Wiederholung schwieriger Wörter am Ende, positiver Abschluss.\n` +
    `- Nutze wenn vorhanden Beispielsätze natürlich.\n` +
    `- Keine Markdown-Überschriften, kein SSML, kein Codeblock; nur sprechbarer Text.\n` +
    `- Keine erfundenen Vokabeln; nutze nur die Liste.\n\n` +
    `Antworte als JSON:\n` +
    `{"titel":"...","skript":"..."}`;

  return { system, user };
}

export function bereinigeSkriptText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[*_#>`]/g, "")
    .replace(/\[(kurze Pause)\]/gi, "... ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function zerlegeFuerTts(text: string, max = TTS_MAX_ZEICHEN): string[] {
  const sauber = bereinigeSkriptText(text).replace(/\s+/g, " ").trim();
  if (!sauber) return [];
  if (sauber.length <= max) return [sauber];

  const saetze = sauber.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [sauber];
  const chunks: string[] = [];
  let aktuell = "";

  const schiebe = (teil: string) => {
    const t = teil.trim();
    if (!t) return;
    if (t.length <= max) {
      if (!aktuell) aktuell = t;
      else if (`${aktuell} ${t}`.length <= max) aktuell = `${aktuell} ${t}`;
      else {
        chunks.push(aktuell);
        aktuell = t;
      }
      return;
    }
    // Harte Teilung bei sehr langen Sätzen.
    let rest = t;
    while (rest.length > max) {
      let schnitt = rest.lastIndexOf(" ", max);
      if (schnitt < 40) schnitt = max;
      const links = rest.slice(0, schnitt).trim();
      if (aktuell) {
        chunks.push(aktuell);
        aktuell = "";
      }
      if (links) chunks.push(links);
      rest = rest.slice(schnitt).trim();
    }
    if (rest) {
      if (!aktuell) aktuell = rest;
      else if (`${aktuell} ${rest}`.length <= max) aktuell = `${aktuell} ${rest}`;
      else {
        chunks.push(aktuell);
        aktuell = rest;
      }
    }
  };

  for (const satz of saetze) schiebe(satz);
  if (aktuell) chunks.push(aktuell);
  return chunks;
}

export function ttsModellFuerSprache(grundsprache: string): { model: string; voice: string } | null {
  // Groq Orpheus unterstützt derzeit nur Englisch/Arabisch (Saudi).
  // Deutsch-Grundsprache gewünscht -> kein natives TTS; ehrlich zurückmelden.
  void grundsprache;
  return null;
}

export function wavHeader(dataBytes: number, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const buffer = Buffer.alloc(44);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

export function istWav(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";
}

export function concatWav(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];
  // Falls WAV: Header entfernen und PCM-Daten verketten.
  const pcmTeile: Buffer[] = [];
  let sampleRate = 24000;
  let channels = 1;
  let bitsPerSample = 16;
  for (const buf of buffers) {
    if (!istWav(buf) || buf.length < 44) {
      pcmTeile.push(buf);
      continue;
    }
    channels = buf.readUInt16LE(22) || channels;
    sampleRate = buf.readUInt32LE(24) || sampleRate;
    bitsPerSample = buf.readUInt16LE(34) || bitsPerSample;
    // data chunk suchen
    let offset = 12;
    let dataFound = false;
    while (offset + 8 <= buf.length) {
      const id = buf.toString("ascii", offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      const dataStart = offset + 8;
      if (id === "data") {
        const end = Math.min(buf.length, dataStart + size);
        pcmTeile.push(buf.subarray(dataStart, end));
        dataFound = true;
        break;
      }
      offset = dataStart + size + (size % 2);
    }
    if (!dataFound) pcmTeile.push(buf.subarray(44));
  }
  const data = Buffer.concat(pcmTeile);
  return Buffer.concat([wavHeader(data.length, sampleRate, channels, bitsPerSample), data]);
}
