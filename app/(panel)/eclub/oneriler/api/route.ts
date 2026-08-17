// app/eclub/oneriler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import {
  ayniVideoTekrarAcikZamani,
  eclubAyniVideoTekrarBeklemeGun,
  oneriBitisHesapla,
  eclubOneriGecerlilikGun,
} from "@/lib/eclub/oneriLimit";
import { eclubBildirimOlustur } from "@/lib/utils/eclubBildirim";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_HEDEF_ROLLER, TUKETICI_ROLLER, eclubKisiHedefRolu, hedefRolleriOku, type HedefRoller } from "@/lib/utils/roller";
import { eclubYayinKapsamindaMi } from "@/lib/eclub/oneriKapsam";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface KisiEczaneBagSatiri { kisi_id: string; eczane_id: string; }
interface EczaneGlnSatiri { eczane_id: string; gln: string; }
interface EczaneMasterSatiri { gln: string; eczane_adi: string; }
interface OneriKisiKimlik { ad: string | null; soyad: string | null; rol: string | null; }
interface OneriKayitSatiri {
  oneri_id: string;
  yayin_id: string;
  video_id: string;
  kisi_id: string;
  oneri_baslangic: string;
  oneri_bitis: string;
  izlendi_mi: boolean | null;
  created_at: string | null;
  eclub_kisiler?: OneriKisiKimlik | OneriKisiKimlik[] | null;
}
interface YayinAdiSatiri {
  yayin_id: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  talep_no: number | null;
  firma_adi: string | null;
  hedef_roller: unknown;
}
interface EclubKisiSatiri { kisi_id: string; rol: string; auth_user_id: string | null; }
interface EczaneSahiplikSatiri { eczane_id: string; }
interface AtomikOneriSatiri {
  oneri_id: string | null;
  kaydedildi: boolean;
  sebep: string | null;
  yeniden_gonderilebilir_at: string | null;
}

function tekilIliski<T>(deger: T | T[] | null | undefined): T | null {
  if (!deger) return null;
  return Array.isArray(deger) ? (deger[0] ?? null) : deger;
}

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
  const { data: baglar, error: bagError } = await adminSupabase
    .from("eclub_kisi_eczane")
    .select("kisi_id, eczane_id")
    .in("kisi_id", kisiIdler)
    .eq("aktif_mi", true);

  if (bagError) throw new Error(`eclub_kisi_eczane SELECT — eczane adı: ${bagError.message}`);
  const bagSatirlari = (baglar ?? []) as KisiEczaneBagSatiri[];
  if (bagSatirlari.length === 0) return map;

  const eczaneIdler = [...new Set(bagSatirlari.map((b) => b.eczane_id))];

  // 2. Eczane → gln
  const { data: eczaneler, error: eczaneError } = await adminSupabase
    .from("eclub_eczaneler")
    .select("eczane_id, gln")
    .in("eczane_id", eczaneIdler);

  if (eczaneError) throw new Error(`eclub_eczaneler SELECT — eczane adı: ${eczaneError.message}`);
  const eczaneSatirlari = (eczaneler ?? []) as EczaneGlnSatiri[];
  const eczaneGlnMap = new Map<string, string>();
  for (const e of eczaneSatirlari) eczaneGlnMap.set(e.eczane_id, e.gln);

  const glnler = [...new Set(eczaneSatirlari.map((e) => e.gln))];

  // 3. gln → eczane_adi (master)
  const { data: masterlar, error: masterError } = await adminSupabase
    .from("eclub_eczane_master")
    .select("gln, eczane_adi")
    .in("gln", glnler);

  if (masterError) throw new Error(`eclub_eczane_master SELECT — eczane adı: ${masterError.message}`);
  const glnAdiMap = new Map<string, string>();
  for (const m of (masterlar ?? []) as EczaneMasterSatiri[]) glnAdiMap.set(m.gln, m.eczane_adi);

  // 4. kisi_id → eczane_adi birleştir
  for (const b of bagSatirlari) {
    const gln = eczaneGlnMap.get(b.eczane_id);
    const adi = gln ? glnAdiMap.get(gln) : null;
    if (adi) map.set(b.kisi_id, adi);
  }

  return map;
}

