/**
 * Tägliche Erinnerung an das Tagesziel – die erste Benachrichtigung der App.
 *
 * Alles läuft lokal auf dem Gerät: kein Server, kein Token, kein Konto. Genau
 * deshalb konnte das in `einstellungen.tsx` lange kein Schalter sein – in Expo
 * Go fehlen Teile und vor der eigenständigen APK gab es nichts, was ohne
 * Metro läuft. Beides ist jetzt da.
 *
 * Reihenfolge ist auf Android 13 Pflicht: erst den Kanal anlegen, dann um die
 * Berechtigung bitten. Ohne Kanal erscheint der Dialog überhaupt nicht (Expo-
 * Doku zu expo-notifications, Abschnitt „Permissions").
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { lernzeitVorschlag } from "./lernzeit";

export const KANAL_ID = "lexio-erinnerung";
export const ERINNERUNG_SPEICHER = "lexio.erinnerung";

const AKZENT = "#e7b14a";

function erinnerungstext(): string {
  const varianten = [
    `${TAGESZIEL_XP} XP sind dein Tagesziel – meist reichen 2 Minuten.`,
    "Dein Tagesziel wartet – 2 Minuten reichen völlig.",
    "Du hast heute noch Wörter offen – schnell eine Runde.",
    "Nimm dir 2 Minuten für deinen Wortschatz.",
    "Dein Lernstreak wartet – leg einfach los!",
    "Zeit zu lernen – die kleinste Runde zählt.",
  ];
  return varianten[Math.floor(Math.random() * varianten.length)];
}

export type Erinnerung = {
  aktiv: boolean;
  stunde: number;
  minute: number;
};

export const ERINNERUNG_STANDARD: Erinnerung = { aktiv: false, stunde: 17, minute: 0 };

/** Tagesziel aus lib/profil.ts des Webs – der Text behauptet keine Zahl, die nicht stimmt. */
const TAGESZIEL_XP = 100;

let handlerGesetzt = false;

/**
 * Muss einmal beim App-Start laufen. Ohne Handler zeigt expo-notifications
 * eingehende Meldungen im Vordergrund nicht an – sie werden dann geschluckt,
 * was nach aussen wie ein Defekt aussieht.
 */
export function meldungenAktivieren(): void {
  if (handlerGesetzt) return;
  handlerGesetzt = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function erinnerungLesen(): Promise<Erinnerung> {
  try {
    const roh = await AsyncStorage.getItem(ERINNERUNG_SPEICHER);
    if (roh) {
      const wert = JSON.parse(roh) as Partial<Erinnerung>;
      if (typeof wert.stunde === "number" && typeof wert.minute === "number") {
        return { aktiv: wert.aktiv === true, stunde: wert.stunde, minute: wert.minute };
      }
    }
  } catch {
    // Nicht lesbar: die Vorgabe entscheidet, statt die App zu blockieren.
  }
  return ERINNERUNG_STANDARD;
}

export async function erinnerungSpeichern(wert: Erinnerung): Promise<void> {
  try {
    await AsyncStorage.setItem(ERINNERUNG_SPEICHER, JSON.stringify(wert));
  } catch {
    // Ein nicht speicherbarer Wert darf die Erinnerung nicht verhindern.
  }
}

async function kanalAnlegen(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(KANAL_ID, {
    name: "Tägliche Erinnerung",
    description: "Erinnerung an deine Lexio-Lernrunde",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: AKZENT,
    enableVibrate: true,
    sound: "default",
  });
}

async function berechtigungHolen(): Promise<boolean> {
    const vorhanden = await Notifications.getPermissionsAsync();
    if (vorhanden.granted) return true;
    const neu = await Notifications.requestPermissionsAsync();
    return neu.granted;
}

async function eintragen(wert: Erinnerung): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!wert.aktiv) return true;

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Zeit zu lernen – Lexio",
      body: erinnerungstext(),
      color: AKZENT,
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: wert.stunde,
      minute: wert.minute,
      channelId: KANAL_ID,
    },
  });
  return true;
}

export type ErinnerungErgebnis = "gesetzt" | "abgelehnt";

/**
 * Vom Einstellungs-Schalter: Kanal anlegen, Berechtigung holen, eintragen.
 * „abgelehnt" heisst: gespeichert, aber Android zeigt nichts – die Oberfläche
 * soll das offen sagen, statt still zu tun, als wäre alles gut.
 */
export async function erinnerungStellen(wert: Erinnerung): Promise<ErinnerungErgebnis> {
  await kanalAnlegen();
  if (!wert.aktiv) {
    await eintragen(wert);
    return "gesetzt";
  }

    if (!(await berechtigungHolen())) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        return "abgelehnt";
    }
    return (await eintragen(wert)) ? "gesetzt" : "abgelehnt";
}

/**
 * Beim App-Start neu eintragen. Fragt bewusst nicht nach der Berechtigung:
 * ein Dialog direkt nach dem Öffnen wäre ungewollt, und wer abgelehnt hat,
 * bekommt die Meldung ohnehin erst, wenn er sie in den Einstellungen erlaubt.
 */
export async function erinnerungWiederherstellen(): Promise<void> {
  const wert = await erinnerungLesen();
  if (!wert.aktiv) return;
  await kanalAnlegen();
  await eintragen(wert);
}

/** Einmalprobe, damit man das Aussehen sieht, ohne bis morgen zu warten. */
export async function testmeldung(): Promise<boolean> {
    await kanalAnlegen();
    if (!(await berechtigungHolen())) return false;
    await Notifications.scheduleNotificationAsync({
    content: {
      title: "Zeit zu lernen – Lexio",
      body: erinnerungstext(),
      color: AKZENT,
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: KANAL_ID,
    },
  });
  return true;
}

export async function erinnerungVorschlag(): Promise<Erinnerung> {
  const vorschlag = await lernzeitVorschlag();
  if (vorschlag) {
    return { aktiv: false, stunde: vorschlag.stunde, minute: vorschlag.minute };
  }
  return { aktiv: false, stunde: 18, minute: 0 };
}
