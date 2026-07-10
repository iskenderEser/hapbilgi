// lib/utils/anaSayfaVeri.ts
// Ana sayfa için role özel veri fonksiyonları.
// Yeni rol eklenince buraya fonksiyon eklenir, başka dosyaya dokunulmaz.

import { SupabaseClient } from "@supabase/supabase-js";
import { getBmAktiviteVerisi } from "@/lib/utils/anaSayfa/bmAktivite";
import { gecerliTurBaslangiclari } from "@/lib/tur/kayit";

// ─── BM ───────────────────────────────────────────────────────────────────────

export async function getBmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: bmKullanici, error: bmError } = await adminSupabase
    .from("kullanicilar")
    .select("bolge_id, takim_id")
    .eq("kullanici_id", userId)
    .single();

  if (bmError || !bmKullanici) throw new Error("BM bilgisi alınamadı.");

  const { data: uttler } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad")
    .eq("bolge_id", bmKullanici.bolge_id)
    .in("rol", ["utt", "kd_utt"])
    .eq("aktif_mi", true);

  const uttIdler = (uttler ?? []).map((u: any) => u.kullanici_id);
  const uttMap: Record<string, { ad: string; soyad: string }> = {};
  for (const u of uttler ?? []) {
    uttMap[u.kullanici_id] = { ad: u.ad, soyad: u.soyad };
  }

  const { data: oneriler, error: oneriError } = await adminSupabase
    .from("oneri_kayitlari")
    .select("oneri_id, yayin_id, kullanici_id, izlendi_mi, created_at")
    .eq("oneren_id", userId)
    .order("created_at", { ascending: false });

  if (oneriError) throw new Error("Öneriler çekilemedi.");

  const haftaBaslangic = new Date();
  haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
  haftaBaslangic.setHours(0, 0, 0, 0);

  const haftaOneriler = (oneriler ?? []).filter(
    (o: any) => new Date(o.created_at) >= haftaBaslangic
  );

  const yayinIdler = [...new Set((oneriler ?? []).map((o: any) => o.yayin_id))];
  const { data: yayinlar } = await adminSupabase
    .from("v_yayin_detay")
    .select("yayin_id, urun_adi, teknik_adi")
    .in("yayin_id", yayinIdler.length > 0 ? yayinIdler : ["00000000-0000-0000-0000-000000000000"]);

  const yayinMap: Record<string, { urun_adi: string; teknik_adi: string }> = {};
  for (const y of yayinlar ?? []) {
    yayinMap[y.yayin_id] = { urun_adi: y.urun_adi, teknik_adi: y.teknik_adi };
  }

  const satirlar = (oneriler ?? []).map((o: any) => ({
    oneri_id: o.oneri_id,
    kullanici_id: o.kullanici_id,
    utt_adi: uttMap[o.kullanici_id] ? `${uttMap[o.kullanici_id].ad} ${uttMap[o.kullanici_id].soyad}` : "-",
    urun_adi: yayinMap[o.yayin_id]?.urun_adi ?? "-",
    teknik_adi: yayinMap[o.yayin_id]?.teknik_adi ?? "-",
    durum: o.izlendi_mi ? "Tamamlandı" : "Bekliyor",
    tarih: o.created_at,
    kategori: o.izlendi_mi ? "tamamlanan" : "bekleyen",
  }));

  return {
    satirlar,
    istatistikler: {
      hafta_oneri: haftaOneriler.length,
      bekleyen: satirlar.filter((s: any) => s.kategori === "bekleyen").length,
      tamamlanan: satirlar.filter((s: any) => s.kategori === "tamamlanan").length,
      utt_sayisi: uttIdler.length,
    },
  };
}

// ─── UTT / KD_UTT ─────────────────────────────────────────────

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
  for (const iz of izlemeler ?? []) {
    if (iz.tamamlandi_mi) omurBoyuTamamlananMap[iz.yayin_id] = true;

    // Tur eşiği: tur kaydı olmayan yayında epoch (eski davranış — her kayıt sayılır).
    const turBaslangic = turMap[iz.yayin_id]?.baslangic_tarihi ?? "2000-01-01T00:00:00Z";
    if (new Date(iz.izleme_baslangic) < new Date(turBaslangic)) continue;

    if (iz.tamamlandi_mi) tamamlananMap[iz.yayin_id] = true;
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

  return {
    yeni_videolar,
    devam_edenler,
    tamamlananlar,
    istatistikler: {
      yeni: yeni_videolar.length,
      devam: devam_edenler.length,
      tamamlanan: tamamlananlar.length,
      hafta_puani,
      toplam_puan,
    },
  };
}

// ─── TM ───────────────────────────────────────────────────────────────────────

export async function getTmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from("kullanicilar")
    .select("takim_id")
    .eq("kullanici_id", userId)
    .single();
  if (kullaniciError || !kullanici) throw new Error("Kullanıcı bilgisi alınamadı.");
  if (!kullanici.takim_id) throw new Error("TM bir takıma bağlı değil.");

  const veri = await getBmAktiviteVerisi(
    { tip: "takim", takim_id: kullanici.takim_id },
    adminSupabase,
  );

  return {
    bm_satirlari: veri.satirlar,
    istatistikler: veri.istatistikler,
  };
}

