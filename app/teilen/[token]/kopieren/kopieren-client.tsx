"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { holeJson } from "@/lib/api-client";

export default function KopierenClient({ token }: { token: string }) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const antwort = await holeJson<{ set: { slug: string } }>(`/api/teilen/${encodeURIComponent(token)}/kopieren`, undefined, { method: "POST" });
        if (!aktiv) return;
        router.replace(`/wortschatz/${encodeURIComponent(antwort.set.slug)}`);
      } catch (e) {
        if (!aktiv) return;
        setFehler(e instanceof Error ? e.message : "Set konnte nicht kopiert werden.");
      }
    })();
    return () => { aktiv = false; };
  }, [router, token]);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <h1 style={{ fontFamily: "var(--serif, Georgia, serif)", marginBottom: 12 }}>Set wird kopiert…</h1>
        <p style={{ color: "var(--text-secondary, #3f4d57)" }}>
          {fehler ?? "Du wirst gleich zu deinem eigenen Set weitergeleitet."}
        </p>
      </div>
    </main>
  );
}
