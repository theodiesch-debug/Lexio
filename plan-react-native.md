# Plan: React-Native-App an das Web-Design angleichen

Ziel: Die App unter `lexio-app/` soll **optisch und in der Bedienlogik dem Web
entsprechen**. Der Web-Client ist die Vorlage; die App ist der zweite Kunde
derselben API. Kein neuer Server-Code, keine neuen API-Routen — nur der
Client wird angeglichen.

Stand der Ausgangslage (erfasst am Tag der Planerstellung):

- Web: vollständiges Token-System in `app/styles/global.css`, sechs Schriften/
  vier Rollen, wiederverwendbare Komponenten, Navigation (Sidebar/Tableiste),
  elf Screens.
- App: **drei** Screens (`index`, `anmelden`, `lernen/[set]`), kein Token-
  Modul, keine Komponenten, keine Navigation, keine Schriften. Farben sind
  hartkodiert und weichen vom Web ab.

Der Plan arbeitet in Etappen. Jede Etappe ist einzeln prüfbar und wird erst
abgenommen, dann kommt die nächste. Nach jeder grünen Etappe: committen und
pushen (explizite Pfade, nie `git add -A`).

---

## Fortschritt

Stand: Etappen 1–8 umgesetzt, Etappe 9 (Feinschliff/Abnahme) in Arbeit.

| Etappe | Zustand | Commit |
|---|---|---|
| 1 – Fundament (Tokens, Theme, Schriften, Logo) | erledigt | `08b2571` |
| 2 – Kernkomponenten | erledigt | `6d50ab5` |
| 3 – Navigationsgerüst | erledigt | `728b200` |
| 4 – Übersicht im Web-Stil | erledigt | `b92d551` |
| 5 – Lernen im Web-Stil | erledigt | `0055fd1` |
| 6 – Anmelden im Web-Stil | erledigt | `62c3f78` |
| 7 – Wortschatz, Statistiken, Einstellungen, Profil | erledigt | `dda8fc4` |
| 8 – Karteikarten, Hinzufügen, Quellen | erledigt | `f86b202` |
| 9 – Feinschliff und Gesamtabnahme | in Arbeit | – |

Gates nach Etappe 8: App `tsc` sauber, `expo lint` sauber, `npm test` 36/0.

---

## Grundsatzentscheidungen

1. **Eine Quelle für Farben und Maße.** Die Web-Werte aus `global.css` werden
   in ein App-Modul `lexio-app/src/design/tokens.ts` übertragen (Dunkel als
   Vorgabe, Hell als zweite Palette). Keine Hex-Werte mehr frei im Screen.

2. **Geteilte Logik über `@lexio/*`.** Was schon in `lib/` liegt und
   plattformneutral ist, wird weiter genutzt: `@lexio/types`,
   `@lexio/lernlogik`, `@lexio/profil`, `@lexio/reihenfolge`,
   `@lexio/rundenrotation`, neu `@lexio/sprachen` (Sprachfarben),
   `@lexio/design` (Speicherschlüssel Hell/Dunkel). Kein Kopieren.

3. **Schriften wie im Web.** Inter, Fraunces, IBM Plex Mono, Caveat. In der
   App über `expo-font` + die `@expo-google-fonts/*`-Pakete (in Expo Go
   lauffähig, keine eigenen Dateien nötig). Fraunces mit den Achsen
   SOFT/WONK/opsz, Mono in 400/500/600/700.

4. **Zusätzliche, in Expo Go vorhandene Pakete:** `expo-linear-gradient`
   (Gold-Verläufe, Hero), `react-native-svg` (Kartenzeichen, Punktraster der
   Lernkarte). `boxShadow` nutzt der neue React-Native-Stil direkt
   (RN 0.86), Schatten also ohne Hilfspaket.

5. **Navigation als eigene Leiste, nicht als Expo-Tabs.** Die Web-Mobilansicht
   ist eine untere Leiste mit vier Einträgen plus „Hinzufügen" und Profil.
   Die wird als eigene Komponente nachgebaut, damit sie exakt der Web-Optik
   entspricht (Radien, Farben, aktive Markierung in Terrakotta).

