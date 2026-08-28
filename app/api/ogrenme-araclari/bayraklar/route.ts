import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ogrenmeAraciBayraklari } from "@/lib/ogrenmeAraci/bayraklar";
import { yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return yetkiHatasi();
  return NextResponse.json({ bayraklar: ogrenmeAraciBayraklari() }, { headers: { "Cache-Control": "private, no-store" } });
}
