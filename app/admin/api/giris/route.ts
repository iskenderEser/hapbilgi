// app/admin/api/giris/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sifre } = body;

    if (!sifre) return validasyonHatasi("Şifre zorunludur.", ["sifre"]);

    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      return sunucuHatasi(new Error("ADMIN_SECRET tanımlı değil."), "admin giris — env kontrolü");
    }

    if (sifre !== adminSecret) {
      return NextResponse.json({ hata: "Şifre hatalı.", adim: "admin giris — şifre kontrolü" }, { status: 401 });
    }

    return NextResponse.json({ mesaj: "Giriş başarılı." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/giris");
  }
}