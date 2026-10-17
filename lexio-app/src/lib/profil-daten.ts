/**
 * Profildaten, wie GET /api/profil sie liefert. Geteilt von Übersicht,
 * Profil, Einstellungen und Navigation – eine Abschrift je Screen würde
 * irgendwann auseinanderlaufen.
 */
export type ProfilDaten = {
    vorname: string;
    email: string | null;
    avatarUrl: string | null;
    xp: number;
    level: number;
    xpImLevel: number;
    levelProzent: number;
    bisNaechstes: number;
    streak: number;
    lerntage: number;
    setsGelernt: number;
};
