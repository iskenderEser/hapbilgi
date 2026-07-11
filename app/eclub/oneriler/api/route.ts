// app/eclub/oneriler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import {
  aylikKrediKontrol,
  aliciLimitKontrol,
  tekrarKontrol,
  oneriBitisHesapla,
} from "@/lib/eclub/oneriLimit";
import { eclubBildirimOlustur } from "@/lib/utils/eclubBildirim";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_HEDEF_ROLLER } from "@/lib/utils/roller";

const ECLUB_UTT_ROLLERI = ["utt", "kd_utt"];

// Verilen kişi_id'ler için "kisi_id → eczane_adi" haritası kurar.
// Zincir: eclub_kisi_eczane(aktif bağ) → eclub_eczaneler(gln) → eclub_eczane_master(eczane_adi).
// Eczacı/teknisyen aktif olarak tek eczaneye bağlıdır (tek ad döner).
async function kisiEczaneAdiMap(
  adminSupabase: ReturnType<typeof createAdminClient>,
  kisiIdler: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (kisiIdler.length === 0) return map;

  // 1. Aktif kişi-eczane bağları
  const { data: baglar } = await adminSupabase
    .from("eclub_kisi_eczane")
    .select("kisi_id, eczane_id")
    .in("kisi_id", kisiIdler)
    .eq("aktif_mi", true);

  if (!baglar || baglar.length === 0) return map;

  const eczaneIdler = [...new Set(baglar.map((b: any) => b.eczane_id))];

  // 2. Eczane → gln
  const { data: eczaneler } = await adminSupabase
    .from("eclub_eczaneler")
    .select("eczane_id, gln")
    .in("eczane_id", eczaneIdler);

  const eczaneGlnMap = new Map<string, string>();
  for (const e of eczaneler ?? []) eczaneGlnMap.set((e as any).eczane_id, (e as any).gln);

  const glnler = [...new Set((eczaneler ?? []).map((e: any) => e.gln))];

  // 3. gln → eczane_adi (master)
  const { data: masterlar } = await adminSupabase
    .from("eclub_eczane_master")
    .select("gln, eczane_adi")
    .in("gln", glnler);

  const glnAdiMap = new Map<string, string>();
  for (const m of masterlar ?? []) glnAdiMap.set((m as any).gln, (m as any).eczane_adi);

  // 4. kisi_id → eczane_adi birleştir
  for (const b of baglar) {
    const gln = eczaneGlnMap.get((b as any).eczane_id);
    const adi = gln ? glnAdiMap.get(gln) : null;
    if (adi) map.set((b as any).kisi_id, adi);
  }

  return map;
}

// ─── GET: UTT'nin öneri geçmişi ──────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_UTT_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız UTT/KD_UTT erişebilir.");

    // UTT'nin gönderdiği öneriler + alıcı (eclub_kisiler) temel bilgisi.
    // Eczane adı ayrı sorgu+Map ile çözülür (eczane bağı eclub_kisiler'de değil,
    // eclub_kisi_eczane → eclub_eczaneler → eclub_eczane_master zincirindedir).
    const { data: oneriler, error } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select(`
        oneri_id, yayin_id, kisi_id, oneri_baslangic, oneri_bitis, izlendi_mi, created_at,
        eclub_kisiler ( ad, soyad, rol )
      `)
      .eq("oneren_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return hataYaniti("Öneri geçmişi çekilemedi.", "eclub_oneri_kayitlari SELECT — oneren_id filtresi", error);

    // Alıcı kişilerin eczane adlarını topluca çöz
    const kisiIdler = [...new Set((oneriler ?? []).map((o: any) => o.kisi_id).filter(Boolean))];
    const eczaneAdiMap = await kisiEczaneAdiMap(adminSupabase, kisiIdler);

    // Yayın adlarını toplu çek (v_yayin_detay)
    const yayinIds = [...new Set((oneriler ?? []).map((o: any) => o.yayin_id))];
    const yayinAdiMap = new Map<string, { urun_adi: string | null; teknik_adi: string | null; hedef_rol: string | null }>();
    if (yayinIds.length > 0) {
      const { data: yayinlar } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, urun_adi, teknik_adi, hedef_rol")
        .in("yayin_id", yayinIds);
      for (const y of yayinlar ?? []) {
        yayinAdiMap.set((y as any).yayin_id, {
          urun_adi: (y as any).urun_adi,
          teknik_adi: (y as any).teknik_adi,
          hedef_rol: (y as any).hedef_rol,
        });
      }
    }

    const sonuc = (oneriler ?? []).map((o: any) => {
      const kisi = o.eclub_kisiler ?? {};
      const yayin = yayinAdiMap.get(o.yayin_id) ?? { urun_adi: null, teknik_adi: null, hedef_rol: null };
      return {
        oneri_id: o.oneri_id,
        yayin_id: o.yayin_id,
        urun_adi: yayin.urun_adi ?? "-",
        teknik_adi: yayin.teknik_adi ?? "-",
        hedef_rol: yayin.hedef_rol,
        kisi_id: o.kisi_id,
        kisi_ad: kisi.ad ?? "-",
        kisi_soyad: kisi.soyad ?? "-",
        kisi_rol: kisi.rol ?? null,
        eczane_adi: eczaneAdiMap.get(o.kisi_id) ?? "-",
        oneri_baslangic: o.oneri_baslangic,
        oneri_bitis: o.oneri_bitis,
        izlendi_mi: o.izlendi_mi,
        created_at: o.created_at,
      };
    });

    return NextResponse.json({ oneriler: sonuc }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/oneriler/api");
  }
}

