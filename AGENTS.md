# Anweisung für Arbeiten in diesem Projekt

**Sagt der Nutzer „fixx lexio", „setze das jetzt alles um", „mach lexio
fertig" oder „arbeite die Phasen ab": lies zuerst `LEXIO-PLAN.md` vollständig
und arbeite die Phasen in der dort beschriebenen Reihenfolge ab.**

Drei Regeln gelten für jede Arbeit hier, sie stehen in `LEXIO-PLAN.md` unter
„Arbeitsregeln":

1. **Zeitnehmen.** Kein Punkt gilt als fertig, bevor er am laufenden System
   geprüft ist. `npm run build`, `npm run lint`, dann live testen.
2. **Responsiv von Anfang an.** Jede Komponente direkt für Handy und Desktop.
   Nicht am Ende nachziehen.
3. **Öffentlich denken.** Kein geteilter Zustand, keine Annahme über eine
   einzelne Sitzung, Besitzprüfung immer über die Datenbank (RLS).

## Nach jedem Schritt committen und pushen

Sagt der Nutzer **„setze das jetzt alles um"**, gilt zusätzlich:

**Nach jedem funktionierenden Schritt committen und auf `lexio-neu/main`
pushen.** (Der Remote heißt `lexio-neu`, nicht `origin` — `origin` zeigt auf
`croissant1qp1-hue/lexio`, ein anderes Repository. Upstream von `main` ist
`lexio-neu/main`, das ist der Stand, den Vercel baut.)

Ein „funktionierender Schritt" ist einer, der im laufenden System geprüft ist
— also `npm run build` und `npm run lint` sauber und die Änderung tut, was sie
soll. Kein Zwischenschand, kein „mal eben zwischenspeichern". Halbe Sachen
gehören nicht auf `main`.

Beim Commit:

- **Nur die Dateien dieses Schritts vormerken.** Immer mit ausdrücklichen
  Pfaden (`git add app/... lib/...`), **nie** `git add -A` und **nie**
  `git add .`. Im Arbeitsbaum liegen erfahrungsgemäß fremde, noch nicht
  fertige Änderungen — die dürfen nicht mit rutschen.
- Ein Schritt, ein Commit. Der Betreff ist eine kurze deutsche Zeile, die
  sagt, was dieser Schritt getan hat. Im Stil kurz wie die bisherigen
  Einträge, aber ohne deren Tippfehler nachzumachen.
- Vor dem Commit `git status` und `git diff` ansehen, damit nichts
  Unerwartetes mitgeht.
- Nie force-pushen, kein `git add .`, keine Commits von Geheimnissen.
- `.env` und alles mit Schlüsseln bleiben draußen.

Der Plan wird mitcommitted, wenn er sich ändert — die Phasenmarkierung ist
der Fortschrittsnachweis.

Der Plan enthält die Produktentscheidungen des Nutzers, die verifizierte
Lage der Datenbank und die Phasen 0 bis 7 mit Abnahmekriterien. Er ist die
verbindliche Referenz.

Nicht verwechseln: `OFFENE-PUNKTE.md` beschreibt den **Zustand des Codes**,
`LEXIO-PLAN.md` beschreibt den **Umbauauftrag**.

## „Überallhin?" — die Frage vor dem Push

**Ab 2026-10-18, vom Nutzer angeordnet: Ist eine Änderung vollständig und
geprüft, fragt Kiro genau eine Frage: „Überallhin?"** Erst die Antwort
entscheidet, was passiert. Diese Regel schlägt das automatische Pushen aus
dem Abschnitt oben — auch dort, wo „setze das jetzt alles um" gesagt wurde.

**Antwort „ja"** — in dieser Reihenfolge:

1. Committen mit ausdrücklichen Pfaden (wie oben) und auf `lexio-neu/main`
   pushen. Das löst das Deployment der Web-App auf Vercel aus.
2. Nach dem Push nachsehen, dass die Seite wirklich neu da ist — Statuscode
   und Inhalt, nicht nur „Push war erfolgreich".
3. **Die React-Native-APK nur dann neu bauen, wenn sich `lexio-app/` oder
   eine geteilte Datei (etwa `lib/`) geändert hat.** Reine Web-Änderungen
   unter `app/` landen nicht in der APK; ein Gradle-Build wäre dort
   vergebene Arbeit. Bauvariante (JDK-, SDK-Pfade, Logpfad, `setsid
   nohup`) steht in `LEXIO-PLAN.md`, Abschnitt zur App.

**Antwort „nein" oder „erst später"** — nichts passiert: nicht committen,
nicht pushen, nicht bauen. Der Arbeitsbaum bleibt liegen, wie er ist.

Diese Regel steht hier, weil Kiro sich zwischen Sitzungen nichts merkt.

## Stilrichtlinie für Animationen (UX)

**Regel „Schrittweise aufgebaut" (staggered reveal):** Für Listen, Kartenraster
oder Startseiten-Abschnitte immer erst die Struktur (Skeletons), dann das
Erscheinbild blockweise von oben nach unten / links nach rechts aufbauen.

- **Einstiege oben:** Section-Header + erste CTA-Karte in kleiner Staffelung
  (z. B. 0ms, 80ms, 160ms, 240ms, 320ms) mit `translateX(-26px)` → `0`,
  `opacity 0→1`, `cubic-bezier(0.22,0.61,0.36,1)`.
- **Raster/Kacheln:** Nur vertikales `translateY(10px)→0`, keine
  seitliche Schiebung; Staffelung begrenzen (max. ~8–10 Elemente sichtbar
  gestaffelt, Rest gleichzeitig), um lange Listen nicht träge wirken zu lassen.
- **Skeletons:** Immer in derselben Form wie der spätere Inhalt, damit kein
  Layout-Sprung entsteht. `aria-busy="true"`, versteckter Statustext
  (`.nurVorlesen`) für Screenreader, Balken `aria-hidden="true"`.
- **Dialoge/Overlays:** Schleier `opacity 0→1` (160ms), Dialog leicht
  aufspringen (`translateY(8px) scale(0.97)→0 1`, 200ms).
- **Reduziert Bewegungen:** Global bereits über
  `@media (prefers-reduced-motion: reduce)` abgesichert (alle Animationen auf
  0.01ms reduziert, Endzustand beibehalten). Neue Keyframes immer kompatibel
  dazu gestalten.
