// app/challenge-club/api/route.ts
//
// Challenge Club backend endpoint'i.
//
// GET ?tip=izlenecek-videolar  → BM'in henüz tamamlamadığı CC yayınları
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
import { uygunAliciListesi } from "@/lib/cc/uygunAliciListesi";
import { aylikKotaKontrol, aliciAylikKontrol, karsiliklilikKilidi } from "@/lib/cc/kotaKontrol";
import { tekrarIzlemeKontrol } from "@/lib/cc/tekrarIzlemeKontrol";
import { challengeOlustur } from "@/lib/cc/kayit";
import { AYLIK_MAX_GONDERIM } from "@/lib/cc/sabitler";
import { ayBaslangici } from "@/lib/zaman/kontrol";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "bm") return rolHatasi("Sadece BM Challenge Club'a erişebilir.");

    const { data: kullanici, error: kError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar SELECT", kError);

    const { searchParams } = new URL(request.url);
    const tip = searchParams.get("tip") || "izlenecek-videolar";

    // ─── tip=izlenecek-videolar ────────────────────────────────────────────
    // BM'in henüz tamamlamadığı CC yayınları. Önce kendisi izleyebilsin.
    if (tip === "izlenecek-videolar") {
      const [yayinlarRes, izlemelerRes] = await Promise.all([
        adminSupabase
          .from("v_yayin_detay")
          .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi")
          .eq("durum", "yayinda")
          .eq("hedef_rol", "bm")
          .order("yayin_tarihi", { ascending: false }),
        adminSupabase
          .from("cc_izleme_kayitlari")
          .select("yayin_id")
          .eq("bm_id", kullanici.kullanici_id)
          .eq("tamamlandi_mi", true),
      ]);

      if (yayinlarRes.error) return hataYaniti("Yayınlar çekilemedi.", "v_yayin_detay SELECT", yayinlarRes.error);

      const tamamlananSet = new Set<string>(
        (izlemelerRes.data ?? []).map((iz: { yayin_id: string }) => iz.yayin_id)
      );

      // Önce tamamlanmamışlar, sonra tamamlananlar
      const tumVideolar = (yayinlarRes.data ?? []).map((y: any) => ({
        ...y,
        tamamlandi_mi: tamamlananSet.has(y.yayin_id),
      }));
      tumVideolar.sort((a: any, b: any) => Number(a.tamamlandi_mi) - Number(b.tamamlandi_mi));

      return NextResponse.json({ videolar: tumVideolar }, { status: 200 });
    }

    // ─── tip=bekleyen ──────────────────────────────────────────────────────
    // BM'e gelen, izlenmemiş, süresi geçmemiş challenge'lar.
    if (tip === "bekleyen") {
      const { data: challengeler, error: cError } = await adminSupabase
        .from("challenge_kayitlari")
        .select(`
          challenge_id, yayin_id, son_tarih, created_at, izlendi_mi,
          gonderen:kullanicilar!gonderen_id(ad, soyad)
        `)
        .eq("alan_id", kullanici.kullanici_id)
        .eq("izlendi_mi", false)
        .gte("son_tarih", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (cError) return hataYaniti("Bekleyen challenge'lar çekilemedi.", "challenge_kayitlari SELECT", cError);

      // Yayın bilgilerini ayrıca çek
      const yayinIdler = [...new Set((challengeler ?? []).map((c: any) => c.yayin_id))];
      const yayinMap: Record<string, { urun_adi: string; teknik_adi: string; thumbnail_url: string | null }> = {};
      if (yayinIdler.length > 0) {
        const { data: yayinlar } = await adminSupabase
          .from("v_yayin_detay")
          .select("yayin_id, urun_adi, teknik_adi, thumbnail_url")
          .in("yayin_id", yayinIdler);
        for (const y of yayinlar ?? []) {
          yayinMap[y.yayin_id] = {
            urun_adi: y.urun_adi ?? "-",
            teknik_adi: y.teknik_adi ?? "-",
            thumbnail_url: y.thumbnail_url ?? null,
          };
        }
      }

      const sonuc = (challengeler ?? []).map((c: any) => ({
        ...c,
        urun_adi: yayinMap[c.yayin_id]?.urun_adi ?? "-",
        teknik_adi: yayinMap[c.yayin_id]?.teknik_adi ?? "-",
        thumbnail_url: yayinMap[c.yayin_id]?.thumbnail_url ?? null,
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
          challenge_id, yayin_id, son_tarih, created_at, izlendi_mi,
          alan:kullanicilar!alan_id(ad, soyad)
        `)
        .eq("gonderen_id", kullanici.kullanici_id)
        .gte("created_at", ayBas)
        .order("created_at", { ascending: false });

      if (cError) return hataYaniti("Gönderdiğin challenge'lar çekilemedi.", "challenge_kayitlari SELECT", cError);

      // Yayın bilgilerini ayrıca çek
      const yayinIdler = [...new Set((challengeler ?? []).map((c: any) => c.yayin_id))];
      const yayinMap: Record<string, { urun_adi: string; teknik_adi: string }> = {};
      if (yayinIdler.length > 0) {
        const { data: yayinlar } = await adminSupabase
          .from("v_yayin_detay")
          .select("yayin_id, urun_adi, teknik_adi")
          .in("yayin_id", yayinIdler);
        for (const y of yayinlar ?? []) {
          yayinMap[y.yayin_id] = {
            urun_adi: y.urun_adi ?? "-",
            teknik_adi: y.teknik_adi ?? "-",
          };
        }
      }

      const sonuc = (challengeler ?? []).map((c: any) => ({
        ...c,
        urun_adi: yayinMap[c.yayin_id]?.urun_adi ?? "-",
        teknik_adi: yayinMap[c.yayin_id]?.teknik_adi ?? "-",
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

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "bm") return rolHatasi("Sadece BM challenge gönderebilir.");

    const { data: kullanici, error: kError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar SELECT", kError);

    const body = await request.json();
    const { yayin_id, alan_id } = body;

    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    if (!alan_id) return validasyonHatasi("alan_id zorunludur.", ["alan_id"]);
    if (alan_id === kullanici.kullanici_id) return isKuraluHatasi("Kendinize challenge gönderemezsiniz.");

    // Alan kullanıcı kontrolü
    const { data: alanKullanici, error: alanError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol, firma_id, aktif_mi")
      .eq("kullanici_id", alan_id)
      .single();

    if (alanError || !alanKullanici) return isKuraluHatasi("Alıcı kullanıcı bulunamadı.");
    if (alanKullanici.rol !== "bm") return isKuraluHatasi("Challenge sadece BM'lere gönderilebilir.");
    if (!alanKullanici.aktif_mi) return isKuraluHatasi("Alıcı kullanıcı aktif değil.");
    if (alanKullanici.firma_id !== kullanici.firma_id) return isKuraluHatasi("Farklı firmadan BM'ye challenge gönderilemez.");

    // Yayın kontrolü
    const { data: yayin, error: yError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, durum, hedef_rol")
      .eq("yayin_id", yayin_id)
      .single();

    if (yError || !yayin) return isKuraluHatasi("Yayın bulunamadı.");
    if (yayin.durum !== "yayinda") return isKuraluHatasi("Yayın aktif değil.");
    if (yayin.hedef_rol !== "bm") return isKuraluHatasi("Sadece CC yayınları challenge'a alınabilir.");

    // İş kuralı 1: Aylık kota kontrolü
    const aylikKota = await aylikKotaKontrol(adminSupabase, kullanici.kullanici_id);
    if (!aylikKota.gecerli) {
      return isKuraluHatasi(aylikKota.sebep ?? "Aylık kota kontrolü başarısız.");
    }

    // İş kuralı 2: Aynı alıcıya bu ay zaten gönderim yapılmış mı?
    const aliciKota = await aliciAylikKontrol(adminSupabase, kullanici.kullanici_id, alan_id);
    if (!aliciKota.gecerli) {
      return isKuraluHatasi(aliciKota.sebep ?? "Alıcıya aylık kota kontrolü başarısız.");
    }

    // İş kuralı 3: Karşılıklılık kilidi (alan BM bu ay bana gönderdi mi?)
    const karsiliklilik = await karsiliklilikKilidi(adminSupabase, kullanici.kullanici_id, alan_id);
    if (!karsiliklilik.gecerli) {
      return isKuraluHatasi(karsiliklilik.sebep ?? "Karşılıklılık kontrolü başarısız.");
    }

    // İş kuralı 4: Tekrar izleme kontrolü (alan BM bu videoyu zaten izlemiş mi?)
    const alanAdi = `${alanKullanici.ad} ${alanKullanici.soyad}`;
    const tekrar = await tekrarIzlemeKontrol(adminSupabase, alan_id, alanAdi, yayin_id);
    if (!tekrar.izlenmemis) {
      return isKuraluHatasi(`${tekrar.izleyenAdi} bu videoyu zaten izlemiş.`);
    }

    // İş kuralı 5: BM kendisi bu videoyu izlemiş mi? (önce kendisi izlemiş olmalı)
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

    // Tüm kontroller geçti. Challenge oluştur.
    const gonderenAdi = `${kullanici.ad} ${kullanici.soyad}`;
    const videoAdi = yayin.urun_adi ?? yayin.teknik_adi ?? "video";

    const sonuc = await challengeOlustur(
      adminSupabase,
      {
        gonderen_id: kullanici.kullanici_id,
        alan_id,
        yayin_id,
      },
      {
        gonderenAdi,
        videoAdi,
      }
    );

    if (!sonuc.ok) {
      return hataYaniti(sonuc.error ?? "Challenge oluşturulamadı.", "challengeOlustur", null);
    }

    return NextResponse.json({ mesaj: "Challenge gönderildi." }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /challenge-club/api");
  }
}