// ─── GET: UTT'nin öneri geçmişi ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Bu sayfaya yalnız UTT/KD_UTT erişebilir.");

    if (request.nextUrl.searchParams.get("yalniz_limit") === "1") {
      const [gecerlilikGun, tekrarBeklemeGun] = await Promise.all([
        eclubOneriGecerlilikGun(adminSupabase),
        eclubAyniVideoTekrarBeklemeGun(adminSupabase),
      ]);
      return NextResponse.json({
        limitler: { gecerlilik_gun: gecerlilikGun, ayni_video_tekrar_bekleme_gun: tekrarBeklemeGun },
      }, { status: 200 });
    }

    // UTT'nin gönderdiği öneriler + alıcı (eclub_kisiler) temel bilgisi.
    // Eczane adı ayrı sorgu+Map ile çözülür (eczane bağı eclub_kisiler'de değil,
    // eclub_kisi_eczane → eclub_eczaneler → eclub_eczane_master zincirindedir).
    const { data: oneriler, error } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select(`
        oneri_id, yayin_id, video_id, kisi_id, oneri_baslangic, oneri_bitis, izlendi_mi, created_at,
        eclub_kisiler ( ad, soyad, rol )
      `)
      .eq("oneren_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return hataYaniti("Öneri geçmişi çekilemedi.", "eclub_oneri_kayitlari SELECT — oneren_id filtresi", error);

    // Alıcı kişilerin eczane adlarını topluca çöz
    const oneriSatirlari = (oneriler ?? []) as OneriKayitSatiri[];
    const kisiIdler = [...new Set(oneriSatirlari.map((o) => o.kisi_id).filter(Boolean))];
    const eczaneAdiMap = await kisiEczaneAdiMap(adminSupabase, kisiIdler);

    // Yayın adlarını toplu çek (v_yayin_detay)
    const yayinIds = [...new Set(oneriSatirlari.map((o) => o.yayin_id))];
    const yayinAdiMap = new Map<string, { urun_adi: string | null; teknik_adi: string | null; talep_no: number | null; firma_adi: string | null; hedef_roller: HedefRoller }>();
    if (yayinIds.length > 0) {
      const { data: yayinlar, error: yayinlarError } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, urun_adi, teknik_adi, talep_no, firma_adi, hedef_roller")
        .in("yayin_id", yayinIds);
      if (yayinlarError)
        return hataYaniti("Öneri yayın bilgileri çekilemedi.", "v_yayin_detay SELECT — öneri geçmişi", yayinlarError);
      for (const y of (yayinlar ?? []) as YayinAdiSatiri[]) {
        yayinAdiMap.set(y.yayin_id, {
          urun_adi: y.urun_adi,
          teknik_adi: y.teknik_adi,
          talep_no: y.talep_no,
          firma_adi: y.firma_adi,
          hedef_roller: hedefRolleriOku(y),
        });
      }
    }

    const sonuc = oneriSatirlari.map((o) => {
      const kisi = tekilIliski(o.eclub_kisiler);
      const yayin = yayinAdiMap.get(o.yayin_id) ?? { urun_adi: null, teknik_adi: null, talep_no: null, firma_adi: null, hedef_roller: [] };
      return {
        oneri_id: o.oneri_id,
        yayin_id: o.yayin_id,
        video_id: o.video_id,
        urun_adi: yayin.urun_adi ?? "-",
        teknik_adi: yayin.teknik_adi ?? "-",
        talep_no: yayin.talep_no,
        firma_adi: yayin.firma_adi,
        hedef_roller: yayin.hedef_roller,
        kisi_id: o.kisi_id,
        kisi_ad: kisi?.ad ?? "-",
        kisi_soyad: kisi?.soyad ?? "-",
        kisi_rol: kisi?.rol ?? null,
        eczane_adi: eczaneAdiMap.get(o.kisi_id) ?? "-",
        oneri_baslangic: o.oneri_baslangic,
        oneri_bitis: o.oneri_bitis,
        izlendi_mi: o.izlendi_mi ?? false,
        created_at: o.created_at ?? o.oneri_baslangic,
      };
    });

    const [gecerlilikGun, tekrarBeklemeGun] = await Promise.all([
      eclubOneriGecerlilikGun(adminSupabase),
      eclubAyniVideoTekrarBeklemeGun(adminSupabase),
    ]);
    const simdi = Date.now();
    const tekrarEngeliMap = new Map<string, { video_id: string; kisi_id: string; yeniden_gonderilebilir_at: string }>();
    for (const oneri of sonuc) {
      const yenidenGonderilebilirAt = ayniVideoTekrarAcikZamani(new Date(oneri.oneri_bitis), tekrarBeklemeGun).toISOString();
      if (new Date(yenidenGonderilebilirAt).getTime() <= simdi) continue;
      const anahtar = `${oneri.video_id}:${oneri.kisi_id}`;
      const mevcut = tekrarEngeliMap.get(anahtar);
      if (!mevcut || mevcut.yeniden_gonderilebilir_at < yenidenGonderilebilirAt) {
        tekrarEngeliMap.set(anahtar, {
          video_id: oneri.video_id,
          kisi_id: oneri.kisi_id,
          yeniden_gonderilebilir_at: yenidenGonderilebilirAt,
        });
      }
    }

    return NextResponse.json({
      oneriler: sonuc,
      tekrar_engelleri: [...tekrarEngeliMap.values()],
      limitler: { gecerlilik_gun: gecerlilikGun, ayni_video_tekrar_bekleme_gun: tekrarBeklemeGun },
    }, { status: 200 });

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
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Sadece UTT/KD_UTT öneri gönderebilir.");

    const body = await request.json();
    const { yayin_id, kisi_idler } = body;

    if (!yayin_id || typeof yayin_id !== "string") return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    if (!kisi_idler || !Array.isArray(kisi_idler) || kisi_idler.length === 0)
      return validasyonHatasi("En az bir kişi seçilmelidir.", ["kisi_idler"]);
    if (kisi_idler.length > 100)
      return validasyonHatasi("Tek işlemde en fazla 100 kişi seçilebilir.", ["kisi_idler"]);
    if (kisi_idler.some((k: unknown) => typeof k !== "string" || !UUID_RE.test(k)))
      return validasyonHatasi("Geçersiz kişi kimliği gönderildi.", ["kisi_idler"]);
    if (!UUID_RE.test(yayin_id)) return validasyonHatasi("Geçersiz yayın kimliği gönderildi.", ["yayin_id"]);

    const benzersizKisiler: string[] = [...new Set(kisi_idler as string[])];

    const { data: utt, error: uttError } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id, takim_id")
      .eq("kullanici_id", user.id)
      .maybeSingle();

    if (uttError || !utt?.firma_id)
      return hataYaniti("UTT yayın kapsamı alınamadı.", "kullanicilar SELECT — E-Club öneri kapsamı", uttError, 404);

    // 3. Yayın geçerli mi (yayında + en az bir E-Club hedef rolü)
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, durum, hedef_roller, urun_adi, firma_id, takim_id, video_durum_id")
      .eq("yayin_id", yayin_id)
      .maybeSingle();

    if (yayinError) return hataYaniti("Yayın sorgulanamadı.", "v_yayin_detay SELECT — yayin_id", yayinError);
    if (!yayin) return hataYaniti("Yayın bulunamadı.", "v_yayin_detay — yayin_id yok", null, 404);
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Bu yayın şu an yayında değil. Durum: ${yayin.durum}`);
    const yayinHedefRolleri = hedefRolleriOku(yayin);
    if (!yayinHedefRolleri.some((hedefRol) => ECLUB_HEDEF_ROLLER.includes(hedefRol)))
      return isKuraluHatasi("Bu yayın E-Club için uygun değil (hedef rol eczacı/teknisyen değil).");
    if (!eclubYayinKapsamindaMi(utt, yayin))
      return isKuraluHatasi("Yayın, UTT'nin erişebildiği firma/takım kataloğu kapsamında değil.");

    if (!yayin.video_durum_id)
      return hataYaniti("Yayının video kimliği çözülemedi.", "v_yayin_detay — video_durum_id yok", null, 500);
    const { data: videoDurum, error: videoDurumError } = await adminSupabase
      .from("video_durumu")
      .select("video_id")
      .eq("video_durum_id", yayin.video_durum_id)
      .maybeSingle();
    if (videoDurumError || !videoDurum?.video_id)
      return hataYaniti("Yayının video kimliği çözülemedi.", "video_durumu SELECT — E-Club gönderim", videoDurumError, 500);

    // 4+5. Kişileri çek: rol (eclub_kisiler) + aktiflik & sahiplik.
    // Aktiflik eclub_kisi_eczane.aktif_mi'de; sahiplik (baglayan_utt_id) o eczanenin
    // eclub_eczane_firma kaydındadır. Zincir embed'le tek sorguda güvenilir kurulamaz;
    // ayrı sorgu + Map deseniyle çözülür.

    // 4a. Kişilerin rol bilgisi
    const { data: kisilerRol, error: kisiRolError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol, auth_user_id")
      .in("kisi_id", benzersizKisiler);

    if (kisiRolError) return hataYaniti("Kişiler sorgulanamadı.", "eclub_kisiler SELECT — kisi_idler", kisiRolError);

    const kimlikMap = new Map<string, { rol: string; auth_user_id: string | null }>();
    for (const k of (kisilerRol ?? []) as EclubKisiSatiri[]) {
      kimlikMap.set(k.kisi_id, {
        rol: k.rol,
        auth_user_id: k.auth_user_id ?? null,
      });
    }

    // 4b. Aktif kişi-eczane bağları (kisi_id → eczane_id)
    const { data: baglar, error: bagError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .select("kisi_id, eczane_id")
      .in("kisi_id", benzersizKisiler)
      .eq("aktif_mi", true);

    if (bagError) return hataYaniti("Kişi-eczane bağları sorgulanamadı.", "eclub_kisi_eczane SELECT — kisi_idler", bagError);

    const kisiEczaneMap = new Map<string, string>(); // kisi_id → eczane_id
    const aktifBaglar = (baglar ?? []) as KisiEczaneBagSatiri[];
    for (const b of aktifBaglar) kisiEczaneMap.set(b.kisi_id, b.eczane_id);

    // 4c. Bu eczanelerin sahibi UTT'ler (eczane_id → baglayan_utt_id)
    const eczaneIdler = [...new Set(aktifBaglar.map((b) => b.eczane_id))];
    const sahipOlunanEczaneler = new Set<string>();
    if (eczaneIdler.length > 0) {
      const { data: firmaBaglari, error: firmaBagError } = await adminSupabase
        .from("eclub_eczane_firma")
        .select("eczane_id")
        .in("eczane_id", eczaneIdler)
        .eq("baglayan_utt_id", user.id)
        .eq("aktif_mi", true);

      if (firmaBagError) return hataYaniti("Eczane sahiplik bilgisi sorgulanamadı.", "eclub_eczane_firma SELECT — eczane_idler", firmaBagError);

      for (const fb of (firmaBaglari ?? []) as EczaneSahiplikSatiri[]) sahipOlunanEczaneler.add(fb.eczane_id);
    }

    // kisiMap: kişi başına rol, giriş hesabı, aktif bağ ve bu UTT'nin sahipliği.
    const atlanan: { kisi_id: string; sebep: string; yeniden_gonderilebilir_at?: string }[] = [];
    const kisiMap = new Map<string, { rol: string; auth_var: boolean; aktif_mi: boolean; sahip_mi: boolean }>();
    for (const kid of benzersizKisiler) {
      const kimlik = kimlikMap.get(kid);
      if (!kimlik) continue; // kişi hiç yok → aşağıda "bulunamadi"
      const eczaneId = kisiEczaneMap.get(kid); // aktif bağ varsa eczane_id
      kisiMap.set(kid, {
        rol: kimlik.rol,
        auth_var: !!kimlik.auth_user_id,
        aktif_mi: eczaneId !== undefined, // aktif kişi-eczane bağı var mı
        sahip_mi: !!eczaneId && sahipOlunanEczaneler.has(eczaneId),
      });
    }

    // Aday listesi: her kişi için sahiplik + aktiflik + rol uyumu
    const adaylar: string[] = [];
    for (const kid of benzersizKisiler) {
      const k = kisiMap.get(kid);
      if (!k) { atlanan.push({ kisi_id: kid, sebep: "bulunamadi" }); continue; }
      if (!k.aktif_mi) { atlanan.push({ kisi_id: kid, sebep: "pasif" }); continue; }
      if (!k.sahip_mi) { atlanan.push({ kisi_id: kid, sebep: "sahiplik_yok" }); continue; }
      const hedefRol = eclubKisiHedefRolu(k.rol);
      if (!hedefRol || !yayinHedefRolleri.includes(hedefRol)) { atlanan.push({ kisi_id: kid, sebep: "rol_uyumsuz" }); continue; }
      if (!k.auth_var) { atlanan.push({ kisi_id: kid, sebep: "giris_hesabi_yok" }); continue; }
      adaylar.push(kid);
    }

    // Atomik kayıt: yalnız aynı UTT + aynı kişi + aynı gerçek video tekrarını engeller.
    const gonderilen: string[] = [];
    const now = new Date();
    const gecerlilikGun = await eclubOneriGecerlilikGun(adminSupabase);
    const bitis = oneriBitisHesapla(now, gecerlilikGun);
    for (const kid of adaylar) {
      const { data: rpcSonucu, error: insertError } = await adminSupabase
        .rpc("eclub_oneri_atomik_kaydet", {
          p_yayin_id: yayin_id,
          p_oneren_id: user.id,
          p_kisi_id: kid,
          p_video_id: videoDurum.video_id,
          p_oneri_baslangic: now.toISOString(),
          p_oneri_bitis: bitis.toISOString(),
        })
        .single();
      if (insertError || !rpcSonucu) {
        atlanan.push({ kisi_id: kid, sebep: "kayit_hatasi" });
        continue;
      }
      const atomikSonuc = rpcSonucu as AtomikOneriSatiri;
      if (!atomikSonuc.kaydedildi || !atomikSonuc.oneri_id) {
        atlanan.push({
          kisi_id: kid,
          sebep: atomikSonuc.sebep ?? "kayit_hatasi",
          ...(atomikSonuc.yeniden_gonderilebilir_at
            ? { yeniden_gonderilebilir_at: atomikSonuc.yeniden_gonderilebilir_at }
            : {}),
        });
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
        kayit_id: atomikSonuc.oneri_id,
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
