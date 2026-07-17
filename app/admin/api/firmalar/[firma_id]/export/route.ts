// app/admin/api/firmalar/[firma_id]/export/route.ts
//
// Bir firmanın verilerini Excel (.xlsx) olarak dışa aktarır.
// Firma sistemden ayrıldığında, biriken verinin okunabilir teslimi için.
//
// Sayfalar:
//   1. Kullanicilar    — UTT/kişi listesi (ad, soyad, rol, e-posta, bölge, takım)
//   2. Takim-Bolge     — organizasyon yapısı (takım → bölgeleri)
//   3. Urun-Teknik     — firmanın ürün ve teknik tanımları
//   4. Talepler        — firmanın ürettiği eğitim talepleri
//   5. Puan Detay      — her puan/kayıp hareketi ayrı satır:
//        UTT · Bölge · Takım · Ürün · Teknik ·
//        İzleme · Cevaplama · Öneri · Extra ·
//        Yanlış Cevap Kaybı · Öneri Kaybı · Challenge Kaybı · Net
//
// Teknik bilgisi puanın yayınından (yayin_id) talebe giden zincirle çözülür:
//   yayin_yonetimi → soru_seti_durumu → soru_setleri → video_durumu →
//   videolar → senaryo_durumu → senaryolar → talepler (urun_id + teknik_adi)
// Bu eşleme tek seferde bir harita olarak kurulur, her satırda tekrar join yapılmaz.
//
// Export başarılı olursa firmalar.son_export_at güncellenir (silme koşulu buna bakar).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi, hataYaniti, veriKontrol } from "@/lib/utils/hataIsle";
import * as XLSX from "xlsx";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();

    // --- Firma kaydı -------------------------------------------------------
    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("firma_id, firma_adi")
      .eq("firma_id", firma_id)
      .single();

    const firmaKontrol = veriKontrol(firma, "firmalar SELECT — export", "Firma bulunamadı.");
    if (!firmaKontrol.gecerli) return firmaKontrol.yanit;
    if (firmaError) return hataYaniti("Firma sorgulanamadı.", "firmalar SELECT — export", firmaError);

    // B-20: export sorgularından HERHANGİ biri hata verirse dışa aktarma
    // kesilir — eksik sayfa "tam yedek" sayılamaz; son_export_at güncellenmez
    // (firma silme ön koşulu eksik yedekle sağlanamaz).
    const sorguHatasi = (etiket: string, error: unknown) =>
      hataYaniti(
        `Dışa aktarma iptal edildi: "${etiket}" sorgusu başarısız — eksik yedek üretilmez.`,
        `export — ${etiket}`,
        error
      );

    // --- Takımlar (firma) --------------------------------------------------
    const { data: takimlar, error: takimlarHata } = await adminSupabase
      .from("takimlar")
      .select("takim_id, takim_adi")
      .eq("firma_id", firma_id);
    if (takimlarHata) return sorguHatasi("takımlar", takimlarHata);

    const takimIdleri = (takimlar ?? []).map(t => t.takim_id);
    const takimAdMap = new Map((takimlar ?? []).map(t => [t.takim_id, t.takim_adi]));

    // --- Bölgeler (takımlara bağlı) ---------------------------------------
    let bolgeler: { bolge_id: string; bolge_adi: string; takim_id: string }[] = [];
    if (takimIdleri.length > 0) {
      const { data, error: bolgelerHata } = await adminSupabase
        .from("bolgeler")
        .select("bolge_id, bolge_adi, takim_id")
        .in("takim_id", takimIdleri);
      if (bolgelerHata) return sorguHatasi("bölgeler", bolgelerHata);
      bolgeler = data ?? [];
    }
    const bolgeAdMap = new Map(bolgeler.map(b => [b.bolge_id, b.bolge_adi]));

    // --- Kullanıcılar (firma) ---------------------------------------------
    const { data: kullanicilar, error: kullanicilarHata } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, eposta, rol, takim_id, bolge_id")
      .eq("firma_id", firma_id);
    if (kullanicilarHata) return sorguHatasi("kullanıcılar", kullanicilarHata);

    const kullaniciListesi = kullanicilar ?? [];
    const kullaniciIdleri = kullaniciListesi.map(k => k.kullanici_id);
    // Kullanıcı → {ad soyad, bölge, takım} hızlı erişim haritası (puan detay için)
    const kullaniciMap = new Map(
      kullaniciListesi.map(k => [k.kullanici_id, {
        adSoyad: `${k.ad} ${k.soyad}`,
        bolge: k.bolge_id ? (bolgeAdMap.get(k.bolge_id) ?? "") : "",
        takim: k.takim_id ? (takimAdMap.get(k.takim_id) ?? "") : "",
      }])
    );

    // --- Ürünler (firma) ---------------------------------------------------
    const { data: urunler, error: urunlerHata } = await adminSupabase
      .from("urunler")
      .select("urun_id, urun_adi, takim_id")
      .eq("firma_id", firma_id);
    if (urunlerHata) return sorguHatasi("ürünler", urunlerHata);
    const urunListesi = urunler ?? [];
    const urunAdMap = new Map(urunListesi.map(u => [u.urun_id, u.urun_adi]));

    // --- Teknikler (firma) -------------------------------------------------
    const { data: teknikler, error: tekniklerHata } = await adminSupabase
      .from("teknikler")
      .select("teknik_id, teknik_adi")
      .eq("firma_id", firma_id);
    if (tekniklerHata) return sorguHatasi("teknikler", tekniklerHata);
    const teknikListesi = teknikler ?? [];

    // --- Talepler (firma) --------------------------------------------------
    const { data: talepler, error: taleplerHata } = await adminSupabase
      .from("talepler")
      .select("talep_id, urun_adi, urun_id, teknik_adi, teknik_id, egitim_turu, icerik_turu, hedef_rol, takim_id, created_at")
      .eq("firma_id", firma_id);
    if (taleplerHata) return sorguHatasi("talepler", taleplerHata);
    const talepListesi = talepler ?? [];

    // ======================================================================
    // PUAN DETAY için teknik/ürün haritası: yayin_id → { urun_adi, teknik_adi }
    // Zincir: yayin → soru_seti_durumu → soru_setleri → video_durumu →
    //         videolar → senaryo_durumu → senaryolar → talepler
    // Test verisi yokken bu zincir boştur; canlıda dolar.
    // ======================================================================
    const yayinTeknikMap = new Map<string, { urun: string; teknik: string }>();

    const { data: yayinlar, error: yayinlarHata } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, soru_seti_durum_id");
    if (yayinlarHata) return sorguHatasi("yayınlar", yayinlarHata);

    if ((yayinlar ?? []).length > 0) {
      const ssDurumIdleri = [...new Set((yayinlar ?? []).map(y => y.soru_seti_durum_id).filter(Boolean))];

      const { data: ssDurumlar, error: ssDurumHata } = await adminSupabase
        .from("soru_seti_durumu")
        .select("soru_seti_durum_id, soru_seti_id")
        .in("soru_seti_durum_id", ssDurumIdleri.length ? ssDurumIdleri : ["___"]);
      if (ssDurumHata) return sorguHatasi("soru seti durumları", ssDurumHata);
      const ssDurumMap = new Map((ssDurumlar ?? []).map(x => [x.soru_seti_durum_id, x.soru_seti_id]));

      const soruSetiIdleri = [...new Set((ssDurumlar ?? []).map(x => x.soru_seti_id).filter(Boolean))];
      const { data: soruSetleri, error: soruSetiHata } = await adminSupabase
        .from("soru_setleri")
        .select("soru_seti_id, video_durum_id")
        .in("soru_seti_id", soruSetiIdleri.length ? soruSetiIdleri : ["___"]);
      if (soruSetiHata) return sorguHatasi("soru setleri", soruSetiHata);
      const soruSetiMap = new Map((soruSetleri ?? []).map(x => [x.soru_seti_id, x.video_durum_id]));

      const videoDurumIdleri = [...new Set((soruSetleri ?? []).map(x => x.video_durum_id).filter(Boolean))];
      const { data: videoDurumlar, error: videoDurumHata } = await adminSupabase
        .from("video_durumu")
        .select("video_durum_id, video_id")
        .in("video_durum_id", videoDurumIdleri.length ? videoDurumIdleri : ["___"]);
      if (videoDurumHata) return sorguHatasi("video durumları", videoDurumHata);
      const videoDurumMap = new Map((videoDurumlar ?? []).map(x => [x.video_durum_id, x.video_id]));

      const videoIdleri = [...new Set((videoDurumlar ?? []).map(x => x.video_id).filter(Boolean))];
      const { data: videolar, error: videolarHata } = await adminSupabase
        .from("videolar")
        .select("video_id, senaryo_durum_id")
        .in("video_id", videoIdleri.length ? videoIdleri : ["___"]);
      if (videolarHata) return sorguHatasi("videolar", videolarHata);
      const videoMap = new Map((videolar ?? []).map(x => [x.video_id, x.senaryo_durum_id]));

      const senaryoDurumIdleri = [...new Set((videolar ?? []).map(x => x.senaryo_durum_id).filter(Boolean))];
      const { data: senaryoDurumlar, error: senaryoDurumHata } = await adminSupabase
        .from("senaryo_durumu")
        .select("senaryo_durum_id, senaryo_id")
        .in("senaryo_durum_id", senaryoDurumIdleri.length ? senaryoDurumIdleri : ["___"]);
      if (senaryoDurumHata) return sorguHatasi("senaryo durumları", senaryoDurumHata);
      const senaryoDurumMap = new Map((senaryoDurumlar ?? []).map(x => [x.senaryo_durum_id, x.senaryo_id]));

      const senaryoIdleri = [...new Set((senaryoDurumlar ?? []).map(x => x.senaryo_id).filter(Boolean))];
      const { data: senaryolar, error: senaryolarHata } = await adminSupabase
        .from("senaryolar")
        .select("senaryo_id, talep_id")
        .in("senaryo_id", senaryoIdleri.length ? senaryoIdleri : ["___"]);
      if (senaryolarHata) return sorguHatasi("senaryolar", senaryolarHata);
      const senaryoMap = new Map((senaryolar ?? []).map(x => [x.senaryo_id, x.talep_id]));

      // talep_id → {urun_adi, teknik_adi} (bu firmaya ait taleplerden)
      const talepBilgiMap = new Map(
        talepListesi.map(t => [t.talep_id, {
          urun: t.urun_adi ?? (t.urun_id ? (urunAdMap.get(t.urun_id) ?? "") : ""),
          teknik: t.teknik_adi ?? "",
        }])
      );

      // Zinciri her yayın için çöz
      for (const y of yayinlar ?? []) {
        const ssId = ssDurumMap.get(y.soru_seti_durum_id);
        if (!ssId) continue;
        const vdId = soruSetiMap.get(ssId);
        if (!vdId) continue;
        const vId = videoDurumMap.get(vdId);
        if (!vId) continue;
        const sdId = videoMap.get(vId);
        if (!sdId) continue;
        const sId = senaryoDurumMap.get(sdId);
        if (!sId) continue;
        const tId = senaryoMap.get(sId);
        if (!tId) continue;
        const bilgi = talepBilgiMap.get(tId);
        if (bilgi) yayinTeknikMap.set(y.yayin_id, bilgi);
      }
    }

    // Yardımcı: bir puan/kayıp satırı için ürün+teknik çöz
    // Öncelik: yayin_id üzerinden teknik haritası; yoksa urun_id'den ürün adı.
    const cozUrunTeknik = (yayin_id: string | null, urun_id: string | null) => {
      if (yayin_id && yayinTeknikMap.has(yayin_id)) {
        return yayinTeknikMap.get(yayin_id)!;
      }
      return {
        urun: urun_id ? (urunAdMap.get(urun_id) ?? "") : "",
        teknik: "",
      };
    };

    // ======================================================================
    // PUAN DETAY satırları — her hareket ayrı satır (ham)
    // Kazanç: kazanilan_puanlar (puan_turu: izleme/cevaplama/oneri/extra)
    // Kayıp:  yanlis_cevap_kayitlari, oneri_kayip_kayitlari, challenge_kayip_kayitlari
    // ======================================================================
    type PuanSatir = {
      utt: string; bolge: string; takim: string; urun: string; teknik: string;
      izleme: number; cevaplama: number; oneri: number; extra: number;
      yanlisKayip: number; oneriKayip: number; challengeKayip: number;
    };
    const puanSatirlari: PuanSatir[] = [];

    const bosSatir = (kullanici_id: string, urunTeknik: { urun: string; teknik: string }): PuanSatir => {
      const k = kullaniciMap.get(kullanici_id);
      return {
        utt: k?.adSoyad ?? "", bolge: k?.bolge ?? "", takim: k?.takim ?? "",
        urun: urunTeknik.urun, teknik: urunTeknik.teknik,
        izleme: 0, cevaplama: 0, oneri: 0, extra: 0,
        yanlisKayip: 0, oneriKayip: 0, challengeKayip: 0,
      };
    };

    if (kullaniciIdleri.length > 0) {
      const kIdParam = kullaniciIdleri;

      // Kazanılan puanlar
      const { data: kazanclar, error: kazanclarHata } = await adminSupabase
        .from("kazanilan_puanlar")
        .select("kullanici_id, urun_id, yayin_id, puan, puan_turu")
        .in("kullanici_id", kIdParam);
      if (kazanclarHata) return sorguHatasi("kazanılan puanlar", kazanclarHata);

      for (const p of kazanclar ?? []) {
        const ut = cozUrunTeknik(p.yayin_id, p.urun_id);
        const s = bosSatir(p.kullanici_id, ut);
        const puan = p.puan ?? 0;
        if (p.puan_turu === "izleme") s.izleme = puan;
        else if (p.puan_turu === "cevaplama") s.cevaplama = puan;
        else if (p.puan_turu === "oneri") s.oneri = puan;
        else if (p.puan_turu === "extra") s.extra = puan;
        puanSatirlari.push(s);
      }

      // Yanlış cevap kayıpları
      const { data: yanlisKayiplar, error: yanlisKayipHata } = await adminSupabase
        .from("yanlis_cevap_kayitlari")
        .select("kullanici_id, urun_id, yayin_id, kaybedilen_puan")
        .in("kullanici_id", kIdParam);
      if (yanlisKayipHata) return sorguHatasi("yanlış cevap kayıpları", yanlisKayipHata);
      for (const p of yanlisKayiplar ?? []) {
        const ut = cozUrunTeknik(p.yayin_id, p.urun_id);
        const s = bosSatir(p.kullanici_id, ut);
        s.yanlisKayip = p.kaybedilen_puan ?? 0;
        puanSatirlari.push(s);
      }

      // Öneri kayıpları
      const { data: oneriKayiplar, error: oneriKayipHata } = await adminSupabase
        .from("oneri_kayip_kayitlari")
        .select("kullanici_id, urun_id, yayin_id, kaybedilen_puan")
        .in("kullanici_id", kIdParam);
      if (oneriKayipHata) return sorguHatasi("öneri kayıpları", oneriKayipHata);
      for (const p of oneriKayiplar ?? []) {
        const ut = cozUrunTeknik(p.yayin_id, p.urun_id);
        const s = bosSatir(p.kullanici_id, ut);
        s.oneriKayip = p.kaybedilen_puan ?? 0;
        puanSatirlari.push(s);
      }

      // Challenge kayıpları
      const { data: challengeKayiplar, error: challengeKayipHata } = await adminSupabase
        .from("challenge_kayip_kayitlari")
        .select("kullanici_id, urun_id, yayin_id, kaybedilen_puan")
        .in("kullanici_id", kIdParam);
      if (challengeKayipHata) return sorguHatasi("challenge kayıpları", challengeKayipHata);
      for (const p of challengeKayiplar ?? []) {
        const ut = cozUrunTeknik(p.yayin_id, p.urun_id);
        const s = bosSatir(p.kullanici_id, ut);
        s.challengeKayip = p.kaybedilen_puan ?? 0;
        puanSatirlari.push(s);
      }
    }

    // ======================================================================
    // Excel oluştur
    // ======================================================================
    const wb = XLSX.utils.book_new();

    // 1. Kullanıcılar
    const kullaniciAOA = [
      ["Ad", "Soyad", "Rol", "E-posta", "Bölge", "Takım"],
      ...kullaniciListesi.map(k => [
        k.ad, k.soyad, k.rol, k.eposta,
        k.bolge_id ? (bolgeAdMap.get(k.bolge_id) ?? "") : "",
        k.takim_id ? (takimAdMap.get(k.takim_id) ?? "") : "",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kullaniciAOA), "Kullanicilar");

    // 2. Takım-Bölge
    const takimBolgeAOA: (string)[][] = [["Takım", "Bölge"]];
    for (const t of takimlar ?? []) {
      const tBolgeler = bolgeler.filter(b => b.takim_id === t.takim_id);
      if (tBolgeler.length === 0) {
        takimBolgeAOA.push([t.takim_adi, ""]);
      } else {
        for (const b of tBolgeler) takimBolgeAOA.push([t.takim_adi, b.bolge_adi]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(takimBolgeAOA), "Takim-Bolge");

    // 3. Ürün-Teknik
    const urunTeknikAOA: (string)[][] = [["Tür", "Ad", "Bağlı Takım"]];
    for (const u of urunListesi) {
      urunTeknikAOA.push(["Ürün", u.urun_adi, u.takim_id ? (takimAdMap.get(u.takim_id) ?? "") : ""]);
    }
    for (const t of teknikListesi) {
      urunTeknikAOA.push(["Teknik", t.teknik_adi, ""]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(urunTeknikAOA), "Urun-Teknik");

    // 4. Talepler
    const talepAOA: (string)[][] = [
      ["Ürün", "Teknik", "Eğitim Türü", "İçerik Türü", "Hedef Rol", "Takım", "Tarih"],
      ...talepListesi.map(t => [
        t.urun_adi ?? "", t.teknik_adi ?? "", t.egitim_turu ?? "",
        t.icerik_turu ?? "", t.hedef_rol ?? "",
        t.takim_id ? (takimAdMap.get(t.takim_id) ?? "") : "",
        t.created_at ? new Date(t.created_at).toLocaleDateString("tr-TR") : "",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(talepAOA), "Talepler");

    // 5. Puan Detay
    const puanAOA: (string | number)[][] = [
      ["UTT", "Bölge", "Takım", "Ürün", "Teknik",
       "İzleme", "Cevaplama", "Öneri", "Extra",
       "Yanlış Cevap Kaybı", "Öneri Kaybı", "Challenge Kaybı", "Net"],
      ...puanSatirlari.map(s => {
        const net = (s.izleme + s.cevaplama + s.oneri + s.extra)
                  - (s.yanlisKayip + s.oneriKayip + s.challengeKayip);
        return [
          s.utt, s.bolge, s.takim, s.urun, s.teknik,
          s.izleme, s.cevaplama, s.oneri, s.extra,
          s.yanlisKayip, s.oneriKayip, s.challengeKayip, net,
        ];
      }),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(puanAOA), "Puan Detay");

    // Excel'i buffer olarak yaz
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Export başarılı → son_export_at güncelle (silme koşulu için).
    // Bu noktaya yalnız TÜM sorgular başarılıysa gelinir (B-20).
    const { error: exportAtHata } = await adminSupabase
      .from("firmalar")
      .update({ son_export_at: new Date().toISOString() })
      .eq("firma_id", firma_id);
    if (exportAtHata) {
      // Dosya tam üretildi; yalnız silme-koşulu damgası atılamadı — loglanır.
      console.error("[export] son_export_at güncellenemedi:", exportAtHata.message);
    }

    // Dosya adı: firma_adi_export_YYYY-MM-DD.xlsx (ASCII-güvenli)
    const tarih = new Date().toISOString().slice(0, 10);
    const guvenliAd = (firma!.firma_adi ?? "firma")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dosyaAdi = `${guvenliAd}_export_${tarih}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
      },
    });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]/export");
  }
}