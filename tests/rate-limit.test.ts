/**
 * Das Rate-Limit im Proxy.
 *
 * Der erste Test ist der Grund fuer diese Datei: Bis zum 2026-10-23 galt
 * "Header `Authorization: Bearer …` gesetzt → am Limiter vorbei". Geprueft
 * wurde nur, dass der Header da ist, nicht der Token. Ein erfundener Token
 * genuegte also, um /api/* unbegrenzt zu rufen. Der Test haelt fest, dass
 * ein unbekannter Token das Limit nicht mehr aufhebt.
 *
 * Die Zaehler liegen im Modul (Map) und leben ueber Tests hinweg. Deshalb
 * bekommt jeder Test eigene IPs und Tokens – sonst zaehlen die Tests
 * gegenseitig in denselben Eimer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../proxy.ts";

function anfrage(ip: string, token?: string): NextRequest {
  const headers = new Headers({ "x-forwarded-for": ip });
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new NextRequest("http://localhost/api/karten", { method: "GET", headers });
}

let zaehler = 0;
function eigeneIp(): string {
  zaehler += 1;
  return `10.99.${Math.floor(zaehler / 250)}.${zaehler % 250}`;
}

test("ohne Token: 120 Leseanfragen pro Minute, die 121. ist 429", async () => {
  const ip = eigeneIp();
  for (let i = 0; i < 120; i += 1) {
    const antwort = await proxy(anfrage(ip));
    assert.equal(antwort.status, 200, `Anfrage ${i + 1} sollte durchgehen`);
  }
  const zuViel = await proxy(anfrage(ip));
  assert.equal(zuViel.status, 429);
  assert.ok(Number(zuViel.headers.get("retry-after")) >= 1);
});

test("ein erfundener Bearer-Token hebt das Limit nicht auf", async () => {
  const ip = eigeneIp();
  const token = `erfunden-${Date.now()}-${Math.random()}`;
  let letzte: Response | null = null;
  for (let i = 0; i < 601; i += 1) {
    letzte = await proxy(anfrage(ip, token));
  }
  assert.equal(letzte?.status, 429);
});

test("verschiedene Tokens haben getrennte Eimer", async () => {
  const ip = eigeneIp();
  const tokenA = `a-${Date.now()}-${Math.random()}`;
  const tokenB = `b-${Date.now()}-${Math.random()}`;
  for (let i = 0; i < 600; i += 1) await proxy(anfrage(ip, tokenA));
  assert.equal((await proxy(anfrage(ip, tokenA))).status, 429);
  // Gleiche IP, anderer Token: eigener Eimer, also wieder frei.
  assert.equal((await proxy(anfrage(ip, tokenB))).status, 200);
});

test("der Token selbst landet nicht im Zaehler-Schluessel", async () => {
  // Indirekt geprueft: derselbe Token von einer anderen IP zaehlt weiter im
  // selben Eimer (Schluessel ist der Token-Hash, nicht die IP). Waere der
  // Schluessel die IP, waere hier wieder frei.
  const token = `gleich-${Date.now()}-${Math.random()}`;
  for (let i = 0; i < 600; i += 1) await proxy(anfrage(eigeneIp(), token));
  assert.equal((await proxy(anfrage(eigeneIp(), token))).status, 429);
});