// ─── IU ───────────────────────────────────────────────────────────────────────

export async function getIuAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const [
    { data: bekleyenSenaryolar },
    { data: bekleyenVideolar },
    { data: bekleyenSoruSetleri },
  ] = await Promise.all([
    adminSupabase
      .from("senaryo_durumu")
      .select("senaryo_durum_id, senaryo_id, created_at")
      .eq("durum", "senaryo yaziliyor")
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("video_durumu")
      .select("video_durum_id, video_id, created_at")
      .eq("durum", "inceleme bekleniyor")
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_durum_id, soru_seti_id, created_at")
      .eq("durum", "inceleme bekleniyor")
      .order("created_at", { ascending: true }),
  ]);

  return {
    istatistikler: {
      bekleyen_senaryo: (bekleyenSenaryolar ?? []).length,
      bekleyen_video: (bekleyenVideolar ?? []).length,
      bekleyen_soru_seti: (bekleyenSoruSetleri ?? []).length,
    },
    bekleyen_senaryolar: bekleyenSenaryolar ?? [],
    bekleyen_videolar: bekleyenVideolar ?? [],
    bekleyen_soru_setleri: bekleyenSoruSetleri ?? [],
  };
}

// ─── ÜRETİCİ ROLLERİ ANA SAYFA VERİSİ ──────────────────────────────────────────────────────────

interface TakipSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: "utt" | "bm";
  asama: "Senaryo" | "Video" | "Soru Seti" | "Yayın";
  durum: string;
  tarih: string;
  yol: string;
  kategori: "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan" | "devam";
}

export async function getUreticiAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: talepler, error: talepError } = await adminSupabase
    .from("talepler")
    .select(`talep_id, hedef_rol, created_at, urunler(urun_adi), teknikler(teknik_adi)`)
    .eq("uretici_id", userId)
    .order("created_at", { ascending: false });

  if (talepError) throw new Error("Talepler çekilemedi.");

  const satirlar: TakipSatiri[] = [];
  let inceleme_bekleyen = 0;
  let yayin_bekleyen = 0;
  let yayinda = 0;

  for (const talep of talepler ?? []) {
    const urun_adi = (talep as any).urunler?.urun_adi ?? "-";
    const teknik_adi = (talep as any).teknikler?.teknik_adi ?? "-";
    const hedef_rol = ((talep as any).hedef_rol ?? "utt") as "utt" | "bm";

    const { data: senaryolar } = await adminSupabase
      .from("senaryolar")
      .select("senaryo_id")
      .eq("talep_id", talep.talep_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSenaryo = senaryolar?.[0];

    if (!sonSenaryo) {
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Senaryo", durum: "Senaryo Bekleniyor", tarih: talep.created_at, yol: `/talepler/${talep.talep_id}`, kategori: "devam" });
      continue;
    }

    const { data: senaryoDurumlar } = await adminSupabase
      .from("senaryo_durumu")
      .select("durum, senaryo_durum_id, created_at")
      .eq("senaryo_id", sonSenaryo.senaryo_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSD = senaryoDurumlar?.[0];

    if (!sonSD || sonSD.durum !== "onaylandi") {
      const durum = sonSD?.durum === "inceleme bekleniyor" ? "İnceleme Bekliyor" :
                    sonSD?.durum === "revizyon bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonSD?.durum === "inceleme bekleniyor" ? "inceleme" : "devam";
      if (sonSD?.durum === "inceleme bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Senaryo", durum, tarih: sonSD?.created_at ?? talep.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori });
      continue;
    }

    const { data: videolar } = await adminSupabase
      .from("videolar")
      .select("video_id")
      .eq("senaryo_durum_id", sonSD.senaryo_durum_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonVideo = videolar?.[0];

    if (!sonVideo) {
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Video", durum: "Video Bekleniyor", tarih: sonSD.created_at, yol: `/videolar`, kategori: "devam" });
      continue;
    }

    const { data: videoDurumlar } = await adminSupabase
      .from("video_durumu")
      .select("durum, video_durum_id, created_at")
      .eq("video_id", sonVideo.video_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonVD = videoDurumlar?.[0];

    if (!sonVD || sonVD.durum !== "onaylandi") {
      const durum = sonVD?.durum === "inceleme bekleniyor" ? "İnceleme Bekliyor" :
                    sonVD?.durum === "revizyon bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonVD?.durum === "inceleme bekleniyor" ? "inceleme" : "devam";
      if (sonVD?.durum === "inceleme bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Video", durum, tarih: sonVD?.created_at ?? sonSD.created_at, yol: `/videolar`, kategori });
      continue;
    }

    const { data: soruSetleri } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id")
      .eq("video_durum_id", sonVD.video_durum_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSoruSeti = soruSetleri?.[0];

    if (!sonSoruSeti) {
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Soru Seti", durum: "Soru Seti Bekleniyor", tarih: sonVD.created_at, yol: `/soru-setleri`, kategori: "devam" });
      continue;
    }

    const { data: soruSetiDurumlar } = await adminSupabase
      .from("soru_seti_durumu")
      .select("durum, soru_seti_durum_id, created_at")
      .eq("soru_seti_id", sonSoruSeti.soru_seti_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSSD = soruSetiDurumlar?.[0];

    if (!sonSSD || sonSSD.durum !== "onaylandi") {
      const durum = sonSSD?.durum === "inceleme bekleniyor" ? "İnceleme Bekliyor" :
                    sonSSD?.durum === "revizyon bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonSSD?.durum === "inceleme bekleniyor" ? "inceleme" : "devam";
      if (sonSSD?.durum === "inceleme bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Soru Seti", durum, tarih: sonSSD?.created_at ?? sonVD.created_at, yol: `/soru-setleri`, kategori });
      continue;
    }

    const { data: yayin } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum, yayin_tarihi")
      .eq("soru_seti_durum_id", sonSSD.soru_seti_durum_id)
      .maybeSingle();

    if (!yayin) {
      yayin_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Yayın Bekliyor", tarih: sonSSD.created_at, yol: `/yayin-yonetimi`, kategori: "yayin-bekleyen" });
    } else if (yayin.durum === "yayinda") {
      yayinda++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Yayında", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "yayinda" });
    } else {
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, hedef_rol, asama: "Yayın", durum: "Durduruldu", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "durdurulan" });
    }
  }

  return {
    satirlar,
    istatistikler: {
      inceleme_bekleyen,
      yayin_bekleyen,
      yayinda,
      toplam: (talepler ?? []).length,
    },
  };
}

