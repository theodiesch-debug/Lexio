/**
 * Design-Tokens der App – die App-Ausgabe von app/styles/global.css.
 *
 * Eine einzige Quelle für Farben, Flächen, Schatten, Radien und Maße. Kein
 * Screen darf eine Farbe frei wählen. Wenn ein Wert hier fehlt, fehlt er im
 * Token-Satz, nicht im Screen.
 *
 * Reihenfolge und Namen folgen dem Web, damit ein Vergleich der beiden
 * Dateien ohne Übersetzung möglich ist.
 */

export type DesignName = "dunkel" | "hell";

/** Eine Farbe je Rolle – entspricht den Tokens aus global.css. */
export interface Farben {
    /** `--background` */
    background: string;
    /** `--bg-elevated` */
    bgElevated: string;
    /** `--bg-elevated-2` (Inset, Chip, Schiene) */
    bgElevated2: string;
    /** `--input-bg` */
    inputBg: string;
    /** `--card-bg` */
    cardBg: string;
    /** `--line` */
    line: string;
    /** `--ink` (Textfarbe auf Gold) */
    ink: string;
    /** `--text-primary` / `--title-color` */
    textPrimary: string;
    /** `--text-secondary` */
    textSecondary: string;
    /** `--text-muted` */
    textMuted: string;
    /** `--placeholder-color` */
    placeholder: string;
    /** `--off-white` */
    offWhite: string;
    /** `--dark-brown-text` (Text auf Papierflächen) */
    darkBrownText: string;
    /** `--skeleton-base` */
    skeletonBase: string;
    /** `--skeleton-highlight` */
    skeletonHighlight: string;
    /** `--champagner-schein` (Goldschimmer) */
    champagnerSchein: string;
    /** `--gold`, im hellen Design kontrastkorrigiert */
    gold: string;
    /** `--gold-dark` */
    goldDark: string;
    /** `--terracotta`, im hellen Design kontrastkorrigiert */
    terracotta: string;
    /** `--sage` */
    sage: string;
    /** `--sage-dark` */
    sageDark: string;
}

/**
 * Papier und Tinte – die Navigation. Gelten in BEIDEN Designs gleich; die
 * Navigationsleiste bleibt immer Papier (global.css Z. 42–48).
 */
export const PAPIER = {
    paper: "#f0e8d5",
    paperDim: "#e4dac2",
    paperText: "#20252a",
    paperTextSoft: "#f0e8d5",
    paperTextSoftLight: "#f7f1e4",
    paperTextSoftLightHover: "#e8dec8",
    paperTextSoftBorder: "#d7cbb2",
} as const;

const DUNKEL: Farben = {
    background: "#0e0c09",
    bgElevated: "#17130e",
    bgElevated2: "#201b14",
    inputBg: "#201b14",
    cardBg: "#17130e",
    line: "#332b20",
    ink: "#0e0c09",
    textPrimary: "#f3efe3",
    textSecondary: "#b6a88f",
    textMuted: "#7d7361",
    placeholder: "#8a7f6b",
    offWhite: "#f7f1e4",
    darkBrownText: "#20252a",
    skeletonBase: "#16110c",
    skeletonHighlight: "#262018",
    champagnerSchein: "rgba(231, 177, 74, 0.14)",
    gold: "#e7b14a",
    goldDark: "#9a6d20",
    terracotta: "#b84254",
    sage: "#65a88d",
    sageDark: "#39725f",
};

const HELL: Farben = {
    background: "#f4ecdc",
    bgElevated: "#fcf7ec",
    bgElevated2: "#f2e9d7",
    inputBg: "#fdfaf3",
    cardBg: "#fcf7ec",
    line: "#e0d2b8",
    ink: "#fdfaf3",
    textPrimary: "#20252a",
    textSecondary: "#5f5a4e",
    textMuted: "#8a8070",
    placeholder: "#a49a88",
    offWhite: "#fdfaf3",
    darkBrownText: "#20252a",
    skeletonBase: "#e8ddca",
    skeletonHighlight: "#f2e9d7",
    champagnerSchein: "rgba(181, 127, 28, 0.1)",
    gold: "#b57f1c",
    goldDark: "#9a6d20",
    terracotta: "#a53448",
    sage: "#65a88d",
    sageDark: "#39725f",
};

export const PALETTE: Record<DesignName, Farben> = {
    dunkel: DUNKEL,
    hell: HELL,
};

