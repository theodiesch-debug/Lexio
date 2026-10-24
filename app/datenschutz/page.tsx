import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Datenschutzerklärung | Lexio",
    robots: { index: false, follow: false },
};

export default function Datenschutz() {
    return (
        <main className="seite">
            <article className="artikel">
                <h1>Datenschutzerklärung</h1>
                <p>Stand: 24. Oktober 2026</p>

                <h2>1. Verantwortlicher</h2>
                <p>
                    Theo Diesch
                    <br />
                    E-Mail: theodiesch@gmail.com
                </p>

                <h2>2. Hosting und Infrastruktur</h2>
                <p>
                    Diese Website wird bei Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA
                    gehostet. Vercel speichert dabei Zugriffsdaten in Server-Logfiles (IP-Adresse,
                    Zeitpunkt, aufgerufene Seite, User-Agent). Weitere Informationen:{" "}
                    <a href="https://vercel.com/legal/privacy-policy">Vercel Privacy Policy</a>.
                </p>

                <h2>3. Datenbank und Authentifizierung</h2>
                <p>
                    Für Anmeldung, Speicherung von Vokabelsets und Lernfortschritt nutzen wir
                    Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992. Dabei werden
                    E-Mail-Adresse, Authentifizierungsdaten und die von dir angelegten Inhalte
                    gespeichert. Die Datenverarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
                    DSGVO (Vertragserfüllung). Weitere Informationen:{" "}
                    <a href="https://supabase.com/privacy">Supabase Privacy Policy</a>.
                </p>

                <h2>4. KI-Funktionen (optional)</h2>
                <p>
                    Für die Foto-Import-/OCR-Funktion kann Groq Inc., 3210 El Camino Real, Palo Alto,
                    CA 94306, USA genutzt werden. Dabei werden nur die für die Texterkennung
                    erforderlichen Bilddaten übermittelt. Die Nutzung erfolgt nur auf deinen
                    ausdrücklichen Wunsch. Weitere Informationen:{" "}
                    <a href="https://wow.groq.com/privacy-policy/">Groq Privacy Policy</a>.
                </p>

                <h2>5. Push-Benachrichtigungen (optional)</h2>
                <p>
                    Falls du Push-Benachrichtigungen aktivierst, wird dein Browser-/Geräte-Token
                    gespeichert, um dir Erinnerungen schicken zu können. Du kannst Push jederzeit
                    in den Einstellungen deines Browsers bzw. Geräts deaktivieren.
                </p>

                <h2>6. Cookies</h2>
                <p>
                    Lexio setzt technisch notwendige Cookies/Speicher für die Anmeldung und
                    Sitzung. Tracking-Cookies werden nicht eingesetzt.
                </p>

                <h2>7. Deine Rechte</h2>
                <p>
                    Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
                    Verarbeitung, Datenübertragbarkeit sowie Widerspruch. Du kannst dich auch
                    bei einer Aufsichtsbehörde beschweren. Für Anliegen wende dich an:
                    theodiesch@gmail.com
                </p>

                <h2>8. Löschung des Kontos</h2>
                <p>
                    Über die Einstellungen in Lexio oder per E-Mail an theodiesch@gmail.com kannst
                    du die Löschung deines Kontos und aller damit verbundenen Daten beantragen.
                </p>
            </article>
        </main>
    );
}
