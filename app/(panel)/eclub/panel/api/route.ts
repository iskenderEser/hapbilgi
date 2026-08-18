// app/eclub/panel/api/route.ts
//
// E-Club kişi paneli (eczacı/teknisyen) — kendine gelen başlamış önerileri döndürür.
// Kişi auth_user_id ile tanınır → kisi_id bulunur → eclub_oneri_kayitlari'ndan
// Aktif ve süresi geçmiş öneriler çekilir, yayın detayı v_yayin_detay'dan
// AYRI sorguyla alınıp Map ile birleştirilir (view'a nested join yapılmaz —
// İŞ 2.4 öneri API'siyle aynı desen).
// İzleme (İŞ 2.5) henüz yok; izlendi_mi öneri kaydından gelir (şimdilik false).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI, eclubKisiHedefRolu, hedefRolleriOku, type HedefRoller } from "@/lib/utils/roller";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { eclubOneriDurumu } from "@/lib/eclub/izlemeKurali";
import { eclubStoreFirmaBakiye } from "@/lib/eclub/store/eclubStoreBakiye";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // auth_user_id → eclub_kisiler (kimlik)
    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol, ad, soyad")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT — auth_user_id", kisiError);
    if (!kisi) return rolHatasi("Bu sayfa yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const simdi = new Date().toISOString();

    // Henüz başlamayan öneri gösterilmez; süresi geçen, puansız tekrar izleme için korunur.
    const { data: oneriler, error: oneriError } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_id, yayin_id, oneri_baslangic, oneri_bitis, izlendi_mi, created_at")
      .eq("kisi_id", kisi.kisi_id)
      .lte("oneri_baslangic", simdi)
      .order("created_at", { ascending: false });

    if (oneriError) return hataYaniti("Öneriler çekilemedi.", "eclub_oneri_kayitlari SELECT — kisi_id", oneriError);

    const [izlemeSonucu, puanSonucu, kayipSonucu, dogruSonucu, yanlisSonucu, firmaBakiyeleri] = await Promise.all([
      adminSupabase
        .from("eclub_izleme_kayitlari")
        .select("izleme_id, oneri_id, yayin_id, tamamlandi_mi, izleme_baslangic, izleme_bitis, created_at")
        .eq("kisi_id", kisi.kisi_id),
      adminSupabase
        .from("eclub_kazanilan_puanlar")
        .select("yayin_id, izleme_id, puan_turu, puan")
        .eq("kisi_id", kisi.kisi_id),
      adminSupabase
        .from("eclub_ileri_sarma_kayitlari")
        .select("yayin_id, izleme_id, kaybedilen_puan")
        .eq("kisi_id", kisi.kisi_id),
      adminSupabase
        .from("eclub_dogru_cevap_kayitlari")
        .select("yayin_id, izleme_id")
        .eq("kisi_id", kisi.kisi_id),
      adminSupabase
        .from("eclub_yanlis_cevap_kayitlari")
        .select("yayin_id, izleme_id")
        .eq("kisi_id", kisi.kisi_id),
      eclubStoreFirmaBakiye(adminSupabase, kisi.kisi_id),
    ]);
    if (izlemeSonucu.error) return hataYaniti("İzleme özeti alınamadı.", "eclub_izleme_kayitlari SELECT — kişi paneli", izlemeSonucu.error);
    if (puanSonucu.error) return hataYaniti("Puan özeti alınamadı.", "eclub_kazanilan_puanlar SELECT — kişi paneli", puanSonucu.error);
    if (kayipSonucu.error) return hataYaniti("İleri sarma kaybı alınamadı.", "eclub_ileri_sarma_kayitlari SELECT — kişi paneli", kayipSonucu.error);
    if (dogruSonucu.error) return hataYaniti("Doğru cevap özeti alınamadı.", "eclub_dogru_cevap_kayitlari SELECT — kişi paneli", dogruSonucu.error);
    if (yanlisSonucu.error) return hataYaniti("Yanlış cevap özeti alınamadı.", "eclub_yanlis_cevap_kayitlari SELECT — kişi paneli", yanlisSonucu.error);

    // Yayın detaylarını öneri + tarihsel puan kapsamı için toplu çek.
    interface YayinDetay {
      urun_adi: string | null; teknik_adi: string | null;
      video_url: string | null; thumbnail_url: string | null; icerik_turu: string | null;
      talep_no: number | null; firma_adi: string | null;
      firma_id: string | null; hedef_roller: HedefRoller; durum: string | null;
      video_puani: number | null; soru_puani: number | null; video_basi_soru_sayisi: number | null;
    }
    const puanlar = puanSonucu.data ?? [];
    const yayinIds = [...new Set([
      ...(oneriler ?? []).map((o) => (o as { yayin_id: string }).yayin_id),
      ...puanlar.map((puan) => puan.yayin_id),
    ])];
    const yayinMap = new Map<string, YayinDetay>();
    if (yayinIds.length > 0) {
      const { data: yayinlar, error: yayinError } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, icerik_turu, talep_no, firma_id, firma_adi, hedef_roller, durum, video_puani, soru_puani, video_basi_soru_sayisi")
        .in("yayin_id", yayinIds);
      if (yayinError) return hataYaniti("Yayın detayları alınamadı.", "v_yayin_detay SELECT — E-Club panel", yayinError);
      for (const y of yayinlar ?? []) {
        const yy = y as { yayin_id: string } & YayinDetay;
        yayinMap.set(yy.yayin_id, {
          urun_adi: yy.urun_adi, teknik_adi: yy.teknik_adi,
          video_url: yy.video_url, thumbnail_url: yy.thumbnail_url, icerik_turu: yy.icerik_turu,
          talep_no: yy.talep_no, firma_adi: yy.firma_adi,
          firma_id: yy.firma_id, hedef_roller: hedefRolleriOku(yy), durum: yy.durum,
          video_puani: yy.video_puani, soru_puani: yy.soru_puani,
          video_basi_soru_sayisi: yy.video_basi_soru_sayisi,
        });
      }
    }

    const [eclubBegeniSonucu, eclubFavoriSonucu] = await Promise.all([
      yayinIds.length > 0
        ? adminSupabase.from("eclub_video_begeniler").select("yayin_id, kisi_id").in("yayin_id", yayinIds)
        : Promise.resolve({ data: [], error: null }),
      yayinIds.length > 0
        ? adminSupabase.from("eclub_video_favoriler").select("yayin_id, kisi_id").in("yayin_id", yayinIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (eclubBegeniSonucu.error) return hataYaniti("Beğeni bilgileri alınamadı.", "eclub_video_begeniler SELECT — E-Club panel", eclubBegeniSonucu.error);
    if (eclubFavoriSonucu.error) return hataYaniti("Favori bilgileri alınamadı.", "eclub_video_favoriler SELECT — E-Club panel", eclubFavoriSonucu.error);
    const sayimHaritasi = (satirlar: Array<{ yayin_id: string }>) => {
      const harita = new Map<string, number>();
      for (const satir of satirlar) harita.set(satir.yayin_id, (harita.get(satir.yayin_id) ?? 0) + 1);
      return harita;
    };
    const begeniler = sayimHaritasi((eclubBegeniSonucu.data ?? []) as Array<{ yayin_id: string }>);
    const favoriler = sayimHaritasi((eclubFavoriSonucu.data ?? []) as Array<{ yayin_id: string }>);
    const begenilenler = new Set((eclubBegeniSonucu.data ?? []).filter((satir) => satir.kisi_id === kisi.kisi_id).map((satir) => satir.yayin_id));
    const favorilenenler = new Set((eclubFavoriSonucu.data ?? []).filter((satir) => satir.kisi_id === kisi.kisi_id).map((satir) => satir.yayin_id));

    const izlemeOneriHaritasi = new Map(
      (izlemeSonucu.data ?? []).map((izleme) => [izleme.izleme_id, izleme.oneri_id]),
    );
    const izlemeDetayHaritasi = new Map(
      (izlemeSonucu.data ?? []).filter((izleme) => izleme.oneri_id).map((izleme) => [izleme.oneri_id!, izleme]),
    );
    const oneriPerformansi = new Map<string, { izleme: number; cevaplama: number; kayip: number; dogru: number; yanlis: number }>();
    const performans = (oneriId: string) => {
      const mevcut = oneriPerformansi.get(oneriId) ?? { izleme: 0, cevaplama: 0, kayip: 0, dogru: 0, yanlis: 0 };
      oneriPerformansi.set(oneriId, mevcut);
      return mevcut;
    };
    for (const puan of puanlar) {
      const oneriId = izlemeOneriHaritasi.get(puan.izleme_id);
      if (!oneriId) continue;
      const kayit = performans(oneriId);
      if (puan.puan_turu === "izleme") kayit.izleme += Number(puan.puan ?? 0);
      if (puan.puan_turu === "cevaplama") kayit.cevaplama += Number(puan.puan ?? 0);
    }
    for (const kayip of kayipSonucu.data ?? []) {
      const oneriId = izlemeOneriHaritasi.get(kayip.izleme_id);
      if (oneriId) performans(oneriId).kayip += Number(kayip.kaybedilen_puan ?? 0);
    }
    for (const cevap of dogruSonucu.data ?? []) {
      const oneriId = izlemeOneriHaritasi.get(cevap.izleme_id);
      if (oneriId) performans(oneriId).dogru += 1;
    }
    for (const cevap of yanlisSonucu.data ?? []) {
      const oneriId = izlemeOneriHaritasi.get(cevap.izleme_id);
      if (oneriId) performans(oneriId).yanlis += 1;
    }

    const sonuc = (oneriler ?? []).flatMap((o) => {
      const oo = o as { oneri_id: string; yayin_id: string; oneri_baslangic: string; oneri_bitis: string; izlendi_mi: boolean; created_at: string };
      const y = yayinMap.get(oo.yayin_id);
      // İkinci güvenlik filtresi: hedef rol ve yayın durumu kişi panelinde de doğrulanır.
      const hedefRol = eclubKisiHedefRolu(kisi.rol);
      if (!y || !hedefRol || !y.hedef_roller.includes(hedefRol) || y.durum !== "yayinda") return [];
      const kazanilan = oneriPerformansi.get(oo.oneri_id) ?? { izleme: 0, cevaplama: 0, kayip: 0, dogru: 0, yanlis: 0 };
      const izleme = izlemeDetayHaritasi.get(oo.oneri_id);
      return [{
        oneri_id: oo.oneri_id,
        yayin_id: oo.yayin_id,
        talep_no: y?.talep_no ?? null,
        firma_adi: y?.firma_adi ?? null,
        firma_id: y?.firma_id ?? null,
        urun_adi: y?.urun_adi ?? "-",
        teknik_adi: y?.teknik_adi ?? null,
        video_url: y?.video_url ?? null,
        thumbnail_url: y?.thumbnail_url ?? null,
        icerik_turu: y?.icerik_turu ?? null,
        video_puani: Number(y?.video_puani ?? 0),
        soru_puani: Number(y?.soru_puani ?? 0),
        soru_sayisi: Number(y?.video_basi_soru_sayisi ?? 0),
        kazanilan_izleme_puani: kazanilan.izleme,
        kazanilan_cevaplama_puani: kazanilan.cevaplama,
        ileri_sarma_kaybi: kazanilan.kayip,
        dogru_cevap: kazanilan.dogru,
        yanlis_cevap: kazanilan.yanlis,
        oneri_baslangic: oo.oneri_baslangic,
        oneri_bitis: oo.oneri_bitis,
        oneri_durumu: eclubOneriDurumu(oo.oneri_baslangic, oo.oneri_bitis),
        kalan_gun: Math.max(0, Math.ceil((new Date(oo.oneri_bitis).getTime() - new Date(simdi).getTime()) / (1000 * 60 * 60 * 24))),
        izlendi_mi: oo.izlendi_mi,
        izleme_baslangic: izleme?.izleme_baslangic ?? izleme?.created_at ?? null,
        izleme_bitis: izleme?.izleme_bitis ?? null,
        izleme_tamamlandi_mi: izleme?.tamamlandi_mi === true,
        begeni_sayisi: begeniler.get(oo.yayin_id) ?? 0,
        favori_sayisi: favoriler.get(oo.yayin_id) ?? 0,
        begeni_mi: begenilenler.has(oo.yayin_id),
        favori_mi: favorilenenler.has(oo.yayin_id),
        created_at: oo.created_at,
      }];
    });

    const firmaOzetleri = new Map<string, {
      firma_id: string;
      firma_adi: string;
      kazanilan_puan: number;
      kaybedilen_puan: number;
      harcanabilir_puan: number;
      dogru_cevap: number;
      video_sayisi: number;
    }>();
    const firmaOzetiniAl = (firmaId: string, firmaAdi: string) => {
      const mevcut = firmaOzetleri.get(firmaId) ?? {
        firma_id: firmaId,
        firma_adi: firmaAdi,
        kazanilan_puan: 0,
        kaybedilen_puan: 0,
        harcanabilir_puan: 0,
        dogru_cevap: 0,
        video_sayisi: 0,
      };
      firmaOzetleri.set(firmaId, mevcut);
      return mevcut;
    };
    for (const puan of puanlar) {
      const yayin = yayinMap.get(puan.yayin_id);
      if (!yayin?.firma_id) continue;
      firmaOzetiniAl(yayin.firma_id, yayin.firma_adi ?? "Firma").kazanilan_puan += Number(puan.puan ?? 0);
    }
    for (const kayip of kayipSonucu.data ?? []) {
      const yayin = yayinMap.get(kayip.yayin_id);
      if (!yayin?.firma_id) continue;
      firmaOzetiniAl(yayin.firma_id, yayin.firma_adi ?? "Firma").kaybedilen_puan += Number(kayip.kaybedilen_puan ?? 0);
    }
    for (const cevap of dogruSonucu.data ?? []) {
      const yayin = yayinMap.get(cevap.yayin_id);
      if (!yayin?.firma_id) continue;
      firmaOzetiniAl(yayin.firma_id, yayin.firma_adi ?? "Firma").dogru_cevap += 1;
    }
    for (const bakiye of firmaBakiyeleri) {
      firmaOzetiniAl(bakiye.firma_id, bakiye.firma_adi).harcanabilir_puan = Number(bakiye.bakiye ?? 0);
    }
    for (const oneri of sonuc) {
      if (!oneri.firma_id) continue;
      firmaOzetiniAl(oneri.firma_id, oneri.firma_adi ?? "Firma").video_sayisi += 1;
    }

    return NextResponse.json({
      kisi: { ad: kisi.ad, soyad: kisi.soyad, rol: kisi.rol },
      oneriler: sonuc,
      firma_ozetleri: [...firmaOzetleri.values()].sort((a, b) => a.firma_adi.localeCompare(b.firma_adi, "tr")),
      ozet: {
        toplam_kazanilan_puan: puanlar.reduce((toplam, puan) => toplam + Number(puan.puan ?? 0), 0),
        ileri_sarma_kaybi: (kayipSonucu.data ?? []).reduce((toplam, kayip) => toplam + Number(kayip.kaybedilen_puan ?? 0), 0),
        harcanabilir_puan: firmaBakiyeleri.reduce((toplam, firma) => toplam + Number(firma.bakiye ?? 0), 0),
        dogru_cevap: (dogruSonucu.data ?? []).length,
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/panel/api");
  }
}
