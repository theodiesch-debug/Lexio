import { redirect } from "next/navigation";
import { mitUserOder401 } from "@/lib/supabase/user";
import KopierenClient from "./kopieren-client";

type Ctx = { params: Promise<{ token: string }> };

export default async function TeilenKopierenSeite({ params }: Ctx) {
  const { token } = await params;
  const { user } = await mitUserOder401();
  if (!user) {
    redirect(`/anmelden?weiter=${encodeURIComponent(`/teilen/${token}/kopieren`)}`);
  }
  return <KopierenClient token={token} />;
}
