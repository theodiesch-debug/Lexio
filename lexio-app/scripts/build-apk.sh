#!/usr/bin/env bash
#
# Baut das Release-APK mit den Optimierungen dieses Projekts.
#
# Warum ein Skript und nicht nur die Werte in android/gradle.properties:
# der Ordner `android/` wird von Expo erzeugt und ist in .gitignore. Einmal
# gesetzte Werte dort ueberleben kein `expo prebuild` und landen nie im
# Repository. Das Skript setzt sie bei jedem Lauf idempotent und macht
# sichtbar, was am Ende herauskommt.
#
# Gemessen am 2026-10-23: 115 MB -> 54,6 MB, ohne Funktion zu verlieren.
#
# Aufruf:
#   ./scripts/build-apk.sh
#
# Voraussetzung: JDK 21 und Android SDK. Pfade koennen ueber JAVA_HOME und
# ANDROID_HOME ueberschrieben werden.
set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WURZEL"

JAVA_HOME="${JAVA_HOME:-$HOME/Tools/jdk-21.0.12.1+1}"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME ANDROID_HOME

EIGENSCHAFTEN="android/gradle.properties"
if [[ ! -f "$EIGENSCHAFTEN" ]]; then
    echo "android/gradle.properties fehlt." >&2
    echo "Einmalig erzeugen: npx expo prebuild --platform android" >&2
    exit 1
fi

# Setzt Schluessel=Wert, egal ob der Schluessel schon da ist (auch als
# Kommentarzeile) oder nicht. Uebergibt man eine leere Zeile, wird eine
# vorhandene Zeile entfernt.
setze() {
    local schluessel="$1" wert="$2"
    local datei="$EIGENSCHAFTEN"
    if grep -qE "^[#[:space:]]*${schluessel}=" "$datei"; then
        # existierende (ggf. kommentierte) Zeile ersetzen
        local ersatz="$schluessel=$wert"
        awk -v s="$schluessel" -v e="$ersatz" '
            BEGIN { gesetzt = 0 }
            {
                if ($0 ~ "^[#[:space:]]*" s "=") {
                    if (!gesetzt) { print e; gesetzt = 1 }
                    next
                }
                print
            }
            END { if (!gesetzt) print e }
        ' "$datei" > "$datei.tmp" && mv "$datei.tmp" "$datei"
    else
        printf "%s=%s\n" "$schluessel" "$wert" >> "$datei"
    fi
}

# Nur echte Handy-Architekturen. x86/x86_64 braucht nur der Emulator und
# lag im Universal-APK als tote 46 MB mit drin.
setze reactNativeArchitectures "arm64-v8a,armeabi-v7a"
# R8 entfernt ungenutzten Java-/Kotlin-Code und schrumpft die Ressourcen.
# Ohne das lagen rund 49 MB .dex im APK, mit R8 sind es 16 MB.
setze android.enableMinifyInReleaseBuilds "true"
setze android.enableShrinkResourcesInReleaseBuilds "true"

echo "Baue Release-APK ..."
( cd android && ./gradlew assembleRelease --no-daemon )

APK="android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK" ]]; then
    echo "Build meldet Erfolg, aber $APK fehlt." >&2
    exit 1
fi

echo
echo "APK: $APK"
echo "Groesse: $(du -h "$APK" | cut -f1)"
echo "Architekturen: $(unzip -l "$APK" | awk '/lib\//{split($4,p,"/"); a[p[2]]=1} END{for(x in a) printf "%s ", x}')"
echo "Schriften: $(unzip -l "$APK" | grep -c '\.ttf') Dateien, $(unzip -l "$APK" | awk '/\.ttf/{s+=$1} END{printf "%.1f MB", s/1048576}')"
echo "Dex: $(unzip -l "$APK" | awk '/\.dex$/{s+=$1} END{printf "%.1f MB", s/1048576}')"
