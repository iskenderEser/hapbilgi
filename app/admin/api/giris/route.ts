// app/admin/api/giris/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eposta, sifre } = body;

    if (!eposta) return validasyonHatasi("E-posta zorunludur.", ["eposta"]);
    if (!sifre) return validasyonHatasi("Şifre zorunludur.", ["sifre"]);

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: eposta,
      password: sifre,
    });

    if (error || !data.user) {
      return NextResponse.json({ hata: "E-posta veya şifre hatalı.", adim: "admin giris — supabase auth" }, { status: 401 });
    }

    return NextResponse.json({ mesaj: "Giriş başarılı." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/giris");
  }
}