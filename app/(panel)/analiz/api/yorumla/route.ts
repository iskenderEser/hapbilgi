import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { analizRolKategorisi, ROL_ADLARI } from "@/lib/utils/roller";
import { degiskenIdleriSirali, type Kategori, type Kombinasyon } from "@/lib/analiz/paylasilan/kombinasyonlar";
import { promptOlustur, type PromptBaglami, type Rol } from "@/lib/analiz/paylasilan/promptOlustur";
import { analizRpcAyarlari, type AnalizFiltreleri, type AnalizRolKolu } from "@/lib/analiz/paylasilan/sorguYanit";
import { aiYorumAl } from "@/lib/utils/aiIstemci";
import { rolCozucu } from "@/lib/utils/rolCozucu";

type Body = {
  kategori?: Kategori;
  degisken_idleri?: string[];
  filtreler?: AnalizFiltreleri;
  baglam?: Partial<PromptBaglami>;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rolStr = await rolCozucu(adminSupabase, user.id);
    const kategoriRol = analizRolKategorisi(rolStr);
    if (!kategoriRol) return rolHatasi("Analiz sayfasına erişim yetkiniz yok.");

    const body = (await request.json()) as Body;
    const { kategori, degisken_idleri: degiskenIdleri, filtreler = {}, baglam } = body;
    if (!kategori || !["uretim", "tuketim"].includes(kategori)) {
      return validasyonHatasi("kategori 'uretim' veya 'tuketim' olmalıdır.", ["kategori"]);
    }
    if (!Array.isArray(degiskenIdleri) || degiskenIdleri.length === 0 || degiskenIdleri.length > 3) {
      return validasyonHatasi("Bir ile üç arasında değişken seçilmelidir.", ["degisken_idleri"]);
    }

    const sirali = degiskenIdleriSirali(degiskenIdleri);
    if (new Set(sirali).size !== sirali.length) {
      return validasyonHatasi("Aynı değişken birden fazla seçilemez.", ["degisken_idleri"]);
    }

    const rolKolu: AnalizRolKolu = kategoriRol === "yonetici"
      ? "yonetici"
      : kategoriRol === "uretici"
        ? "uretici"
        : rolStr === "bm" ? "bm" : "tm";
    if ((rolKolu === "tm" || rolKolu === "bm") && kategori === "uretim") {
      return validasyonHatasi("Bu rol için üretim analizi kullanılamaz.", ["kategori"]);
    }

    const kombinasyonTablosu = kategori === "uretim" ? "analiz_uretim_kombinasyonlari" : "analiz_tuketim_kombinasyonlari";
    const degiskenTablosu = kategori === "uretim" ? "analiz_uretim_degiskenleri" : "analiz_tuketim_degiskenleri";
    const [kombinasyonYanit, adYanit] = await Promise.all([
      adminSupabase.from(kombinasyonTablosu).select("*").eq("boyut", sirali.length).contains("degisken_idleri", sirali).containedBy("degisken_idleri", sirali).maybeSingle(),
      adminSupabase.from(degiskenTablosu).select("degisken_id, ad").in("degisken_id", sirali),
    ]);
    if (kombinasyonYanit.error) return hataYaniti("Kombinasyon doğrulanamadı.", kombinasyonTablosu, kombinasyonYanit.error);
    if (adYanit.error) return hataYaniti("Değişken adları alınamadı.", degiskenTablosu, adYanit.error);
    const kombinasyon = kombinasyonYanit.data as Kombinasyon | null;
    if (!kombinasyon) return validasyonHatasi("Seçilen metrik kombinasyonu tanımlı değil.", ["degisken_idleri"]);

    // Rakamlar istemciden alınmaz; aynı filtrelerle yetkili sunucu katmanında yeniden hesaplanır.
    const rpc = analizRpcAyarlari(rolKolu, kategori, user.id, filtreler);
    const { data: rpcData, error: rpcHatasi } = await adminSupabase.rpc(rpc.ad, rpc.parametreler);
    if (rpcHatasi) return hataYaniti("AI yorumu için kanonik metrikler alınamadı.", rpc.ad, rpcHatasi);
    const satir = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as Record<string, unknown> | null;
    if (!satir) return hataYaniti("Analiz fonksiyonu sonuç döndürmedi.", rpc.ad);

    const sonuclar: Record<string, number> = {};
    for (const id of sirali) {
      const deger = satir[id];
      if (typeof deger !== "number" && typeof deger !== "string") {
        return hataYaniti("Seçilen metrik kanonik sonuçta bulunamadı.", `${rpc.ad}.${id}`);
      }
      sonuclar[id] = Number(deger);
    }
    const adlar = Object.fromEntries((adYanit.data ?? []).map((row) => [row.degisken_id, row.ad]));
    const promptRol: Rol = kategoriRol === "yonetici" ? "yonetici" : kategoriRol === "uretici" ? "uretici" : rolStr === "bm" ? "bm" : "tm";
    const tamBaglam: PromptBaglami = {
      rol: promptRol,
      rol_ad: ROL_ADLARI[rolStr] ?? rolStr,
      scope_aciklama: baglam?.scope_aciklama,
      periyot_etiketi: baglam?.periyot_etiketi,
      urun_adi: baglam?.urun_adi ?? null,
      egitim_turu: baglam?.egitim_turu ?? null,
      takim_adi: baglam?.takim_adi ?? null,
      bolge_adi: baglam?.bolge_adi ?? null,
      utt_adi: baglam?.utt_adi ?? null,
    };

    const prompt = promptOlustur({ kategori, kombinasyon, degisken_adlari: adlar, sonuclar, baglam: tamBaglam });
    let yorum: string;
    try {
      yorum = await aiYorumAl(prompt);
    } catch (error) {
      return hataYaniti("AI yorum servisinden cevap alınamadı.", "aiYorumAl", error instanceof Error ? { message: error.message } : { message: String(error) });
    }
    return NextResponse.json({ yorum, tamamlayici_mi: kombinasyon.tamamlayici_mi }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "POST /analiz/api/yorumla");
  }
}
