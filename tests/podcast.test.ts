import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bereinigeSkriptText,
  bauePodcastPrompt,
  normalisiereGrundsprache,
  ttsModellFuerSprache,
  waehlePodcastKarten,
  zerlegeFuerTts,
} from "../lib/podcast";

test("normalisiereGrundsprache fällt auf Deutsch zurück", () => {
  assert.equal(normalisiereGrundsprache(""), "Deutsch");
  assert.equal(normalisiereGrundsprache("  Französisch  "), "Französisch");
});

test("waehlePodcastKarten verteilt gleichmäßig und begrenzt", () => {
  const karten = Array.from({ length: 20 }, (_, i) => ({ i }));
  const auswahl = waehlePodcastKarten(karten, 5);
  assert.equal(auswahl.length, 5);
  assert.deepEqual(auswahl.map((k) => k.i), [0, 5, 10, 14, 19]);
});

test("bauePodcastPrompt enthält Grundsprache und Vokabeln", () => {
  const { user } = bauePodcastPrompt({
    setName: "Französisch A1",
    spracheName: "Französisch",
    grundsprache: "Deutsch",
    karten: [{ frage: "bonjour", antwort: "hallo" }],
  });
  assert.match(user, /Grundsprache\/Erklärungssprache: Deutsch/);
  assert.match(user, /bonjour = hallo/);
  assert.match(user, /kurze Pause/);
});

test("bereinigeSkriptText macht Text sprechbar", () => {
  const text = bereinigeSkriptText("**Hallo**\n\n\n[kurze Pause] weiter");
  assert.equal(text, "Hallo\n\n...  weiter");
});

test("zerlegeFuerTts respektiert 200-Zeichen-Grenze", () => {
  const text = "Satz eins. ".repeat(40);
  const chunks = zerlegeFuerTts(text, 200);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 200, String(chunk.length));
});

test("ttsModellFuerSprache ist für Deutsch ehrlich null (Groq-Limit)", () => {
  assert.equal(ttsModellFuerSprache("Deutsch"), null);
});
