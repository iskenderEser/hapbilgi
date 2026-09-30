import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { NextRequest, NextResponse } from "next/server";
import { odulSiparisOturumu } from "@/lib/eclub/odulSiparisErisim";
import { depoKataloguGetir } from "@/lib/eclub/depoSunucu";
import { depoTercihleriGecerli, uuidMu } from "@/lib/eclub/depo";
import { uttEczaneYetkisiVarMi } from "@/lib/eclub/uttEczane";
import { rolHatasi, sunucuHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const o = await odulSiparisOturumu(false);
    if (o.yanit) return o.yanit;
    const eczaneId = request.nextUrl.searchParams.get("eczane_id");
    if (eczaneId && !uuidMu(eczaneId)) return validasyonHatasi("Geçersiz eczane.", ["eczane_id"]);
    if (eczaneId && !TUKETICI_ROLLER.includes(o.kisi.rol ?? "")) return rolHatasi("Depo tercihlerini yalnız bağlı UTT yönetebilir.");
    if (eczaneId && !await uttEczaneYetkisiVarMi(o.db, o.kisi.kullanici_id, eczaneId, o.kisi.firma_id)) return rolHatasi("Eczane listenizde değil.");
    const [konumlar, ayar] = await Promise.all([
      depoKataloguGetir(o.db),
      o.db.from("sistem_ayarlari").select("deger").eq("anahtar", "eclub_depo_info_eposta").maybeSingle(),
    ]);
    if (ayar.error) throw new Error(ayar.error.message);
    const infoEposta = typeof ayar.data?.deger === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ayar.data.deger) ? ayar.data.deger : "";
    let tercihler: string[] = [];
    if (eczaneId) {
      const { data, error } = await o.db.from("eclub_eczane_depo_tercihleri").select("depo_sube_id").eq("eczane_id", eczaneId);
      if (error) throw new Error(error.message);
      tercihler = (data ?? []).map((t) => t.depo_sube_id);
    }
    return NextResponse.json({ konumlar, tercihler, info_eposta: infoEposta });
  } catch (error) { return sunucuHatasi(error, "E-Club depo kataloğu"); }
}

export async function PUT(request: NextRequest) {
  try {
    const o = await odulSiparisOturumu(false);
    if (o.yanit) return o.yanit;
    if (!TUKETICI_ROLLER.includes(o.kisi.rol ?? "")) return rolHatasi("Yalnız UTT depo tercihlerini değiştirebilir.");
    const body = await request.json();
    if (!uuidMu(body.eczane_id) || !depoTercihleriGecerli(body.konumlar)) return validasyonHatasi("Eczane ve 1–3 farklı depo/şube seçimi zorunludur.", ["eczane_id", "konumlar"]);
    const { error } = await o.db.rpc("eclub_depo_tercihlerini_kaydet", {
      p_utt_id: o.kisi.kullanici_id, p_eczane_id: body.eczane_id, p_konumlar: body.konumlar,
    });
    if (error) return isKuraluHatasi(error.message);
    return NextResponse.json({ mesaj: "Eczanenin depo tercihleri kaydedildi." });
  } catch (error) { return sunucuHatasi(error, "E-Club depo tercih kaydı"); }
}
