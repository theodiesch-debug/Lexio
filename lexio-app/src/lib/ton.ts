/**
 * Töne der App – Web: `lib/ton.ts`.
 *
 * Zwei Einstellungen, beide lokal auf dem Gerät, keine Kontenabhängigkeit:
 *
 *   an           Der Lautsprecher auf der Karte spricht, wenn man drueckt.
 *   vorlesenAlle Die Antwort wird beim Aufdecken automatisch vorgesprochen.
 *
 * Vorgabe für `vorlesenAlle` ist AUS – genau wie im Web. Wer eine
 * Fremdsprache hört, ohne danach gefragt zu haben, verliert beim Lesen die
 * Spur; und wer mit Kopfhörern im Zug lernt, möchte das selbst steuern.
 *
 * Es gibt bewusst keine Lautstärke: die regelt Android über die Geräte-
 * Tasten. Ein eigener Regler dort täte so, als gäbe es eine Stufe zwischen
 * „leise“ und „laut“, die das System ohnehin verwirft.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const TON_SPEICHER = "lexio.ton";

export type TonStand = {
  /** Schema-Version – eine unbekannte alte Fassung wird verworfen. */
  v: 1;
  an: boolean;
  vorlesenAlle: boolean;
};

export const TON_STANDARD: TonStand = { v: 1, an: true, vorlesenAlle: false };

export async function tonLesen(): Promise<TonStand> {
  try {
    const roh = await AsyncStorage.getItem(TON_SPEICHER);
    if (roh) {
      const wert = JSON.parse(roh) as Partial<TonStand>;
      if (wert.v === 1) {
        // Fehlt ein Feld (alter Speicher), ist es aus – siehe Vorgabe oben.
        return { v: 1, an: wert.an !== false, vorlesenAlle: wert.vorlesenAlle === true };
      }
    }
  } catch {
    // Nicht lesbar: die Vorgabe entscheidet, statt die App zu blockieren.
  }
  return TON_STANDARD;
}

export async function tonSpeichern(wert: TonStand): Promise<void> {
  try {
    await AsyncStorage.setItem(TON_SPEICHER, JSON.stringify(wert));
  } catch {
    // Ein nicht speicherbarer Wert darf das Lernen nicht verhindern.
  }
}