6. **Plattformgrenzen offen benennen.** Wo das Web etwas kann, das die App
   nicht 1:1 kann (Handschrift-Serif auf kleinen Displays, Hover-Zustände,
   Punktraster), wird die nächstliegende Entsprechung gewählt und im Plan
   vermerkt. Ziel ist „sieht aus wie", nicht „ist zeichengleich".

---

## Etappe 1 — Fundament: Tokens, Theme, Schriften, Logo

**Dateien**
- `lexio-app/src/design/tokens.ts` — Farben (dunkel/hell), Radien
  (`--radius 16`, Pillen `999`, Feld `12`, Karte `22`), Abstände, Touch `44`,
  Typo-Größen und -Familiennamen. Struktur: `export type Farben = {...}` und
  `export const palette = { dunkel: {...}, hell: {...} }`, gespiegelt aus
  `app/styles/global.css` Z. 15–191.
- `lexio-app/src/design/theme.tsx` — Kontext mit `{ design, hell, setDesign,
  umschalten }`, Vorgabe Dunkel, gespeichert in AsyncStorage unter
  `DESIGN_SPEICHER` aus `@lexio/design`. Entspricht
  `components/design/design-anbieter.tsx`.
- `lexio-app/src/design/schrift.ts` — lädt die vier Schriften, liefert
  `fontFamily`-Namen (`Inter_400Regular` usw.) und Hilfen
  (`serif`, `mono`, `caveat`).
- `lexio-app/src/app/_layout.tsx` — Schriften laden (`useFonts`), Theme-
  Anbieter setzen, StatusBar-Farbe je Theme.
- `lexio-app/assets/images/lexio-logo.png` — Kopie von `public/images/logo.png`
  (für die Navigationsleiste/Anmelde-Marke). Ggf. vorher verkleinern.
- `lexio-app/package.json` — neue Pakete.

**Abnahme:** `npm run test` (App) grün, `npx tsc --noEmit` sauber, App startet
in Expo Go ohne Fehler; ein Testscreen zeigt Text in allen vier Schriften und
schaltet per Knopf zwischen Hell und Dunkel.

---

## Etappe 2 — Kernkomponenten

Neuer Ordner `lexio-app/src/components/`. Jeder Baustein hat einen Web-Paten:

| App-Komponente | Web-Vorbild | Kernwerte |
|---|---|---|
| `knopf.tsx` | `.knopf`, `.aufdecken`, `.absenden` | Gold-Verlauf `#eec878 → gold → gold-dark`, Text `#17110a`, Pille, min 50/56px, Pressed `scale(.98)` |
| `knopf-rand.tsx` | `.zurueck`, `.wortschatz` | 44px, Rand `--line`, Fläche `--bg-elevated` |
| `karte.tsx` | `.karte` (mehrfach) | `--bg-elevated`, Rand `--line`, Radius Karte/`--radius`, `--shadow-soft` |
| `fortschrittsbalken.tsx` | `.set-fortschritt`, `.balken` | Schiene `--bg-elevated-2`, Füllung (Gold/Sage/Terrakotta), Radius 999, 7–10px |
| `kachel.tsx` | `.kachel` (Übersicht) | quadratisch, Radius 20, Sprachakzent, 7er-Stufenleiter, Fällig-Chip |
| `sprachpunkt.tsx` | `.punkt` | 10px rund, Farbe aus `@lexio/sprachen` |
| `kartenzeichen.tsx` | `components/kartenzeichen.tsx` | deterministisches SVG aus der UUID, via `react-native-svg` |
| `feld.tsx` | `.eingabe`, `.input` | min 48px, Radius 12, `--input-bg`, Fokus Sage + Ring |
| `zustand.tsx` | `.skelett`, `.leer`, `.meldung` | Skeleton (Pulse), Leerzustand, Toast |
| `dialog.tsx` | `.schleier`/`.loeschDialog` | Vollbildscheier `rgba(5,10,14,.6)`, Karte Radius 20 |

**Abnahme:** App-Tests grün, tsc sauber, jede Komponente in einem kurzen
Vorführscreen sichtbar und themenkonform (hell/dunkel).

