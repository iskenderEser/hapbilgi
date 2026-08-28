// app/challenge-club/api/route.ts
//
// Challenge Club backend endpoint'i.
//
// GET ?tip=izlenecek-videolar  → BM'in GEÇERLİ TURDA henüz tamamlamadığı CC yayınları
//                                (tur bazlı — önceki turda tamamlanan video yeni turda
//                                 "tamamlanmamış" olarak başa döner; salt-okur tur hesabı)
// GET ?tip=bekleyen            → BM'e gelen, izlenmemiş, süresi geçmemiş challenge'lar
// GET ?tip=gonderdiklerim      → BM'in bu ay gönderdiği challenge'lar
// GET ?tip=uygun-aliciler&yayin_id=X → Challenge gönderilebilecek BM listesi
// GET ?tip=quota               → Bu ay kalan challenge kotası
//
// POST → Challenge gönder. Body: { yayin_id, alan_id }
//
// Lib katmanı maksimum kullanılır: uygunAliciListesi, kotaKontrol (3 fonksiyon),
// tekrarIzlemeKontrol, kayit.challengeOlustur.
// Bu route ince orchestration — iş mantığı lib/cc/* içinde.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi, sunucuHatasi } from "@/lib/utils/hataIsle";
import { uygunAliciListesi } from "@/lib/cclub/uygunAliciListesi";
import { aylikKotaKontrol, aliciAylikKontrol } from "@/lib/cclub/kotaKontrol";
import { tekrarIzlemeKontrol } from "@/lib/cclub/tekrarIzlemeKontrol";
import { challengeOlustur } from "@/lib/cclub/kayit";
import { AYLIK_MAX_GONDERIM } from "@/lib/cclub/sabitler";
import { ayBaslangici } from "@/lib/zaman/kontrol";
import { gecerliTurBaslangiclari } from "@/lib/tclub/tur/kayit";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ccKartMetrikleri } from "@/lib/cclub/kartDetaylari";
import { ogrenmeAraciBayraklari } from "@/lib/ogrenmeAraci/bayraklar";

type ChallengeDurumu = "bekliyor" | "izlendi";

function challengeDurumu(challenge: { izlendi_mi: boolean }): ChallengeDurumu {
  return challenge.izlendi_mi ? "izlendi" : "bekliyor";
}

interface ChallengeYayinSatiri {
  yayin_id: string;
  urun_adi?: string | null;
  teknik_adi?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  video_puani?: number | null;
  yayin_tarihi?: string | null;
  talep_no?: number | null;
  firma_adi?: string | null;
  icerik_turu?: string | null;
}

interface GelenChallengeRaw {
  challenge_id: string;
  yayin_id: string;
  created_at: string;
  gonderen?: { ad?: string; soyad?: string } | Array<{ ad?: string; soyad?: string }> | null;
}

interface ChallengeListKaydi {
  challenge_id: string;
  yayin_id: string;
  created_at: string;
  izlendi_mi: boolean;
  gonderen?: { ad?: string; soyad?: string } | null;
  alan?: { ad?: string; soyad?: string } | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") return rolHatasi("Sadece BM Challenge Club'a erişebilir.");

