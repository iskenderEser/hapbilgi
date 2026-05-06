// lib/utils/anaSayfaVeri.ts
// Ana sayfa için role özel veri fonksiyonları.
// Yeni rol eklenince buraya fonksiyon eklenir, başka dosyaya dokunulmaz.

import { SupabaseClient } from "@supabase/supabase-js";

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

  const [
    { data: yayinlar, error: yayinError },
    { data: izlemeler },
    { data: kazanilanPuanlar },
  ] = await Promise.all([
    adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, video_puani, yayin_tarihi, thumbnail_url, video_url")
      .eq("durum", "Yayinda")
      .eq("takim_id", bolge?.takim_id)
      .order("yayin_tarihi", { ascending: false }),
    adminSupabase
      .from("izleme_kayitlari")
      .select("yayin_id, tamamlandi_mi")
      .eq("kullanici_id", userId),
    adminSupabase
      .from("kazanilan_puanlar")
      .select("puan, created_at")
      .eq("kullanici_id", userId),
  ]);

  if (yayinError) throw new Error("Yayınlar çekilemedi.");

  const tamamlananMap: Record<string, boolean> = {};
  const devamEdenMap: Record<string, boolean> = {};
  for (const iz of izlemeler ?? []) {
    if (iz.tamamlandi_mi) tamamlananMap[iz.yayin_id] = true;
    else devamEdenMap[iz.yayin_id] = true;
  }

  const haftaBaslangic = new Date();
  haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
  haftaBaslangic.setHours(0, 0, 0, 0);

  const toplam_puan = (kazanilanPuanlar ?? []).reduce((acc: number, p: any) => acc + (p.puan ?? 0), 0);
  const hafta_puani = (kazanilanPuanlar ?? [])
    .filter((p: any) => new Date(p.created_at) >= haftaBaslangic)
    .reduce((acc: number, p: any) => acc + (p.puan ?? 0), 0);

  // Yayın bilgileri (extra_puan, ileri_sarma_acik) toplu çek
  const yayinIdler = (yayinlar ?? []).map((y: any) => y.yayin_id);
  const [
    { data: yayinBilgileri },
    { data: begeniSayilari },
    { data: favoriSayilari },
    { data: kullaniciBegeni },
    { data: kullaniciFavori },
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

  const kullaniciBegeniSet = new Set((kullaniciBegeni ?? []).map((b: any) => b.yayin_id));
  const kullaniciFavoriSet = new Set((kullaniciFavori ?? []).map((f: any) => f.yayin_id));

  const videoToItem = (y: any) => ({
    yayin_id: y.yayin_id,
    urun_adi: y.urun_adi ?? "-",
    teknik_adi: y.teknik_adi ?? "-",
    video_url: y.video_url ?? null,
    thumbnail_url: y.thumbnail_url ?? null,
    video_puani: y.video_puani ?? null,
    yayin_tarihi: y.yayin_tarihi,
    extra_puan: extraPuanMap[y.yayin_id] ?? 0,
    ileri_sarma_acik: ileriSarmaMap[y.yayin_id] ?? false,
    begeni_sayisi: begeniSayiMap[y.yayin_id] ?? 0,
    favori_sayisi: favoriSayiMap[y.yayin_id] ?? 0,
    begeni_mi: kullaniciBegeniSet.has(y.yayin_id),
    favori_mi: kullaniciFavoriSet.has(y.yayin_id),
    daha_once_izledi: tamamlananMap[y.yayin_id] ?? false,
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

  const { data: bolgeler } = await adminSupabase
    .from("bolgeler")
    .select("bolge_id, bolge_adi")
    .eq("takim_id", kullanici.takim_id);

  const bolgeMap: Record<string, string> = {};
  for (const b of bolgeler ?? []) {
    bolgeMap[b.bolge_id] = b.bolge_adi;
  }

  const { data: bmler } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad, bolge_id")
    .eq("takim_id", kullanici.takim_id)
    .eq("rol", "bm")
    .eq("aktif_mi", true);

  const haftaBaslangic = new Date();
  haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
  haftaBaslangic.setHours(0, 0, 0, 0);

  const bmIdler = (bmler ?? []).map((b: any) => b.kullanici_id);

  const { data: tumOneriler } = bmIdler.length > 0
    ? await adminSupabase
        .from("oneri_kayitlari")
        .select("oneri_id, oneren_id, izlendi_mi, created_at")
        .in("oneren_id", bmIdler)
    : { data: [] };

  const satirlar = (bmler ?? []).map((bm: any) => {
    const bmOneriler = (tumOneriler ?? []).filter((o: any) => o.oneren_id === bm.kullanici_id);
    const haftaOneriler = bmOneriler.filter((o: any) => new Date(o.created_at) >= haftaBaslangic);
    return {
      kullanici_id: bm.kullanici_id,
      bm_adi: `${bm.ad} ${bm.soyad}`,
      bolge_adi: bolgeMap[bm.bolge_id] ?? "-",
      hafta_oneri: haftaOneriler.length,
      bekleyen: bmOneriler.filter((o: any) => !o.izlendi_mi).length,
      tamamlanan: bmOneriler.filter((o: any) => o.izlendi_mi).length,
    };
  });

  return {
    satirlar,
    istatistikler: {
      bm_sayisi: (bmler ?? []).length,
      hafta_aktif_bm: satirlar.filter(s => s.hafta_oneri > 0).length,
      toplam_bekleyen: satirlar.reduce((acc, s) => acc + s.bekleyen, 0),
      toplam_tamamlanan: satirlar.reduce((acc, s) => acc + s.tamamlanan, 0),
    },
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
      .eq("durum", "Senaryo Yaziliyor")
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("video_durumu")
      .select("video_durum_id, video_id, created_at")
      .eq("durum", "Inceleme Bekleniyor")
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_durum_id, soru_seti_id, created_at")
      .eq("durum", "Inceleme Bekleniyor")
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

// ─── PM / PM_ROLLERI ──────────────────────────────────────────────────────────

interface TakipSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  asama: "Senaryo" | "Video" | "Soru Seti" | "Yayın";
  durum: string;
  tarih: string;
  yol: string;
  kategori: "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan" | "devam";
}

export async function getPmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: talepler, error: talepError } = await adminSupabase
    .from("talepler")
    .select(`talep_id, created_at, egitim_turu, urunler(urun_adi), teknikler(teknik_adi)`)
    .eq("pm_id", userId)
    .order("created_at", { ascending: false });

  if (talepError) throw new Error("Talepler çekilemedi.");

  const satirlar: TakipSatiri[] = [];
  let inceleme_bekleyen = 0;
  let yayin_bekleyen = 0;
  let yayinda = 0;

  for (const talep of talepler ?? []) {
    const egitimTuru = (talep as any).egitim_turu ?? "urun_egitimi";
    const urun_adi = egitimTuru === "genel_egitim" ? "Genel Eğitim" : ((talep as any).urunler?.urun_adi ?? "-");
    const teknik_adi = egitimTuru === "genel_egitim" ? "-" : ((talep as any).teknikler?.teknik_adi ?? "-");

    const { data: senaryolar } = await adminSupabase
      .from("senaryolar")
      .select("senaryo_id")
      .eq("talep_id", talep.talep_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSenaryo = senaryolar?.[0];

    if (!sonSenaryo) {
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum: "Senaryo Bekleniyor", tarih: talep.created_at, yol: `/talepler/${talep.talep_id}`, kategori: "devam" });
      continue;
    }

    const { data: senaryoDurumlar } = await adminSupabase
      .from("senaryo_durumu")
      .select("durum, senaryo_durum_id, created_at")
      .eq("senaryo_id", sonSenaryo.senaryo_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSD = senaryoDurumlar?.[0];

    if (!sonSD || sonSD.durum !== "Onaylandi") {
      const durum = sonSD?.durum === "Inceleme Bekleniyor" ? "İnceleme Bekliyor" :
                    sonSD?.durum === "Revizyon Bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonSD?.durum === "Inceleme Bekleniyor" ? "inceleme" : "devam";
      if (sonSD?.durum === "Inceleme Bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Senaryo", durum, tarih: sonSD?.created_at ?? talep.created_at, yol: `/senaryolar/${talep.talep_id}`, kategori });
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
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum: "Video Bekleniyor", tarih: sonSD.created_at, yol: `/videolar`, kategori: "devam" });
      continue;
    }

    const { data: videoDurumlar } = await adminSupabase
      .from("video_durumu")
      .select("durum, video_durum_id, created_at")
      .eq("video_id", sonVideo.video_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonVD = videoDurumlar?.[0];

    if (!sonVD || sonVD.durum !== "Onaylandi") {
      const durum = sonVD?.durum === "Inceleme Bekleniyor" ? "İnceleme Bekliyor" :
                    sonVD?.durum === "Revizyon Bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonVD?.durum === "Inceleme Bekleniyor" ? "inceleme" : "devam";
      if (sonVD?.durum === "Inceleme Bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Video", durum, tarih: sonVD?.created_at ?? sonSD.created_at, yol: `/videolar`, kategori });
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
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum: "Soru Seti Bekleniyor", tarih: sonVD.created_at, yol: `/soru-setleri`, kategori: "devam" });
      continue;
    }

    const { data: soruSetiDurumlar } = await adminSupabase
      .from("soru_seti_durumu")
      .select("durum, soru_seti_durum_id, created_at")
      .eq("soru_seti_id", sonSoruSeti.soru_seti_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sonSSD = soruSetiDurumlar?.[0];

    if (!sonSSD || sonSSD.durum !== "Onaylandi") {
      const durum = sonSSD?.durum === "Inceleme Bekleniyor" ? "İnceleme Bekliyor" :
                    sonSSD?.durum === "Revizyon Bekleniyor" ? "Revizyon Gönderildi" : "Devam Ediyor";
      const kategori = sonSSD?.durum === "Inceleme Bekleniyor" ? "inceleme" : "devam";
      if (sonSSD?.durum === "Inceleme Bekleniyor") inceleme_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Soru Seti", durum, tarih: sonSSD?.created_at ?? sonVD.created_at, yol: `/soru-setleri`, kategori });
      continue;
    }

    const { data: yayin } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum, yayin_tarihi")
      .eq("soru_seti_durum_id", sonSSD.soru_seti_durum_id)
      .maybeSingle();

    if (!yayin) {
      yayin_bekleyen++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Yayın", durum: "Yayın Bekliyor", tarih: sonSSD.created_at, yol: `/yayin-yonetimi`, kategori: "yayin-bekleyen" });
    } else if (yayin.durum === "Yayinda") {
      yayinda++;
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Yayın", durum: "Yayında", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "yayinda" });
    } else {
      satirlar.push({ talep_id: talep.talep_id, urun_adi, teknik_adi, asama: "Yayın", durum: "Durduruldu", tarih: yayin.yayin_tarihi, yol: `/yayin-yonetimi`, kategori: "durdurulan" });
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

  const [
    { data: yayinlar },
    { data: kullanicilar },
  ] = await Promise.all([
    adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, durum, yayin_tarihi")
      .eq("durum", "Yayinda")
      .order("yayin_tarihi", { ascending: false })
      .limit(10),
    adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, rol, aktif_mi")
      .eq("firma_id", kullanici.firma_id)
      .eq("aktif_mi", true),
  ]);

  const rolSayilari: Record<string, number> = {};
  for (const k of kullanicilar ?? []) {
    rolSayilari[k.rol] = (rolSayilari[k.rol] ?? 0) + 1;
  }

  return {
    son_yayinlar: yayinlar ?? [],
    istatistikler: {
      toplam_kullanici: (kullanicilar ?? []).length,
      aktif_yayin: (yayinlar ?? []).length,
      rol_dagilimi: rolSayilari,
    },
  };
}

// ─── EĞİTİMCİ (egt_md, egt_yrd_md, egt_yon, egt_uz) ──────────────────────────

export async function getEgitimciAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const [pmVeri, tmVeri] = await Promise.all([
    getPmAnaSayfaVeri(userId, adminSupabase),
    getTmAnaSayfaVeri(userId, adminSupabase),
  ]);

  return {
    ...pmVeri,
    bm_satirlari: tmVeri.satirlar,
    bm_istatistikler: tmVeri.istatistikler,
  };
}