---

## Etappe 3 — Navigationsgerüst

- Routengruppe `(app)` in `lexio-app/src/app/` mit gemeinsamer
  Navigationsleiste (untere Leiste). Routen: `index` (Übersicht),
  `wortschatz`, `statistiken`, `einstellungen`, `profil`, `karteikarten`,
  `hinzufuegen`; `lernen/[set]` bleibt außerhalb (ohne Leiste, wie im Web).
- Aktiver Zustand über den Pfad (`usePathname`), Markierung in Terrakotta,
  Papierfarbe der Leiste wie `side-bar.css` (`--paper-text-soft`).
- Zentraler Anmelde-Schutz in einem `(app)`-Layout statt in jedem Screen
  (heute dreifach kopiert).

**Abnahme:** Man kann alle Bereiche anlaufen, die Markierung stimmt, kein
Screen lädt mehr selbst um.

---

## Etappe 4 — Übersicht im Web-Stil

`index.tsx` neu nach `components/uebersicht/uebersicht.tsx`:
Begrüßung (Fraunces, groß), Abzeichen-Pillen (Serie, XP, gelernt), Hero-Karte
mit Gold-Haarlinie und „Lernen"-Knopf, Abschnitt „Deine Sprachen" als
quadratisches Kachelraster mit Fortschrittsbalken, Fällig-Chip,
Stufenleiter und Löschdialog (Langdruck statt Hover-Menü).

**Abnahme:** Optik entspricht der Web-Übersicht; Zahlen kommen aus
`GET /api/karteikarten` wie bisher.

---

## Etappe 5 — Lernen im Web-Stil

`lernen/[set].tsx` neu nach `app/(app)/lernen/[set]/lernen-seite.tsx`:
Karte im Verhältnis 4:5 mit abgeschrägter Ecke, Punktraster (SVG-Muster),
Sprachflächenfarbe, Label/Text/Beispiel in Mono/Caveat/Sans, Stufenpunkte,
Problemskarten-Pille. Umdrehen per Transform (ersetzt den Web-3D-Flip).
Fortschrittsbalken oben, XP-Anzeige, XP-Pop beim Bewerten, vier
Bewertungsknöpfe (Nochmal/Schwer/Gut/Einfach) in den Web-Farben,
Rückgängig-Leiste, Endschirm. Logik bleibt aus `@lexio/lernlogik` und
`rundenrotation`.

**Abnahme:** Eine Runde lässt sich vollständig bewerten und beenden; Optik
und Beschriftungen entsprechen dem Web; bestehende App-Tests bleiben grün.

---

## Etappe 6 — Anmelden im Web-Stil

`anmelden.tsx` nach `app/anmelden/anmelden-seite.tsx`: Markenfläche mit Logo
und Caveat-Name, Reiter Leiste (Anmelden/Registrieren), Felder, Gold-Knopf,
Erfolg-/Fehlermeldungen in Sage/Terrakotta. Die „Fast geschafft"-Karte nach
Registrierung (Mail-Bestätigung) wird mit übernommen.

**Abnahme:** Anmelden und Registrieren funktionieren unverändert, Optik
entspricht dem Web.

---

## Etappe 7 — Neue Screens: Wortschatz, Statistiken, Einstellungen, Profil

- **Wortschatz**: Suche, Liste als Karte mit Sprachpunkt und Set-Name
  (`GET /api/wortschatz` bzw. der bestehende Endpunkt; Endpunkt prüfen).
- **Statistiken**: Kacheln (Mono-Zahlen, eingefärbt), Heute-Balken,
  Wochenbalken, Pro Sprache mit Sage-Balken.
- **Einstellungen**: Design-Umschaltung (nutzt den Theme-Kontext), Kontozugang
  (Abmelden, Passwort ändern — letzteres ggf. nur Verweis), Abschnitte wie
  `einstellung.css`.
- **Profil**: Avatar/Initialen, Level, XP-Balken mit Kerben, Kacheln,
  Kontoliste.

**Abnahme:** Jeder Screen zeigt echte Daten und ist themenkonform. Fehlende
API-Endpunkte werden vorab geprüft und benannt, nicht erfunden.