// ─── POST: tek video → çok kişi, atla-raporla ────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_UTT_ROLLERI.includes(rol)) return rolHatasi("Sadece UTT/KD_UTT öneri gönderebilir.");

    const body = await request.json();
    const { yayin_id, kisi_idler } = body;

    if (!yayin_id || typeof yayin_id !== "string") return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    if (!kisi_idler || !Array.isArray(kisi_idler) || kisi_idler.length === 0)
      return validasyonHatasi("En az bir kişi seçilmelidir.", ["kisi_idler"]);

    const benzersizKisiler: string[] = [...new Set(kisi_idler.filter((k: any) => typeof k === "string"))];
    if (benzersizKisiler.length === 0) return validasyonHatasi("Geçerli kişi seçilmedi.", ["kisi_idler"]);

    // 3. Yayın geçerli mi (yayında + eclub hedef_rol)
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, durum, hedef_rol, urun_adi")
      .eq("yayin_id", yayin_id)
      .maybeSingle();

    if (yayinError) return hataYaniti("Yayın sorgulanamadı.", "v_yayin_detay SELECT — yayin_id", yayinError);
    if (!yayin) return hataYaniti("Yayın bulunamadı.", "v_yayin_detay — yayin_id yok", null, 404);
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Bu yayın şu an yayında değil. Durum: ${yayin.durum}`);
    if (!ECLUB_HEDEF_ROLLER.includes(yayin.hedef_rol)) return isKuraluHatasi("Bu yayın E-Club için uygun değil (hedef rol eczacı/teknisyen değil).");

    // 4+5. Kişileri çek: rol (eclub_kisiler) + aktiflik & sahiplik.
    // Aktiflik eclub_kisi_eczane.aktif_mi'de; sahiplik (baglayan_utt_id) o eczanenin
    // eclub_eczane_firma kaydındadır. Zincir embed'le tek sorguda güvenilir kurulamaz;
    // ayrı sorgu + Map deseniyle çözülür.

    // 4a. Kişilerin rol bilgisi
    const { data: kisilerRol, error: kisiRolError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .in("kisi_id", benzersizKisiler);

    if (kisiRolError) return hataYaniti("Kişiler sorgulanamadı.", "eclub_kisiler SELECT — kisi_idler", kisiRolError);

    const rolMap = new Map<string, string>();
    for (const k of kisilerRol ?? []) rolMap.set((k as any).kisi_id, (k as any).rol);

    // 4b. Aktif kişi-eczane bağları (kisi_id → eczane_id)
    const { data: baglar, error: bagError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .select("kisi_id, eczane_id")
      .in("kisi_id", benzersizKisiler)
      .eq("aktif_mi", true);

    if (bagError) return hataYaniti("Kişi-eczane bağları sorgulanamadı.", "eclub_kisi_eczane SELECT — kisi_idler", bagError);

    const kisiEczaneMap = new Map<string, string>(); // kisi_id → eczane_id
    for (const b of baglar ?? []) kisiEczaneMap.set((b as any).kisi_id, (b as any).eczane_id);

    // 4c. Bu eczanelerin sahibi UTT'ler (eczane_id → baglayan_utt_id)
    const eczaneIdler = [...new Set((baglar ?? []).map((b: any) => b.eczane_id))];
    const eczaneUttMap = new Map<string, string>(); // eczane_id → baglayan_utt_id
    if (eczaneIdler.length > 0) {
      const { data: firmaBaglari, error: firmaBagError } = await adminSupabase
        .from("eclub_eczane_firma")
        .select("eczane_id, baglayan_utt_id")
        .in("eczane_id", eczaneIdler)
        .eq("aktif_mi", true);

      if (firmaBagError) return hataYaniti("Eczane sahiplik bilgisi sorgulanamadı.", "eclub_eczane_firma SELECT — eczane_idler", firmaBagError);

      for (const fb of firmaBaglari ?? []) {
        // Bir eczane birden çok firmaya/UTT'ye bağlı olabilir; bu UTT'nin bağladığı
        // kayıt varsa sahiplik doğrulanır. Map'e bu UTT eşleşmesini yaz (varsa öncelik).
        const ez = (fb as any).eczane_id;
        const bu = (fb as any).baglayan_utt_id;
        if (bu === user.id) eczaneUttMap.set(ez, bu);
        else if (!eczaneUttMap.has(ez)) eczaneUttMap.set(ez, bu);
      }
    }

    // kisiMap: kişi başına { rol, aktif_mi, utt }
    // aktif_mi = kişinin aktif bir eczane bağı var mı; utt = o eczanenin sahibi UTT
    const atlanan: { kisi_id: string; sebep: string }[] = [];
    const kisiMap = new Map<string, { rol: string; aktif_mi: boolean; utt: string | null }>();
    for (const kid of benzersizKisiler) {
      const rolK = rolMap.get(kid);
      if (rolK === undefined) continue; // kişi hiç yok → aşağıda "bulunamadi"
      const eczaneId = kisiEczaneMap.get(kid); // aktif bağ varsa eczane_id
      const utt = eczaneId ? (eczaneUttMap.get(eczaneId) ?? null) : null;
      kisiMap.set(kid, {
        rol: rolK,
        aktif_mi: eczaneId !== undefined, // aktif kişi-eczane bağı var mı
        utt,
      });
    }

    // Aday listesi: her kişi için sahiplik + aktiflik + rol uyumu
    let adaylar: string[] = [];
    for (const kid of benzersizKisiler) {
      const k = kisiMap.get(kid);
      if (!k) { atlanan.push({ kisi_id: kid, sebep: "bulunamadi" }); continue; }
      if (k.utt !== user.id) { atlanan.push({ kisi_id: kid, sebep: "sahiplik_yok" }); continue; }
      if (!k.aktif_mi) { atlanan.push({ kisi_id: kid, sebep: "pasif" }); continue; }
      if (k.rol !== yayin.hedef_rol) { atlanan.push({ kisi_id: kid, sebep: "rol_uyumsuz" }); continue; }
      adaylar.push(kid);
    }

    // 6. Tekrar kontrolü (aynı UTT → kişi, son 7 gün)
    if (adaylar.length > 0) {
      const { cakisan_kisiler } = await tekrarKontrol(adminSupabase, user.id, adaylar);
      const cakisanSet = new Set(cakisan_kisiler);
      const kalan: string[] = [];
      for (const kid of adaylar) {
        if (cakisanSet.has(kid)) atlanan.push({ kisi_id: kid, sebep: "tekrar" });
        else kalan.push(kid);
      }
      adaylar = kalan;
    }

    // 7. Alıcı haftalık limiti (global, son 7 gün, 20)
    if (adaylar.length > 0) {
      const { dolu_kisiler } = await aliciLimitKontrol(adminSupabase, adaylar);
      const doluSet = new Set(dolu_kisiler.map((d) => d.kisi_id));
      const kalan: string[] = [];
      for (const kid of adaylar) {
        if (doluSet.has(kid)) atlanan.push({ kisi_id: kid, sebep: "alici_limiti" });
        else kalan.push(kid);
      }
      adaylar = kalan;
    }

    // 8. Aylık kredi (kısmi): kalan krediye göre kes
    if (adaylar.length > 0) {
      const kredi = await aylikKrediKontrol(adminSupabase, user.id, adaylar.length);
      if (kredi.kalan <= 0) {
        for (const kid of adaylar) atlanan.push({ kisi_id: kid, sebep: "kredi_yok" });
        adaylar = [];
      } else if (adaylar.length > kredi.kalan) {
        const gidecek = adaylar.slice(0, kredi.kalan);
        const kesilenler = adaylar.slice(kredi.kalan);
        for (const kid of kesilenler) atlanan.push({ kisi_id: kid, sebep: "kredi_yok" });
        adaylar = gidecek;
      }
    }

    // 9. INSERT (baslangic=now, bitis=now+7g)
    const gonderilen: string[] = [];
    const now = new Date();
    const bitis = oneriBitisHesapla(now);
    for (const kid of adaylar) {
      const { data: yeniOneri, error: insertError } = await adminSupabase
        .from("eclub_oneri_kayitlari")
        .insert({
          yayin_id,
          oneren_id: user.id,
          kisi_id: kid,
          oneri_baslangic: now.toISOString(),
          oneri_bitis: bitis.toISOString(),
          izlendi_mi: false,
        })
        .select("oneri_id")
        .single();
      if (insertError || !yeniOneri) {
        atlanan.push({ kisi_id: kid, sebep: "kayit_hatasi" });
        continue;
      }
      gonderilen.push(kid);

      // İŞ 2.7: kişiye uygulama-içi bildirim (eclub_bildirimler). Öneri kaydı
      // başarılıysa gönderilir; bildirim hatası öneriyi geçersiz kılmaz (helper içinde loglanır).
      await eclubBildirimOlustur({
        adminSupabase,
        alici_kisi_id: kid,
        gonderen_id: user.id,
        kayit_turu: "oneri",
        kayit_id: yeniOneri.oneri_id,
        mesaj: `Size yeni bir video önerildi: ${yayin.urun_adi}`,
      });
    }

    return NextResponse.json({
      mesaj: `${gonderilen.length} öneri gönderildi.`,
      gonderilen_sayisi: gonderilen.length,
      gonderilen,
      atlanan,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/oneriler/api");
  }
}