// app/eczanem/api/videolar/route.ts
// Müşteri dijital kanal video listesi: kendisine gönderilen videolar
// (eczanem_gonderimler) + kendi ilerlemesi + müşteri-geneli etkileşim sayıları
// + hiyerarşik sidebar veri sözleşmesi (eczane -> firma -> urun -> yayin -> arac).
// Global sayılar yalnız müşteri ana sayfasındaki keşif raflarını sıralar; firma,
// UTT veya mutabakat raporlarına bağlanmaz.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { eczaneAdMap } from "@/lib/eczanem/gonderim";
import { ogrenmeAraciBayraklari } from "@/lib/ogrenmeAraci/bayraklar";
import { yayinThumbnailUrlCoz } from "@/lib/ogrenmeAraci/yayinThumbnail";
import type {
  EczanemAracTuru,
  EczanemMusteriVideo,
  EczanemSidebarAgaci,
  EczanemSidebarArac,
  EczanemVideolarYaniti,
} from "../../_types";

interface YayinDetaySatiri {
  yayin_id: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  arac_kapak_yolu?: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  video_basi_soru_sayisi: number | null;
  durum: string | null;
  talep_no: number | null;
  firma_adi: string | null;
  firma_id: string | null;
  arac_id: string | null;
  arac_turu: EczanemAracTuru;
}

interface EtkilesimSatiri {
  yayin_id: string;
  begeni_sayisi: number | string | null;
  favori_sayisi: number | string | null;
  izlenme_sayisi: number | string | null;
  begeni_mi: boolean | null;
  favori_mi: boolean | null;
}

