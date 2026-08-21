// app/eczanem/eczane/api/siparisler/route.ts
// Eczacı kasa ucu (İP-§8.1.4): GET onay kuyruğu (bekliyor) + geçmiş,
// POST onayla (atomik FIFO RPC) / reddet (düşür). Müşteri yalnız son-4-hane
// (İP-§9.2). İş mantığı lib/eczanem/kasa.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { eczaciAktifEczanesi } from "@/lib/eczanem/eczaci";
import { siparisOnayla, siparisReddet } from "@/lib/eczanem/kasa";
import { gunBaslangici } from "@/lib/zaman/kontrol";

interface SiparisSatiri {
  siparis_id: string;
  musteri_id: string | null;
  musteri_etiket: string | null;
  urun_id: string;
  adet: number;
  kullanilan_puan: number;
  indirim_tl: number | string;
  durum: string;
  islem_kodu: string | null;
  onay_tarihi: string | null;
  karar_tarihi: string | null;
  islem_yapan_kisi_id: string | null;
  created_at: string;
}

interface UrunSatiri { urun_id: string; urun_adi: string; firma_id: string; }
interface MusteriSatiri { musteri_id: string; telefon: string; }

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız eczacı/teknisyen erişebilir.");

    const eden = await eczaciAktifEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const bekleyenSayfa = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("bekleyen_sayfa") ?? "1", 10) || 1);
    const gecmisSayfa = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("gecmis_sayfa") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(10, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));
    const gecmisDurum = request.nextUrl.searchParams.get("durum") ?? "tumu";
    if (!['tumu', 'onaylandi', 'dustu'].includes(gecmisDurum)) return validasyonHatasi("Geçersiz sipariş durumu.", ["durum"]);

    // Kuyruk, sayfalama ve sayaçlar yalnız eczanede Eczanem'i açan firmaların
    // ürünlerinden oluşmalı. Sonradan satır süzmek toplamları ve sayfa sayısını
    // görünür listeyle ayrıştırır; bu nedenle kapsam sipariş sorgusuna girer.
    const { data: urunler, error: urunHatasi } = await adminSupabase
      .from("urunler")
      .select("urun_id, urun_adi, firma_id")
      .in("firma_id", eden.firmaIdler!);
    if (urunHatasi) return hataYaniti("Sipariş ürünleri çekilemedi.", "urunler SELECT — sipariş firma kapsamı", urunHatasi);

    const urunAd = new Map<string, string>();
    const izinliUrunIdler: string[] = [];
    for (const urunRaw of urunler ?? []) {
      const urun = urunRaw as UrunSatiri;
      urunAd.set(urun.urun_id, urun.urun_adi);
      izinliUrunIdler.push(urun.urun_id);
    }

    if (izinliUrunIdler.length === 0) {
      return NextResponse.json({
        bekleyen: [],
        gecmis: [],
        ozet: { bekleyen: 0, bugun_onaylanan: 0, gecmis: 0 },
        sayfalama: {
          bekleyen: { sayfa: bekleyenSayfa, toplam: 0, toplam_sayfa: 1 },
          gecmis: { sayfa: gecmisSayfa, toplam: 0, toplam_sayfa: 1 },
        },
      }, { status: 200 });
    }

    const secim = "siparis_id, musteri_id, musteri_etiket, urun_id, adet, kullanilan_puan, indirim_tl, durum, islem_kodu, onay_tarihi, karar_tarihi, islem_yapan_kisi_id, created_at";
    const bekleyenBaslangic = (bekleyenSayfa - 1) * limit;
    const gecmisBaslangic = (gecmisSayfa - 1) * limit;
    const bugun = gunBaslangici(new Date()).toISOString();

    const bekleyenSorgusu = adminSupabase
      .from("eczanem_siparisler")
      .select(secim, { count: "exact" })
      .eq("eczane_id", eden.eczaneId!)
      .in("urun_id", izinliUrunIdler)
      .eq("durum", "bekliyor")
      .order("created_at", { ascending: true })
      .range(bekleyenBaslangic, bekleyenBaslangic + limit - 1);
    let gecmisSorgusu = adminSupabase
      .from("eczanem_siparisler")
      .select(secim, { count: "exact" })
      .eq("eczane_id", eden.eczaneId!)
      .in("urun_id", izinliUrunIdler)
      .neq("durum", "bekliyor")
      .order("karar_tarihi", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(gecmisBaslangic, gecmisBaslangic + limit - 1);
    if (gecmisDurum !== "tumu") gecmisSorgusu = gecmisSorgusu.eq("durum", gecmisDurum);

    const [bekleyenSonucu, gecmisSonucu, bugunOnaySonucu] = await Promise.all([
      bekleyenSorgusu,
      gecmisSorgusu,
      adminSupabase.from("eczanem_siparisler").select("siparis_id", { count: "exact", head: true })
        .eq("eczane_id", eden.eczaneId!).in("urun_id", izinliUrunIdler).eq("durum", "onaylandi").gte("onay_tarihi", bugun),
    ]);
    const okumaHatasi = bekleyenSonucu.error ?? gecmisSonucu.error ?? bugunOnaySonucu.error;
    if (okumaHatasi) return hataYaniti("Siparişler çekilemedi.", "eczanem_siparisler SELECT — kuyruk/geçmiş", okumaHatasi);
    const siparisler = [...(bekleyenSonucu.data ?? []), ...(gecmisSonucu.data ?? [])] as SiparisSatiri[];

    // Müşteri son-4-hane (İP-§9.2: ad-soyad ASLA; yalnız maske). Silinmişse musteri_etiket.
    const musteriIdler = [...new Set(siparisler.map((siparis) => siparis.musteri_id).filter((id): id is string => Boolean(id)))];
    const musteriTel = new Map<string, string>();
    if (musteriIdler.length > 0) {
      const { data: musteriler, error: musteriHatasi } = await adminSupabase.from("eczanem_musteriler").select("musteri_id, telefon").in("musteri_id", musteriIdler);
      if (musteriHatasi) return hataYaniti("Sipariş müşteri etiketleri çekilemedi.", "eczanem_musteriler SELECT — sipariş kuyruğu", musteriHatasi);
      for (const musteriRaw of musteriler ?? []) {
        const musteri = musteriRaw as MusteriSatiri;
        musteriTel.set(musteri.musteri_id, musteri.telefon);
      }
    }

    const kisiIdler = [...new Set(siparisler.map((siparis) => siparis.islem_yapan_kisi_id).filter((id): id is string => Boolean(id)))];
    const kisiAd = new Map<string, string>();
    if (kisiIdler.length > 0) {
      const { data: kisiler, error: kisiHatasi } = await adminSupabase.from("eclub_kisiler").select("kisi_id, ad, soyad").in("kisi_id", kisiIdler);
      if (kisiHatasi) return hataYaniti("İşlem personeli çekilemedi.", "eclub_kisiler SELECT — sipariş geçmişi", kisiHatasi);
      for (const kisi of kisiler ?? []) kisiAd.set(kisi.kisi_id, `${kisi.ad ?? ""} ${kisi.soyad ?? ""}`.trim());
    }

    const sonuc = siparisler.map((siparis) => ({
      siparis_id: siparis.siparis_id,
      musteri_maskeli: siparis.musteri_id
        ? `••• ••• ${(musteriTel.get(siparis.musteri_id) ?? "").slice(-4)}`
        : (siparis.musteri_etiket ?? "Silinmiş müşteri"),
      urun_adi: urunAd.get(siparis.urun_id) ?? "-",
      adet: siparis.adet,
      kullanilan_puan: siparis.kullanilan_puan,
      indirim_tl: Number(siparis.indirim_tl),
      durum: siparis.durum,
      islem_kodu: siparis.islem_kodu,
      onay_tarihi: siparis.onay_tarihi,
      karar_tarihi: siparis.karar_tarihi,
      islem_yapan: siparis.islem_yapan_kisi_id ? kisiAd.get(siparis.islem_yapan_kisi_id) ?? null : null,
      created_at: siparis.created_at,
    }));

    const bekleyen = sonuc.filter((siparis) => siparis.durum === "bekliyor");
    const gecmis = sonuc.filter((siparis) => siparis.durum !== "bekliyor");
    const bekleyenToplam = bekleyenSonucu.count ?? 0;
    const gecmisToplam = gecmisSonucu.count ?? 0;
    return NextResponse.json({
      bekleyen,
      gecmis,
      ozet: { bekleyen: bekleyenToplam, bugun_onaylanan: bugunOnaySonucu.count ?? 0, gecmis: gecmisToplam },
      sayfalama: {
        bekleyen: { sayfa: bekleyenSayfa, toplam: bekleyenToplam, toplam_sayfa: Math.max(1, Math.ceil(bekleyenToplam / limit)) },
        gecmis: { sayfa: gecmisSayfa, toplam: gecmisToplam, toplam_sayfa: Math.max(1, Math.ceil(gecmisToplam / limit)) },
      },
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/eczane/api/siparisler");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Sadece eczacı/teknisyen işlem yapabilir.");

    const eden = await eczaciAktifEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const body = await request.json();
    const { siparis_id, aksiyon } = body;
    if (typeof siparis_id !== "string" || !siparis_id) return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);
    if (aksiyon !== "onayla" && aksiyon !== "reddet") return validasyonHatasi("aksiyon 'onayla' veya 'reddet' olmalı.", ["aksiyon"]);

    // Sipariş bu eczaneye mi ait?
    const { data: siparis } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, eczane_id, urun_id, durum")
      .eq("siparis_id", siparis_id)
      .maybeSingle();
    if (!siparis) return hataYaniti("Sipariş bulunamadı.", "eczanem_siparisler SELECT — siparis_id", null, 404);
    if (siparis.eczane_id !== eden.eczaneId) return rolHatasi("Bu sipariş sizin eczanenize ait değil.");

    // Firma kapısı onay ve red için aynıdır. Kuyrukta görünmeyen/erişimi kapanmış
    // bir firmanın siparişi, kimliği bilinerek POST üzerinden işlenemez.
    const { data: urun } = await adminSupabase
      .from("urunler")
      .select("firma_id")
      .eq("urun_id", siparis.urun_id)
      .maybeSingle();
    if (!urun?.firma_id || !eden.firmaIdler!.includes(urun.firma_id)) {
      return rolHatasi("Bu siparişin firması için Eczanem kapalıdır.");
    }

    if (aksiyon === "reddet") {
      const r = await siparisReddet(adminSupabase, siparis_id, eden.eczaneId!, eden.kisiId!);
      if (!r.ok) return isKuraluHatasi(r.hata ?? "Reddedilemedi.");
      return NextResponse.json({ ok: true, mesaj: "Sipariş düşürüldü." }, { status: 200 });
    }

    // onayla — atomik FIFO düşüm RPC'si
    const onay = await siparisOnayla(adminSupabase, siparis_id, eden.eczaneId!, eden.kisiId!);
    if (!onay.ok) return isKuraluHatasi(onay.hata ?? "Onaylanamadı.");
    return NextResponse.json({
      ok: true,
      mesaj: "Sipariş onaylandı.",
      islem_kodu: onay.islem_kodu,
      indirim_tl: onay.indirim_tl,
      kullanilan_puan: onay.kullanilan_puan,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/eczane/api/siparisler");
  }
}