export function farbenFuer(design: DesignName): Farben {
    return PALETTE[design];
}

/**
 * Feste Tinten für die Lernkarte. Die Kartenfläche trägt die Sprachfarbe der
 * Datenbank und bleibt in beiden Designs gleich; Text darauf ist deshalb
 * immer dunkel (global.css: fester Wert, lernen.module.css 294–307).
 */
export const KARTEN_TINTE = {
    /** `--karten-tinte` */
    fest: "#0d171d",
    /** `--karten-tinte-soft` */
    weich: "#1c252b",
    /** Punktraster und Kartenschmuck */
    raste: "rgba(13, 23, 29, 0.05)",
} as const;

/** Radien. Web: `--radius` 16px, Pillen 999px, Felder 12px (global.css Z. 114). */
export const RADIUS = {
    standard: 16,
    pille: 999,
    feld: 12,
    karte: 22,
    kachel: 20,
    klein: 10,
    dialog: 20,
    marke: 24,
} as const;

/** Maße. Web: `--touch: 44px` (global.css Z. 125). */
export const MASS = {
    touch: 44,
    knopf: 50,
    aufdecken: 56,
    feld: 48,
    tabHoehe: 60,
} as const;

/** Abstandsleiter (Vielfache von 4). */
export const ABSTAND = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    riesig: 48,
} as const;

/**
 * Schriftgrößen aus den clamp()-Werten des Webs, auf feste Stufen gebracht.
 * Die Bildschirmbreite entscheidet zur Laufzeit, welche Stufe greift
 * (siehe `dichteAnzeige`).
 */
export const SCHRIFTGROESSE = {
    logo: 30,
    titel: 34,
    ueberschrift: 26,
    unterUeberschrift: 20,
    kartenwort: 40,
    fliess: 16,
    klein: 14,
    label: 12,
    winzig: 11,
} as const;

/** Schattenparameter, aus den CSS-Box-Shadows der global.css. */
export interface Schatten {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
}

export interface SchattenSatz {
    weich: Schatten;
    karte: Schatten;
}

const DUNKEL_SCHATTEN: SchattenSatz = {
    weich: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
        elevation: 6,
    },
    karte: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.34,
        shadowRadius: 32,
        elevation: 10,
    },
};

const HELL_SCHATTEN: SchattenSatz = {
    weich: {
        shadowColor: "#504228",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 4,
    },
    karte: {
        shadowColor: "#504228",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 32,
        elevation: 8,
    },
};

export function schattenFuer(design: DesignName): SchattenSatz {
    return design === "hell" ? HELL_SCHATTEN : DUNKEL_SCHATTEN;
}

/** Ein Verlauf, wie expo-linear-gradient ihn will. */
export interface Verlauf {
    farben: readonly [string, string, ...string[]];
    stellen: readonly [number, number, ...number[]];
    start: { x: number; y: number };
    ende: { x: number; y: number };
}

const ECKE_135 = {
    start: { x: 0, y: 0 },
    ende: { x: 1, y: 1 },
} as const;

/** `--hero-grund`, die Begrüßungskarte. */
export function heroVerlauf(design: DesignName): Verlauf {
    if (design === "hell") {
        return {
            farben: ["#f7efdd", "#ecdfc2", "#e6d5b0"],
            stellen: [0, 0.7, 1],
            ...ECKE_135,
        };
    }
    return {
        farben: ["#2b2116", "#15100b", "#0e0b08"],
        stellen: [0, 0.65, 1],
        ...ECKE_135,
    };
}

/**
 * Der Gold-Verlauf der Primärknöpfe:
 * `linear-gradient(135deg, #eec878 0%, gold 55%, gold-dark 100%)`.
 * Das helle Design nutzt sein eigenes, dunkleres Gold.
 */
export function goldVerlauf(farben: Farben): Verlauf {
    return {
        farben: ["#eec878", farben.gold, farben.goldDark],
        stellen: [0, 0.55, 1],
        ...ECKE_135,
    };
}

/** Terrakotta-Verlauf: `linear-gradient(135deg, terracotta 0%, #943344 100%)`. */
export function terracottaVerlauf(farben: Farben): Verlauf {
    return {
        farben: [farben.terracotta, "#943344"],
        stellen: [0, 1],
        ...ECKE_135,
    };
}