// ─── YÖNETİCİ (gm, gm_yrd, drk, paz_md, blm_md, grp_pm, sm) ─────────────────

export async function getYoneticiAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from("kullanicilar")
    .select("firma_id")
    .eq("kullanici_id", userId)
    .single();

  if (kullaniciError || !kullanici) throw new Error("Kullanıcı bilgisi alınamadı.");

  // Hafta başlangıcı (Pazartesi 00:00)
  const haftaBaslangic = new Date();
  haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
  haftaBaslangic.setHours(0, 0, 0, 0);
  const simdi = new Date().toISOString();

  // Paralel: anlık 6 stat + haftalık UTT puanları + UTT listesi (rol/foto için)
  const [
    { data: ozet, error: ozetError },
    { data: haftaUttler },
    { data: firmaUttler },
  ] = await Promise.all([
    adminSupabase.rpc("get_yonetici_ana_sayfa", { p_firma_id: kullanici.firma_id }),
    adminSupabase.rpc("get_kullanici_ozet", {
      p_baslangic: haftaBaslangic.toISOString(),
      p_bitis: simdi,
      p_firma_id: kullanici.firma_id,
    }),
    adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, fotograf_url")
      .eq("firma_id", kullanici.firma_id)
      .in("rol", ["utt", "kd_utt"])
      .eq("aktif_mi", true),
  ]);

  if (ozetError) throw new Error("Ana sayfa verisi alınamadı.");

  const stat = (ozet && ozet.length > 0) ? ozet[0] : null;

  const uttIdSet = new Set((firmaUttler ?? []).map((u: any) => u.kullanici_id));
  const fotoMap: Record<string, string | null> = {};
  for (const u of firmaUttler ?? []) fotoMap[u.kullanici_id] = u.fotograf_url;

  // Top 5 UTT (firma içi UTT/KD_UTT + puanı > 0, net puan DESC)
  const top5 = (haftaUttler ?? [])
    .filter((u: any) => uttIdSet.has(u.kullanici_id) && (u.toplam_net_puan ?? 0) > 0)
    .sort((a: any, b: any) => (b.toplam_net_puan ?? 0) - (a.toplam_net_puan ?? 0))
    .slice(0, 5);

  const haftanin_enleri = top5.map((u: any) => ({
    kullanici_id: u.kullanici_id,
    ad: u.ad,
    soyad: u.soyad,
    fotograf_url: fotoMap[u.kullanici_id] ?? null,
    toplam_puan: u.toplam_net_puan ?? 0,
  }));

  return {
    istatistikler: {
      yayinda_toplam_video: stat?.yayinda_toplam_video ?? 0,
      toplam_izleme_sayisi: stat?.toplam_izleme_sayisi ?? 0,
      en_cok_izlenen_video: stat?.en_cok_izlenen_video ?? null,
      en_cok_izleyen_takim: stat?.en_cok_izleyen_takim ?? null,
      en_cok_izleyen_bolge: stat?.en_cok_izleyen_bolge ?? null,
      en_cok_izleyen_utt: stat?.en_cok_izleyen_utt ?? null,
    },
    haftanin_enleri,
  };
}