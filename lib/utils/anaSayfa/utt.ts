// lib/utils/anaSayfa/utt.ts
// UTT / KD_UTT ana sayfa verisi. (R0: lib/utils/anaSayfaVeri.ts'ten saf taşıma — davranış değişmedi.)

import { SupabaseClient } from "@supabase/supabase-js";
import { gecerliTurBaslangiclari } from "@/lib/tur/kayit";
import { tamTekrarSayilari } from "@/lib/puan/tekrarSayim";
import { EXTRA_PUAN_TEKRAR_ESIGI } from "@/lib/puan/strateji";

export async function getUttAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from("kullanicilar")
    .select("bolge_id")
    .eq("kullanici_id", userId)
    .single();

  if (kullaniciError || !kullanici) throw new Error("Kullanıcı bilgisi alınamadı.");

  const { data: bolge } = await adminSupabase
    .from("bolgeler")
    .select("takim_id")
    .eq("bolge_id", kullanici.bolge_id)
    .single();

  // Hafta başlangıcı (Pazartesi 00:00) — get_kullanici_ozet periyodu için kullanılır
  const haftaBaslangic = new Date();
  haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
  haftaBaslangic.setHours(0, 0, 0, 0);

  // Toplam puan için "geçmişten şimdiye" geniş aralık — tek kaynak prensibine uymak için
  // get_kullanici_ozet kullanıyoruz (4 kazanım − 3 kayıp = net puan).
  const cokGecmis = new Date(2000, 0, 1).toISOString();
  const simdi = new Date().toISOString();

  const [
    { data: yayinlar, error: yayinError },
    { data: izlemeler },
    { data: toplamOzet },
    { data: haftaOzet },
  ] = await Promise.all([
    adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, video_puani, yayin_tarihi, thumbnail_url, video_url, icerik_turu")
      .eq("durum", "yayinda")
      .eq("takim_id", bolge?.takim_id)
      // Pozitif hedef süzgeci: UTT ana sayfası yalnız 'utt' hedefli yayınları
      // listeler. Süzgeçsiz hâli bm/eczaci/eczanem hedefli yayınları da
      // sızdırırdı (v_yayin_detay tüm hedef_rol satırlarını içerir).
      .eq("hedef_rol", "utt")
      .order("yayin_tarihi", { ascending: false }),
    adminSupabase
      .from("izleme_kayitlari")
      .select("yayin_id, tamamlandi_mi, izleme_baslangic")
      .eq("kullanici_id", userId),
    adminSupabase.rpc("get_kullanici_ozet", {
      p_kullanici_id: userId,
      p_baslangic: cokGecmis,
      p_bitis: simdi,
    }),
    adminSupabase.rpc("get_kullanici_ozet", {
      p_kullanici_id: userId,
      p_baslangic: haftaBaslangic.toISOString(),
      p_bitis: simdi,
    }),
  ]);

  if (yayinError) throw new Error("Yayınlar çekilemedi.")

  // Geçerli tur başlangıçları — SALT-OKUR toplu hesap (lib/tur/kayit.ts).
  // Tur bazlı süzgeç: yalnızca geçerli turda tamamlanan/devam eden izlemeler
  // videoyu "yeni videolar"dan düşürür; önceki turun izlemeleri düşürmez —
  // periyodu dolan video kendiliğinden "yeni"ye döner (§9.1).
  const yayinIdler = (yayinlar ?? []).map((y: any) => y.yayin_id);
  const turMap = await gecerliTurBaslangiclari(adminSupabase, yayinIdler);

  const tamamlananMap: Record<string, boolean> = {};       // tur bazlı
  const devamEdenMap: Record<string, boolean> = {};        // tur bazlı
  const omurBoyuTamamlananMap: Record<string, boolean> = {}; // daha_once_izledi rozeti (kalıcı — U8 kararı)
  const omurBoyuIzlemeSayiMap: Record<string, number> = {};  // Ekstra İzlediklerim: ömür boyu tamamlanmış sayısı (≥2 süzgeci)
  const buTurdaIzlemeSayiMap: Record<string, number> = {};   // Ekstra İzlediklerim: "bu turda N izleme"
  for (const iz of izlemeler ?? []) {
    if (iz.tamamlandi_mi) {
      omurBoyuTamamlananMap[iz.yayin_id] = true;
      omurBoyuIzlemeSayiMap[iz.yayin_id] = (omurBoyuIzlemeSayiMap[iz.yayin_id] ?? 0) + 1;
    }

    // Tur eşiği: tur kaydı olmayan yayında epoch (eski davranış — her kayıt sayılır).
    const turBaslangic = turMap[iz.yayin_id]?.baslangic_tarihi ?? "2000-01-01T00:00:00Z";
    if (new Date(iz.izleme_baslangic) < new Date(turBaslangic)) continue;

    if (iz.tamamlandi_mi) {
      tamamlananMap[iz.yayin_id] = true;
      buTurdaIzlemeSayiMap[iz.yayin_id] = (buTurdaIzlemeSayiMap[iz.yayin_id] ?? 0) + 1;
    }
    else devamEdenMap[iz.yayin_id] = true;
  }

  // get_kullanici_ozet TABLE döner; ilk satırın toplam_net_puan'ı net puandır
  const toplam_puan = (toplamOzet && toplamOzet.length > 0) ? (toplamOzet[0].toplam_net_puan ?? 0) : 0;
  const hafta_puani = (haftaOzet && haftaOzet.length > 0) ? (haftaOzet[0].toplam_net_puan ?? 0) : 0;

  // Yayın bilgileri (extra_puan, ileri_sarma_acik) toplu çek
  const [
    { data: yayinBilgileri },
    { data: begeniSayilari },
    { data: favoriSayilari },
    { data: kullaniciBegeni },
    { data: kullaniciFavori },
    { data: izlemeSayilari },
  ] = await Promise.all([
    yayinIdler.length > 0
      ? adminSupabase.from("yayin_yonetimi").select("yayin_id, extra_puan, ileri_sarma_acik").in("yayin_id", yayinIdler)
      : { data: [] },
    yayinIdler.length > 0
      ? adminSupabase.from("video_begeniler").select("yayin_id").in("yayin_id", yayinIdler)
      : { data: [] },
    yayinIdler.length > 0
      ? adminSupabase.from("video_favoriler").select("yayin_id").in("yayin_id", yayinIdler)
      : { data: [] },
    yayinIdler.length > 0
      ? adminSupabase.from("video_begeniler").select("yayin_id").in("yayin_id", yayinIdler).eq("kullanici_id", userId)
      : { data: [] },
    yayinIdler.length > 0
      ? adminSupabase.from("video_favoriler").select("yayin_id").in("yayin_id", yayinIdler).eq("kullanici_id", userId)
      : { data: [] },
    yayinIdler.length > 0
      ? adminSupabase.from("izleme_kayitlari").select("yayin_id").in("yayin_id", yayinIdler).eq("tamamlandi_mi", true)
      : { data: [] },
  ]);

  const extraPuanMap: Record<string, number> = {};
  const ileriSarmaMap: Record<string, boolean> = {};
  for (const yb of yayinBilgileri ?? []) {
    extraPuanMap[yb.yayin_id] = yb.extra_puan ?? 0;
    ileriSarmaMap[yb.yayin_id] = yb.ileri_sarma_acik ?? false;
  }

  const begeniSayiMap: Record<string, number> = {};
  for (const b of begeniSayilari ?? []) {
    begeniSayiMap[b.yayin_id] = (begeniSayiMap[b.yayin_id] ?? 0) + 1;
  }

  const favoriSayiMap: Record<string, number> = {};
  for (const f of favoriSayilari ?? []) {
    favoriSayiMap[f.yayin_id] = (favoriSayiMap[f.yayin_id] ?? 0) + 1;
  }

  const izlenmeSayiMap: Record<string, number> = {};
  for (const iz of izlemeSayilari ?? []) {
    izlenmeSayiMap[iz.yayin_id] = (izlenmeSayiMap[iz.yayin_id] ?? 0) + 1;
  }

  const kullaniciBegeniSet = new Set((kullaniciBegeni ?? []).map((b: any) => b.yayin_id));
  const kullaniciFavoriSet = new Set((kullaniciFavori ?? []).map((f: any) => f.yayin_id));

  const videoToItem = (y: any) => ({
    yayin_id: y.yayin_id,
    sonraki_tur_tarihi: turMap[y.yayin_id]?.sonraki_tur_tarihi ?? null,
    urun_adi: y.urun_adi ?? "-",
    teknik_adi: y.teknik_adi ?? "-",
    video_url: y.video_url ?? null,
    thumbnail_url: y.thumbnail_url ?? null,
    video_puani: y.video_puani ?? null,
    yayin_tarihi: y.yayin_tarihi,
    icerik_turu: y.icerik_turu ?? null,
    extra_puan: extraPuanMap[y.yayin_id] ?? 0,
    ileri_sarma_acik: ileriSarmaMap[y.yayin_id] ?? false,
    begeni_sayisi: begeniSayiMap[y.yayin_id] ?? 0,
    favori_sayisi: favoriSayiMap[y.yayin_id] ?? 0,
    izlenme_sayisi: izlenmeSayiMap[y.yayin_id] ?? 0,
    begeni_mi: kullaniciBegeniSet.has(y.yayin_id),
    favori_mi: kullaniciFavoriSet.has(y.yayin_id),
    daha_once_izledi: omurBoyuTamamlananMap[y.yayin_id] ?? false,
  });

  const yeni_videolar = (yayinlar ?? []).filter((y: any) => !tamamlananMap[y.yayin_id] && !devamEdenMap[y.yayin_id]).map(videoToItem);
  const devam_edenler = (yayinlar ?? []).filter((y: any) => devamEdenMap[y.yayin_id] && !tamamlananMap[y.yayin_id]).map(videoToItem);
  const tamamlananlar = (yayinlar ?? []).filter((y: any) => tamamlananMap[y.yayin_id]).map(videoToItem);

  // ── Ekstra İzlediklerim (K-A5) ─────────────────────────────────────────────
  // Süzgeç: ömür boyu ≥2 tamamlanmış izleme (yayinlar zaten durum='yayinda' — K-A3
  // kendiliğinden sağlanır). Tam tekrar sayısı TEK KAYNAK'tan (tamTekrarSayilari,
  // toplu, N+1 yok); "bu ay kazanıldı" durumu sayıdan türer (sayi >= eşik).
  // Sayım hatasında güvenli davranış: sayilar boş harita döner → kalan = eşik
  // görünür, puan kararı etkilenmez (görüntü katmanı).
  const ekstraAdaylar = (yayinlar ?? []).filter((y: any) => (omurBoyuIzlemeSayiMap[y.yayin_id] ?? 0) >= 2);
  const sayim = await tamTekrarSayilari(adminSupabase, userId, ekstraAdaylar.map((y: any) => y.yayin_id), turMap);
  if (!sayim.ok) {
    console.error("[UYARI] Ekstra İzlediklerim tam tekrar sayımı yapılamadı:", { hata: sayim.error });
  }

  const ekstra_izlediklerim = ekstraAdaylar
    .map((y: any) => {
      const tamTekrar = sayim.sayilar[y.yayin_id] ?? 0;
      return {
        ...videoToItem(y),
        toplam_izlemem: omurBoyuIzlemeSayiMap[y.yayin_id] ?? 0,
        bu_turda_izleme: buTurdaIzlemeSayiMap[y.yayin_id] ?? 0,
        extra_kalan: Math.max(0, EXTRA_PUAN_TEKRAR_ESIGI - tamTekrar),
        bu_ay_extra_kazanildi: tamTekrar >= EXTRA_PUAN_TEKRAR_ESIGI,
      };
    })
    // K-A4: extra'ya yakın önce; "bu ay kazanıldı" satırları altta; ikincil: toplam izleme (çoktan aza)
    .sort((a: any, b: any) => {
      const aK = a.bu_ay_extra_kazanildi ? 1 : 0;
      const bK = b.bu_ay_extra_kazanildi ? 1 : 0;
      if (aK !== bK) return aK - bK;
      if (a.extra_kalan !== b.extra_kalan) return a.extra_kalan - b.extra_kalan;
      return b.toplam_izlemem - a.toplam_izlemem;
    });

  return {
    yeni_videolar,
    devam_edenler,
    tamamlananlar,
    ekstra_izlediklerim,
    istatistikler: {
      yeni: yeni_videolar.length,
      devam: devam_edenler.length,
      tamamlanan: tamamlananlar.length,
      hafta_puani,
      toplam_puan,
    },
  };
}
