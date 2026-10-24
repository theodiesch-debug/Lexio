import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Impressum | Lexio",
    robots: { index: false, follow: false },
};

export default function Impressum() {
    return (
        <main className="seite">
            <article className="artikel">
                <h1>Impressum</h1>
                <h2>Angaben gemäß § 5 DDG</h2>
                <p>
                    Theo Diesch
                    <br />
                    theodiesch@gmail.com
                </p>
                <h2>Kontakt</h2>
                <p>E-Mail: theodiesch@gmail.com</p>
            </article>
        </main>
    );
}