---

## Etappe 8 — Karteikarten, Hinzufügen, Quellen

- **Karteikarten**: Set-Liste mit Suche, Tabelle→Karten-Umschaltung.
- **Hinzufügen**: Sprache wählen, Vokabeln erfassen (`POST`-Endpunkte), mit
  Duplikatprüfung aus `@lexio/karten-duplikat`.
- **Quellen**: statische Seite wie `app/quellen`.

**Abnahme:** Anlegen funktioniert gegen die echte API; Duplikate werden wie im
Web abgewiesen.

---

## Etappe 9 — Feinschliff und Gesamtabnahme

- Kartenzeichen überall dort, wo das Web sie zeigt.
- Lade-/Leer-/Fehlerzustände vereinheitlichen (Skeleton statt Spinner).
- Bewegung: Pressed-Skalierung, Balken-Übergänge, XP-Pop — sparsam und
  `reduce-motion`-bewusst.
- Dunkel/Hell in allen Screens durchprüfen, Kontrastwerte wie im Web
  (Terrakotta/Gold angepasst).
- Gates: App-`test`, `tsc`, `lint`, Web-`build/lint/test` unverändert grün;
  Sichtprüfung in Expo Go auf iOS und Android.

**Abnahme:** Checkliste „App entspricht Web" Punkt für Punkt abgehakt; offene
Abweichungen ausdrücklich benannt.

---

## Offene Punkte / Grenzen

- **Schriftdateien**: über `@expo-google-fonts` (Netz beim ersten Build),
  keine eigenen Dateien. Falls offline nötig, später Dateien bündeln.
- **Hover**: entfällt in der App; stattdessen Pressed-Zustände.
- **Passwort ändern/zurücksetzen** und **Landing**: evtl. nur Web; im Plan als
  „prüfen" markiert.
- **Plattformprüfung** braucht ein echtes Gerät (iOS/Android) — wie bei
  LEXIO-PLAN offen bis Hardware da ist.

### Etappe 9 — Ergebnis und benannte Abweichungen

Umgesetzt:
- **Reduzierte Bewegung** wie im Web (`@media (prefers-reduced-motion)`):
  `design/bewegung.ts` liest die Systemeinstellung und beobachtet sie; das
  Skelett pulsiert dann nicht, der Kartenwechsel dreht nicht (Dauer 0), der
  XP-Pop erscheint ohne Flug (Dauer 0).
- **Kartenzeichen** erscheinen in der Lernansicht wie im Web. Das Web zeigt sie
  sonst nur auf der Landing (keine App) und als Schalter in den Einstellungen.

Bewusst abweichend (nicht erfunden, sondern benannt):
- **Quellen**: Das Web verlinkt `/quellen` von der öffentlichen Landing, die
  die App nicht hat. Die App bringt die Seite als `(app)/quellen.tsx` mit und
  verlinkt sie aus „Einstellungen → Sonstiges"; dort ist sie hinter der
  Anmeldung erreichbar.
- **Kartenzeichen-Schalter** (an/aus, `lib/kartenzeichen-ein.ts`, localStorage):
  in der App nicht vorhanden — die Kartenzeichen stehen fest an. `lib/
  kartenzeichen-ein.ts` ist browser-only (localStorage) und müsste für die App
  über AsyncStorage neu gebaut werden.
- **Weitere Geräte-Einstellungen** des Web (Ton, Push, „angemeldet bleiben",
  Sitzungsdauer) fehlen bewusst: sie brauchen Gerätemodule oder speichern
  nichts. Siehe Kopfkommentar `einstellungen.tsx`.
- **Kein OAuth** und kein „Passwort vergessen?" beim Anmelden (Etappe 6):
  dieselbe Geräte-/Konfigurationsgrenze. „Passwort ändern" gibt es dagegen in
  den Einstellungen über `supabase.auth.updateUser`.
- **`ActivityIndicator`** im Anmelde-Knopf entspricht dem `fa-spinner fa-spin`
  des Web — ein Knopf-Zustand, kein Lade-/Leer-/Fehlerzustand einer Liste.
