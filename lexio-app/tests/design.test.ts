import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  goldVerlauf,
  heroVerlauf,
  PALETTE,
  schattenFuer,
  terracottaVerlauf,
} from "../src/design/tokens.ts";

const FARB_TOKENS = [
  "background",
  "bgElevated",
  "bgElevated2",
  "inputBg",
  "cardBg",
  "line",
  "ink",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "placeholder",
  "offWhite",
  "darkBrownText",
  "skeletonBase",
  "skeletonHighlight",
  "champagnerSchein",
  "gold",
  "goldDark",
  "terracotta",
  "sage",
  "sageDark",
] as const;

test("beide Designs fuellen jedes Farb-Token", () => {
  for (const design of ["dunkel", "hell"] as const) {
    const farben = PALETTE[design] as unknown as Record<string, string>;
    for (const token of FARB_TOKENS) {
      assert.equal(
        typeof farben[token],
        "string",
        `${design}.${token} fehlt oder ist keine Farbe`,
      );
    }
  }
});

test("helles Design korrigiert Gold und Terrakotta fuer den Kontrast", () => {
  assert.notEqual(PALETTE.hell.gold, PALETTE.dunkel.gold);
  assert.notEqual(PALETTE.hell.terracotta, PALETTE.dunkel.terracotta);
});

test("Verlaeufe haben Farben und passende Stuetzstellen", () => {
  for (const verlauf of [
    heroVerlauf("dunkel"),
    heroVerlauf("hell"),
    goldVerlauf(PALETTE.dunkel),
    goldVerlauf(PALETTE.hell),
    terracottaVerlauf(PALETTE.dunkel),
  ]) {
    assert.ok(verlauf.farben.length >= 2);
    assert.equal(verlauf.farben.length, verlauf.stellen.length);
  }
});

test("Schatten unterscheiden sich zwischen hell und dunkel", () => {
  assert.notEqual(
    schattenFuer("hell").karte.shadowColor,
    schattenFuer("dunkel").karte.shadowColor,
  );
  assert.equal(schattenFuer("dunkel").weich.elevation > 0, true);
});