    const { data: kullanici, error: kError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar SELECT", kError);

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("cc_aktif")
      .eq("firma_id", kullanici.firma_id)
      .single();

    if (firmaError || !firma) return hataYaniti("Firma bilgisi alınamadı.", "firmalar SELECT — C-Club erişimi", firmaError);
    if (firma.cc_aktif !== true) return rolHatasi("Firmanızda C-Club erişimi kapalıdır.");

    const { searchParams } = new URL(request.url);
    const tip = searchParams.get("tip") || "izlenecek-videolar";

    // ─── tip=izlenecek-videolar ────────────────────────────────────────────
    // BM'in geçerli turda henüz tamamlamadığı CC yayınları. Önce kendisi izleyebilsin.
    if (tip === "izlenecek-videolar") {
      const simdi = new Date().toISOString();
      const [yayinlarRes, izlemelerRes, gelenChallengelerRes] = await Promise.all([
        adminSupabase
          .from("v_yayin_detay")
          .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi, talep_no, firma_adi, icerik_turu")
          .eq("durum", "yayinda")
          .in("arac_turu", Object.entries(ogrenmeAraciBayraklari()).filter(([, acik]) => acik).map(([tur]) => tur))
          .eq("firma_id", kullanici.firma_id)
          .contains("hedef_roller", ["bm"])
          .lte("yayin_tarihi", simdi)
          .or(`durdurma_tarihi.is.null,durdurma_tarihi.gt.${simdi}`)
          .order("yayin_tarihi", { ascending: false }),
        adminSupabase
          .from("cc_izleme_kayitlari")
          .select("yayin_id, izleme_baslangic")
          .eq("bm_id", kullanici.kullanici_id)
          .eq("tamamlandi_mi", true),
        adminSupabase
          .from("challenge_kayitlari")
          .select("challenge_id, yayin_id, created_at, gonderen:kullanicilar!gonderen_id(ad, soyad)")
          .eq("alan_id", kullanici.kullanici_id)
          .eq("izlendi_mi", false),
      ]);

      if (yayinlarRes.error) return hataYaniti("Yayınlar çekilemedi.", "v_yayin_detay SELECT", yayinlarRes.error);

      // Geçerli tur başlangıçları — SALT-OKUR toplu hesap (lib/tur/kayit.ts).
      // Tur bazlı bayrak: yalnızca geçerli turda tamamlanan izlemeler videoyu
      // "tamamlandı" işaretler; önceki turun izlemeleri işaretlemez (§4.1b).
      const yayinListesi = (yayinlarRes.data as ChallengeYayinSatiri[] | null) ?? [];
      const yayinIdler = yayinListesi.map(y => y.yayin_id);
      const turMap = await gecerliTurBaslangiclari(adminSupabase, yayinIdler);

      const tamamlananSet = new Set<string>();
      for (const iz of (izlemelerRes.data ?? []) as { yayin_id: string; izleme_baslangic: string }[]) {
        // Tur kaydı olmayan yayında epoch (eski davranış — her kayıt sayılır).
        const turBaslangic = turMap[iz.yayin_id]?.baslangic_tarihi ?? "2000-01-01T00:00:00Z";
        if (new Date(iz.izleme_baslangic) >= new Date(turBaslangic)) {
          tamamlananSet.add(iz.yayin_id);
        }
      }

      // Gelen bekleyen challenge haritası (kilitli kartlar için)
      const gelenChallengeMap: Record<string, { challenge_id: string; gonderen_adi: string }> = {};
      for (const c of (gelenChallengelerRes.data as GelenChallengeRaw[] | null) ?? []) {
        const turBaslangic = turMap[c.yayin_id]?.baslangic_tarihi ?? "2000-01-01T00:00:00Z";
        if (new Date(c.created_at) >= new Date(turBaslangic)) {
          const gonderenObj = Array.isArray(c.gonderen) ? c.gonderen[0] : c.gonderen;
          gelenChallengeMap[c.yayin_id] = {
            challenge_id: c.challenge_id,
            gonderen_adi: gonderenObj ? `${gonderenObj.ad ?? ""} ${gonderenObj.soyad ?? ""}`.trim() : "Bir Bölge Müdürü",
          };
        }
      }

      // UTT kartı alt bilgileri (extra, izlenme, beğeni/favori, daha_once_izledi).
      const metrikler = await ccKartMetrikleri(adminSupabase, yayinIdler, kullanici.kullanici_id);

      // Önce tamamlanmamışlar, sonra tamamlananlar
      const tumVideolar = yayinListesi.map(y => {
        const gelenChallenge = gelenChallengeMap[y.yayin_id];
        return {
          ...y,
          tamamlandi_mi: tamamlananSet.has(y.yayin_id),
          sonraki_tur_tarihi: turMap[y.yayin_id]?.sonraki_tur_tarihi ?? null,
          kilitli: !!gelenChallenge,
          gelen_challenge_id: gelenChallenge?.challenge_id ?? null,
          challenge_gonderen_adi: gelenChallenge?.gonderen_adi ?? null,
          ...(metrikler[y.yayin_id] ?? {}),
        };
      });
      tumVideolar.sort((a, b) => Number(a.tamamlandi_mi) - Number(b.tamamlandi_mi));

      return NextResponse.json({ videolar: tumVideolar }, { status: 200 });
    }

    // ─── tip=bekleyen ──────────────────────────────────────────────────────
    // BM'e gelen challenge'lar; durum gönderen tarafıyla aynı sözleşmeden üretilir.
    if (tip === "bekleyen") {
      const { data: challengeler, error: cError } = await adminSupabase
        .from("challenge_kayitlari")
        .select(`
          challenge_id, yayin_id, created_at, izlendi_mi,
          gonderen:kullanicilar!gonderen_id(ad, soyad)
        `)
        .eq("alan_id", kullanici.kullanici_id)
        .order("created_at", { ascending: false });

      if (cError) return hataYaniti("Bekleyen challenge'lar çekilemedi.", "challenge_kayitlari SELECT", cError);

      const challengeListesi = (challengeler as ChallengeListKaydi[] | null) ?? [];

      // Yayın bilgilerini ve UTT kartı alt bilgilerini ayrıca çek
      const yayinIdler = [...new Set(challengeListesi.map(c => c.yayin_id))];
      const yayinMap: Record<string, ChallengeYayinSatiri> = {};
      if (yayinIdler.length > 0) {
        const { data: yayinlar } = await adminSupabase
          .from("v_yayin_detay")
          .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi, talep_no, firma_adi, icerik_turu")
          .in("yayin_id", yayinIdler)
          .in("arac_turu", Object.entries(ogrenmeAraciBayraklari()).filter(([, acik]) => acik).map(([tur]) => tur));
        for (const y of (yayinlar as ChallengeYayinSatiri[] | null) ?? []) yayinMap[y.yayin_id] = y;
      }
      const metrikler = await ccKartMetrikleri(adminSupabase, yayinIdler, kullanici.kullanici_id);

      const sonuc = challengeListesi.map(c => ({
        ...c,
        durum: challengeDurumu(c),
        urun_adi: yayinMap[c.yayin_id]?.urun_adi ?? "-",
        teknik_adi: yayinMap[c.yayin_id]?.teknik_adi ?? "-",
        video_url: yayinMap[c.yayin_id]?.video_url ?? null,
        thumbnail_url: yayinMap[c.yayin_id]?.thumbnail_url ?? null,
        video_puani: yayinMap[c.yayin_id]?.video_puani ?? null,
        yayin_tarihi: yayinMap[c.yayin_id]?.yayin_tarihi ?? c.created_at,
        talep_no: yayinMap[c.yayin_id]?.talep_no ?? null,
        firma_adi: yayinMap[c.yayin_id]?.firma_adi ?? null,
        icerik_turu: yayinMap[c.yayin_id]?.icerik_turu ?? null,
        ...(metrikler[c.yayin_id] ?? {}),
      }));

      return NextResponse.json({ challengeler: sonuc }, { status: 200 });
    }

    // ─── tip=gonderdiklerim ────────────────────────────────────────────────
    // BM'in bu ay gönderdiği challenge'lar.
    if (tip === "gonderdiklerim") {
      const ayBas = ayBaslangici().toISOString();

      const { data: challengeler, error: cError } = await adminSupabase
        .from("challenge_kayitlari")
        .select(`
          challenge_id, yayin_id, created_at, izlendi_mi,
          alan:kullanicilar!alan_id(ad, soyad)
        `)
        .eq("gonderen_id", kullanici.kullanici_id)
        .gte("created_at", ayBas)
        .order("created_at", { ascending: false });

      if (cError) return hataYaniti("Gönderdiğin challenge'lar çekilemedi.", "challenge_kayitlari SELECT", cError);

      const challengeListesi = (challengeler as ChallengeListKaydi[] | null) ?? [];

      // Yayın bilgilerini ve UTT kartı alt bilgilerini ayrıca çek
      const yayinIdler = [...new Set(challengeListesi.map(c => c.yayin_id))];
      const yayinMap: Record<string, ChallengeYayinSatiri> = {};
      if (yayinIdler.length > 0) {
        const { data: yayinlar } = await adminSupabase
          .from("v_yayin_detay")
          .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi, talep_no, firma_adi, icerik_turu")
          .in("yayin_id", yayinIdler)
          .in("arac_turu", Object.entries(ogrenmeAraciBayraklari()).filter(([, acik]) => acik).map(([tur]) => tur));
        for (const y of (yayinlar as ChallengeYayinSatiri[] | null) ?? []) yayinMap[y.yayin_id] = y;
      }
      const metrikler = await ccKartMetrikleri(adminSupabase, yayinIdler, kullanici.kullanici_id);

      const sonuc = challengeListesi.map(c => ({
        ...c,
        durum: challengeDurumu(c),
        urun_adi: yayinMap[c.yayin_id]?.urun_adi ?? "-",
        teknik_adi: yayinMap[c.yayin_id]?.teknik_adi ?? "-",
        video_url: yayinMap[c.yayin_id]?.video_url ?? null,
        thumbnail_url: yayinMap[c.yayin_id]?.thumbnail_url ?? null,
        video_puani: yayinMap[c.yayin_id]?.video_puani ?? null,
        yayin_tarihi: yayinMap[c.yayin_id]?.yayin_tarihi ?? c.created_at,
        talep_no: yayinMap[c.yayin_id]?.talep_no ?? null,
        firma_adi: yayinMap[c.yayin_id]?.firma_adi ?? null,
        icerik_turu: yayinMap[c.yayin_id]?.icerik_turu ?? null,
        ...(metrikler[c.yayin_id] ?? {}),
      }));

      return NextResponse.json({ challengeler: sonuc }, { status: 200 });
    }

    // ─── tip=uygun-aliciler ────────────────────────────────────────────────
    // Challenge gönderebileceği BM listesi (her biri için engel sebebiyle).
    if (tip === "uygun-aliciler") {
      const yayin_id = searchParams.get("yayin_id");
      if (!yayin_id) return validasyonHatasi("yayin_id parametresi zorunludur.", ["yayin_id"]);

      const aliciList = await uygunAliciListesi(
        adminSupabase,
        kullanici.kullanici_id,
        kullanici.firma_id,
        yayin_id
      );

      return NextResponse.json({ aliciler: aliciList }, { status: 200 });
    }

    // ─── tip=quota ──────────────────────────────────────────────────────────
    // Bu ay kalan kota. Direkt count alıyoruz çünkü aylikKotaKontrol gecerli/sebep döner.
    if (tip === "quota") {
      const ayBas = ayBaslangici().toISOString();
      const { count, error: countError } = await adminSupabase
        .from("challenge_kayitlari")
        .select("challenge_id", { count: "exact", head: true })
        .eq("gonderen_id", kullanici.kullanici_id)
        .gte("created_at", ayBas);

      if (countError) return hataYaniti("Kota bilgisi alınamadı.", "challenge_kayitlari COUNT", countError);

      const kullanildi = count ?? 0;
      return NextResponse.json({
        kullanildi,
        limit: AYLIK_MAX_GONDERIM,
        kalan: Math.max(0, AYLIK_MAX_GONDERIM - kullanildi),
        dolu_mu: kullanildi >= AYLIK_MAX_GONDERIM,
      }, { status: 200 });
    }

    return validasyonHatasi(`Geçersiz tip parametresi: ${tip}`, ["tip"]);

  } catch (err) {
    return sunucuHatasi(err, "GET /challenge-club/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") return rolHatasi("Sadece BM challenge gönderebilir.");

    const { data: kullanici, error: kError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar SELECT", kError);

    const body = await request.json();
    const { yayin_id, alan_idler } = body;

    if (!yayin_id || typeof yayin_id !== "string") return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    if (!Array.isArray(alan_idler) || alan_idler.length === 0)
      return validasyonHatasi("En az bir alıcı BM seçilmelidir.", ["alan_idler"]);
    if (alan_idler.length > 100)
      return validasyonHatasi("Tek işlemde en fazla 100 alıcı seçilebilir.", ["alan_idler"]);
    if (alan_idler.some((a: unknown) => typeof a !== "string"))
      return validasyonHatasi("Geçersiz alıcı kimliği gönderildi.", ["alan_idler"]);

    const benzersizAlicilar = [...new Set(alan_idler as string[])];

    // Yayın kontrolü (bir kez)
    const { data: yayin, error: yError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, durum, hedef_roller, arac_turu")
      .eq("yayin_id", yayin_id)
      .single();

    if (yError || !yayin) return isKuraluHatasi("Yayın bulunamadı.");
    if (yayin.durum !== "yayinda") return isKuraluHatasi("Yayın aktif değil.");
    if (!ogrenmeAraciBayraklari()[yayin.arac_turu as keyof ReturnType<typeof ogrenmeAraciBayraklari>]) return isKuraluHatasi("Bu öğrenme aracı kullanıma kapalı.");
    if (!(yayin.hedef_roller ?? []).includes("bm")) return isKuraluHatasi("Sadece CC yayınları challenge'a alınabilir.");

    // İş kuralı 5 (global): BM kendisi bu videoyu izlemiş mi? (önce kendisi izlemeli)
    const { data: kendiIzleme } = await adminSupabase
      .from("cc_izleme_kayitlari")
      .select("izleme_id")
      .eq("bm_id", kullanici.kullanici_id)
      .eq("yayin_id", yayin_id)
      .eq("tamamlandi_mi", true)
      .limit(1)
      .maybeSingle();

    if (!kendiIzleme) {
      return isKuraluHatasi("Bu videoyu önce kendiniz izlemeden challenge'a alamazsınız.");
    }

    const gonderenAdi = `${kullanici.ad} ${kullanici.soyad}`;
    const videoAdi = yayin.urun_adi ?? yayin.teknik_adi ?? "video";

    // Çok alıcı → atla-raporla. Kurallar alıcı başına uygulanır; aylık kota her
    // turda yeniden okunur (başarılı gönderim kotayı tüketir).
    const gonderilen: string[] = [];
    const atlanan: { alan_id: string; sebep: string }[] = [];

    for (const alan_id of benzersizAlicilar) {
      if (alan_id === kullanici.kullanici_id) { atlanan.push({ alan_id, sebep: "Kendinize challenge gönderemezsiniz." }); continue; }

      // İş kuralı 1: Aylık kota
      const aylikKota = await aylikKotaKontrol(adminSupabase, kullanici.kullanici_id);
      if (!aylikKota.gecerli) { atlanan.push({ alan_id, sebep: aylikKota.sebep ?? "Aylık kota doldu." }); continue; }

      // Alıcı kullanıcı kontrolü
      const { data: alanKullanici } = await adminSupabase
        .from("kullanicilar")
        .select("kullanici_id, ad, soyad, rol, firma_id, aktif_mi")
        .eq("kullanici_id", alan_id)
        .single();
      if (!alanKullanici) { atlanan.push({ alan_id, sebep: "Alıcı bulunamadı." }); continue; }
      if (alanKullanici.rol !== "bm") { atlanan.push({ alan_id, sebep: "Yalnız BM'lere gönderilebilir." }); continue; }
      if (!alanKullanici.aktif_mi) { atlanan.push({ alan_id, sebep: "Alıcı aktif değil." }); continue; }
      if (alanKullanici.firma_id !== kullanici.firma_id) { atlanan.push({ alan_id, sebep: "Farklı firmadan BM'ye gönderilemez." }); continue; }

      // İş kuralı 2: Aynı alıcıya bu ay zaten gönderim
      const aliciKota = await aliciAylikKontrol(adminSupabase, kullanici.kullanici_id, alan_id);
      if (!aliciKota.gecerli) { atlanan.push({ alan_id, sebep: aliciKota.sebep ?? "Bu alıcıya bu ay zaten gönderildi." }); continue; }

      // İş kuralı 3: Tekrar izleme (alıcı bu videoyu izlemiş mi)
      const alanAdi = `${alanKullanici.ad} ${alanKullanici.soyad}`;
      const tekrar = await tekrarIzlemeKontrol(adminSupabase, alan_id, alanAdi, yayin_id);
      if (!tekrar.izlenmemis) { atlanan.push({ alan_id, sebep: `${tekrar.izleyenAdi} bu videoyu zaten izlemiş.` }); continue; }


      // Oluştur
      const sonuc = await challengeOlustur(
        adminSupabase,
        { gonderen_id: kullanici.kullanici_id, alan_id, yayin_id },
        { gonderenAdi, videoAdi }
      );
      if (!sonuc.ok) { atlanan.push({ alan_id, sebep: sonuc.error ?? "Challenge gönderilemedi." }); continue; }
      gonderilen.push(alan_id);
    }

    return NextResponse.json({
      mesaj: `${gonderilen.length} challenge gönderildi.`,
      gonderilen_sayisi: gonderilen.length,
      gonderilen,
      atlanan,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /challenge-club/api");
  }
}
