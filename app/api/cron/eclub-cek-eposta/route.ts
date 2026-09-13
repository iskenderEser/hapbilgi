import { NextRequest, NextResponse } from "next/server";
import { eclubCekEpostaKuyrugunuTuket } from "@/lib/eclub/store/cekEpostaKuyrukIsleyici";
import { sunucuHatasi } from "@/lib/utils/hataIsle";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function isle(request: NextRequest) {
  try {
    if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ hata: "Yetkisiz erişim." }, { status: 401 });
    }
    return NextResponse.json({ ok: true, ...(await eclubCekEpostaKuyrugunuTuket(10)) });
  } catch (error) {
    return sunucuHatasi(error, "E-Club çek e-posta kuyruğu");
  }
}

export async function GET(request: NextRequest) { return isle(request); }
export async function POST(request: NextRequest) { return isle(request); }