function yayinBasligiBelirle(y: YayinDetaySatiri, urunId: string | null): string {
  const teknik = y.teknik_adi && y.teknik_adi !== "-" ? y.teknik_adi.trim() : null;
  const urun = y.urun_adi && y.urun_adi !== "-" ? y.urun_adi.trim() : null;

  if (urunId) {
    return teknik || urun || "Öğrenme Yayını";
  }
  if (urun && teknik && urun !== teknik) {
    return `${urun} — ${teknik}`;
  }
  return urun || teknik || "Öğrenme Yayını";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    // Yalnız hâlen aktif üyeliğin bulunduğu eczanelerin gönderimleri görünür.
    const { data: uyelikler, error: uyelikError } = await adminSupabase
      .from("eczanem_uyelikler")
      .select("eczane_id")
      .eq("musteri_id", musteriId)
      .eq("aktif_mi", true)
      .in("eczane_id", kimlik.eczaneIdler!);
    if (uyelikError) return hataYaniti("Eczane üyelikleri çekilemedi.", "eczanem_uyelikler SELECT — aktif video kapısı", uyelikError);

    const aktifEczaneIdler = [...new Set((uyelikler ?? []).map((u) => u.eczane_id))];
    if (aktifEczaneIdler.length === 0) {
      const bosYanit: EczanemVideolarYaniti = { videolar: [], agac: [] };
      return NextResponse.json(bosYanit, { status: 200 });
    }

    const { data: gonderimler, error: gError } = await adminSupabase
      .from("eczanem_gonderimler")
      .select("gonderim_id, yayin_id, eczane_id, arac_id, arac_turu, created_at")
      .eq("musteri_id", musteriId)
      .in("eczane_id", aktifEczaneIdler)
      .order("created_at", { ascending: false });

    if (gError) return hataYaniti("Videolar çekilemedi.", "eczanem_gonderimler SELECT — musteri_id", gError);
    const rows = gonderimler ?? [];

    // Yayın detayları ve künye bilgileri (yalnız yayında olanları göster)
    const yayinIdler = [...new Set(rows.map((g) => g.yayin_id))];
    const yayinMap = new Map<string, YayinDetaySatiri>();
    const kunyeUrunMap = new Map<string, string | null>();

    if (yayinIdler.length > 0) {
      const [{ data: yayinlar, error: yayinError }, { data: kunyeler, error: kunyeError }] = await Promise.all([
        adminSupabase
          .from("v_yayin_detay")
          .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, arac_kapak_yolu, video_puani, soru_puani, video_basi_soru_sayisi, durum, talep_no, firma_adi, firma_id, arac_id, arac_turu")
          .in("yayin_id", yayinIdler)
          .in("arac_turu", Object.entries(ogrenmeAraciBayraklari()).filter(([, acik]) => acik).map(([tur]) => tur))
          // Görünürlük kapısı (Faz 1): süresi hazır olmayan video izleyiciye gösterilmez.
          .or("arac_turu.in.(gorsel,flip_pdf),video_suresi_saniye.gt.0"),
        adminSupabase
          .from("v_yayin_kunye")
          .select("yayin_id, urun_id")
          .in("yayin_id", yayinIdler),
      ]);

      if (yayinError) return hataYaniti("Video yayın bilgileri çekilemedi.", "v_yayin_detay SELECT — müşteri videoları", yayinError);
      if (kunyeError) return hataYaniti("Yayın künye bilgileri çekilemedi.", "v_yayin_kunye SELECT — müşteri videoları", kunyeError);

      for (const y of yayinlar ?? []) yayinMap.set(y.yayin_id, y as YayinDetaySatiri);
      for (const k of kunyeler ?? []) kunyeUrunMap.set(k.yayin_id, (k.urun_id as string | null) ?? null);
    }

    // Durum yayın bazında değil gönderim bazındadır; aynı yayın iki eczaneden
    // geldiğinde her eczanenin izleme, soru ve puan akışı bağımsız kalır.
    const gonderimIdler = rows.map((g) => g.gonderim_id);
    const { data: izlemeler, error: izlemeError } = gonderimIdler.length > 0
      ? await adminSupabase
        .from("eczanem_izleme_kayitlari")
        .select("gonderim_id, tamamlandi_mi, cevaplandi_mi, izleme_baslangic, izleme_bitis, son_konum_saniye")
        .eq("musteri_id", musteriId)
        .in("gonderim_id", gonderimIdler)
      : { data: [], error: null };
    if (izlemeError) return hataYaniti("İzleme durumları çekilemedi.", "eczanem_izleme_kayitlari SELECT — gönderim durumu", izlemeError);

    const izlemeDurumu = new Map<string, { tamamlandi_mi: boolean; cevaplandi_mi: boolean; izleme_baslangic: string | null; izleme_bitis: string | null; son_konum_saniye: number }>();
    for (const izleme of izlemeler ?? []) {
      izlemeDurumu.set(izleme.gonderim_id, {
        tamamlandi_mi: Boolean(izleme.tamamlandi_mi),
        cevaplandi_mi: Boolean(izleme.cevaplandi_mi),
        izleme_baslangic: izleme.izleme_baslangic ?? null,
        izleme_bitis: izleme.izleme_bitis ?? null,
        son_konum_saniye: Number(izleme.son_konum_saniye ?? 0),
      });
    }

    const { data: etkilesimler, error: etkilesimError } = yayinIdler.length > 0
      ? await adminSupabase.rpc("get_eczanem_musteri_video_etkilesimleri", {
        p_musteri_id: musteriId,
        p_yayin_idler: yayinIdler,
      })
      : { data: [], error: null };
    if (etkilesimError) return hataYaniti("Video etkileşimleri çekilemedi.", "get_eczanem_musteri_video_etkilesimleri RPC", etkilesimError);
    const etkilesimMap = new Map<string, EtkilesimSatiri>();
    for (const hamEtkilesim of etkilesimler ?? []) {
      const etkilesim = hamEtkilesim as EtkilesimSatiri;
      etkilesimMap.set(etkilesim.yayin_id, etkilesim);
    }
    const eczaneAdlari = await eczaneAdMap(adminSupabase, aktifEczaneIdler);

    // 1. Yayın detaylarını, geçerli gönderimleri oluşturmadan önce doğrula.
    for (const y of yayinMap.values()) {
      if (y.durum !== "yayinda") continue;

      // 2. Müşterinin erişim kapsamı dışındaki firmalara ait yayınları normal şekilde görünmez bırak.
      if (y.firma_id && !kimlik.firmaIdler!.includes(y.firma_id)) {
        continue;
      }

      // 3. Müşterinin erişim kapsamındaki bir yayında firma_id veya arac_id eksikse
      //    mevcut hataYaniti yapısıyla veri bütünlüğü hatası döndür.
      if (!y.firma_id) {
        return hataYaniti(
          "Yayın firma kimliği bulunamadı.",
          `v_yayin_detay firma_id veri bütünlüğü kontrolü — yayin_id: ${y.yayin_id}`
        );
      }
      if (!y.arac_id) {
        return hataYaniti(
          "Yayın öğrenme aracı kimliği bulunamadı.",
          `v_yayin_detay arac_id veri bütünlüğü kontrolü — yayin_id: ${y.yayin_id}`
        );
      }

      // 4. Eksik künye kaydı ile gerçek urun_id = null ayrımını aynen koru.
      if (!kunyeUrunMap.has(y.yayin_id)) {
        return hataYaniti(
          "Yayın künye kaydı bulunamadı.",
          `v_yayin_kunye veri bütünlüğü kontrolü — yayin_id: ${y.yayin_id}`
        );
      }
    }

    // Gönderim düzeyinde arac_id bütünlüğü kontrolü
    for (const g of rows) {
      const y = yayinMap.get(g.yayin_id);
      if (!y || y.durum !== "yayinda") continue;
      if (y.firma_id && !kimlik.firmaIdler!.includes(y.firma_id)) continue;

      if (!g.arac_id) {
        return hataYaniti(
          "Yayın öğrenme aracı kimliği bulunamadı.",
          `eczanem_gonderimler arac_id veri bütünlüğü kontrolü — yayin_id: ${g.yayin_id}`
        );
      }
    }

    // 5. Doğrulama tamamlandıktan sonra gecerliGonderimler listesini oluştur.
    const gecerliGonderimler = rows.filter((g) => {
      const yayin = yayinMap.get(g.yayin_id);
      return yayin?.durum === "yayinda"
        && !!yayin.firma_id
        && kimlik.firmaIdler!.includes(yayin.firma_id)
        && g.arac_id === yayin.arac_id
        && g.arac_turu === yayin.arac_turu;
    });

    const videolar: EczanemMusteriVideo[] = gecerliGonderimler.map((g) => {
      const y = yayinMap.get(g.yayin_id)!;
      const izleme = izlemeDurumu.get(g.gonderim_id);
      const etkilesim = etkilesimMap.get(g.yayin_id);
      const urunId = kunyeUrunMap.get(g.yayin_id)!;

      return {
        gonderim_id: g.gonderim_id,
        yayin_id: g.yayin_id,
        eczane_id: g.eczane_id,
        eczane_adi: eczaneAdlari.get(g.eczane_id) ?? "(isimsiz eczane)",
        talep_no: y.talep_no ?? null,
        firma_id: y.firma_id!,
        firma_adi: y.firma_adi ?? null,
        urun_id: urunId,
        urun_adi: y.urun_adi ?? "-",
        teknik_adi: y.teknik_adi ?? "-",
        video_url: y.video_url ?? null,
        arac_id: g.arac_id,
        arac_turu: g.arac_turu,
        thumbnail_url: yayinThumbnailUrlCoz(y),
        video_puani: y.video_puani ?? null,
        soru_puani: y.soru_puani ?? null,
        soru_sayisi: y.video_basi_soru_sayisi ?? null,
        gelis_tarihi: g.created_at,
        izleme_basladi: Boolean(izleme),
        izlendi: izleme?.tamamlandi_mi ?? false,
        cevaplandi: izleme?.cevaplandi_mi ?? false,
        izleme_baslangic: izleme?.izleme_baslangic ?? null,
        izleme_bitis: izleme?.izleme_bitis ?? null,
        son_konum_saniye: izleme?.son_konum_saniye ?? 0,
        begeni_sayisi: Number(etkilesim?.begeni_sayisi ?? 0),
        favori_sayisi: Number(etkilesim?.favori_sayisi ?? 0),
        izlenme_sayisi: Number(etkilesim?.izlenme_sayisi ?? 0),
        begeni_mi: Boolean(etkilesim?.begeni_mi),
        favori_mi: Boolean(etkilesim?.favori_mi),
      };
    });

    // Hiyerarşik Sidebar Veri Sözleşmesi Ağacı
    // eczane_id -> firma_id -> urun_id (nullable) -> yayin_id -> arac_id
    type TempArac = EczanemSidebarArac;
    type TempYayin = { yayin_id: string; yayin_basligi: string; aracMap: Map<string, TempArac> };
    type TempUrun = { urun_id: string | null; urun_adi: string | null; yayinMap: Map<string, TempYayin> };
    type TempFirma = { firma_id: string; firma_adi: string; urunMap: Map<string, TempUrun> };
    type TempEczane = { eczane_id: string; eczane_adi: string; firmaMap: Map<string, TempFirma> };

    const agacEczaneMap = new Map<string, TempEczane>();

    // Aktif eczaneler önceden tanımlanır; böylece müşteri üyelik kapsamı eksiksiz korunur
    for (const eczaneId of aktifEczaneIdler) {
      agacEczaneMap.set(eczaneId, {
        eczane_id: eczaneId,
        eczane_adi: eczaneAdlari.get(eczaneId) ?? "(isimsiz eczane)",
        firmaMap: new Map(),
      });
    }

    // Geçerli gönderimlerden ağaç düğümleri oluşturulur ve tekilleştirilir
    for (const g of gecerliGonderimler) {
      const y = yayinMap.get(g.yayin_id)!;
      const eczane = agacEczaneMap.get(g.eczane_id);
      if (!eczane) continue;

      // 1. Düzey: Firma tekilleştirme
      let firma = eczane.firmaMap.get(y.firma_id!);
      if (!firma) {
        firma = {
          firma_id: y.firma_id!,
          firma_adi: y.firma_adi || "Firma",
          urunMap: new Map(),
        };
        eczane.firmaMap.set(y.firma_id!, firma);
      }

      // 2. Düzey: Ürün tekilleştirme (Nullable: urun_id null ise "__genel__" anahtarında toplanır)
      const rawUrunId = kunyeUrunMap.get(g.yayin_id)!;
      const urunKey = rawUrunId ?? "__genel__";
      let urun = firma.urunMap.get(urunKey);
      if (!urun) {
        urun = {
          urun_id: rawUrunId,
          urun_adi: rawUrunId ? (y.urun_adi ?? null) : null,
          yayinMap: new Map(),
        };
        firma.urunMap.set(urunKey, urun);
      }

      // 3. Düzey: Yayın tekilleştirme
      let yayin = urun.yayinMap.get(g.yayin_id);
      if (!yayin) {
        yayin = {
          yayin_id: g.yayin_id,
          yayin_basligi: yayinBasligiBelirle(y, rawUrunId),
          aracMap: new Map(),
        };
        urun.yayinMap.set(g.yayin_id, yayin);
      }

      // 4. Düzey: Öğrenme aracı tekilleştirme
      if (!yayin.aracMap.has(g.arac_id)) {
        yayin.aracMap.set(g.arac_id, {
          arac_id: g.arac_id,
          arac_turu: g.arac_turu,
        });
      }
    }

    const agac: EczanemSidebarAgaci = Array.from(agacEczaneMap.values())
      .map((eczane) => ({
        eczane_id: eczane.eczane_id,
        eczane_adi: eczane.eczane_adi,
        firmalar: Array.from(eczane.firmaMap.values())
          .map((firma) => ({
            firma_id: firma.firma_id,
            firma_adi: firma.firma_adi,
            urunler: Array.from(firma.urunMap.values())
              .map((urun) => ({
                urun_id: urun.urun_id,
                urun_adi: urun.urun_adi,
                yayinlar: Array.from(urun.yayinMap.values())
                  .map((yayin) => ({
                    yayin_id: yayin.yayin_id,
                    yayin_basligi: yayin.yayin_basligi,
                    araclar: Array.from(yayin.aracMap.values())
                      .sort((a, b) => a.arac_turu.localeCompare(b.arac_turu, "tr")),
                  }))
                  .sort((a, b) => a.yayin_basligi.localeCompare(b.yayin_basligi, "tr")),
              }))
              .sort((a, b) => {
                if (a.urun_id === null) return 1;
                if (b.urun_id === null) return -1;
                return (a.urun_adi ?? "").localeCompare(b.urun_adi ?? "", "tr");
              }),
          }))
          .sort((a, b) => a.firma_adi.localeCompare(b.firma_adi, "tr")),
      }))
      .sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr"));

    const yanit: EczanemVideolarYaniti = { videolar, agac };
    return NextResponse.json(yanit, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/api/videolar");
  }
}
