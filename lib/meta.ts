/**
 * Oeffentliche Basis-URL der Seite, an einer Stelle.
 *
 * metadataBase (app/layout.tsx), robots.ts und sitemap.ts brauchen eine
 * absolute URL, sonst werden Relativ-Links wie "og:image" niemals absolut.
 * In der Entwicklung gibt es keine aussagekraeftige Domain, deshalb steht
 * hier localhost – und fuer das Deploy muss NEXT_PUBLIC_SITE_URL gesetzt
 * sein. Bewusst kein Fallback auf einen geratenen Hostnamen wie
 * "lexio.app": eine erfundene Domain ist im schlimmsten Fall eine echte,
 * falsche URL im Netz.
 *
 * Ein abschliessender Schraegstrich wird entfernt. Setzt jemand die Env als
 * "https://lexio-ruby.vercel.app/", entstuende sonst in sitemap.ts ein
 * doppelter: "https://lexio-ruby.vercel.app//quellen". Google sieht darin
 * eine andere Adresse als "…/quellen" – zwei Eintraege fuer dieselbe Seite,
 * und die kanonische Zuordnung faellt auseinander. Die Bereinigung einmal
 * hier deckt alle drei Verwender ab.
 */
const ROH = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_URL: string = ROH.endsWith("/") ? ROH.slice(0, -1) : ROH;