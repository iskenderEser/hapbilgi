import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { ANALIZ_URETICI_ROLLERI, ANALIZ_YONETICI_ROLLERI } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { analizRpcAyarlari, type AnalizFiltreleri, type AnalizRolKolu } from "@/lib/analiz/paylasilan/sorguYanit";
import {
  KAYIP_KAYNAKLARI,
  KAZANIM_KAYNAKLARI,
  sonrakiHiyerarsiSeviyesi,
  type HiyerarsiSeviyesi,
  type PuanDagilimIstegi,
  type PuanDagilimYaniti,
  type PuanDetayKarti,
  type PuanHiyerarsiSatiri,
} from "@/lib/analiz/paylasilan/puanDagilimi";

type KullaniciKapsami = {
  firma_id: string;
  takim_id: string | null;
  bolge_id: string | null;
};

type HamSatir = Omit<PuanHiyerarsiSatiri, "kart_toplami" | "kapsam_payi">;

function rolKolunuCoz(rol: string): AnalizRolKolu | null {
  if (ANALIZ_YONETICI_ROLLERI.includes(rol)) return "yonetici";
  if (ANALIZ_URETICI_ROLLERI.includes(rol)) return "uretici";
  if (rol === "tm" || rol === "bm") return rol;
  return null;
}

function baslangicSeviyesi(rolKolu: AnalizRolKolu, kapsam: KullaniciKapsami): HiyerarsiSeviyesi {
  if (rolKolu === "bm") return "utt";
  if (rolKolu === "tm") return "bolge";
  if (rolKolu === "uretici" && kapsam.takim_id) return "bolge";
  return "takim";
}

function seviyeIzinliMi(
  baslangic: HiyerarsiSeviyesi,
  istenen: HiyerarsiSeviyesi,
  filtreler: AnalizFiltreleri,
): boolean {
  const sira: HiyerarsiSeviyesi[] = ["takim", "bolge", "utt"];
  if (sira.indexOf(istenen) < sira.indexOf(baslangic)) return false;
  if (istenen === "bolge" && baslangic === "takim" && !filtreler.takim_id && !filtreler.bolge_id) return false;
  if (istenen === "utt" && baslangic !== "utt" && !filtreler.bolge_id && !filtreler.utt_id) return false;
  return true;
}

function tarihGecerliMi(value: string | null | undefined): boolean {
  return value == null || Number.isFinite(Date.parse(value));
}

function sayi(value: unknown): number {
  const sonuc = Number(value ?? 0);
  return Number.isFinite(sonuc) ? sonuc : 0;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    const rolKolu = rolKolunuCoz(rol);
    if (!rolKolu) return rolHatasi("Puan dağılımı analizine erişim yetkiniz yok.");

    const body = (await request.json()) as Partial<PuanDagilimIstegi>;
    const kart = body.kart;
    const seviye = body.seviye;
    const filtreler = body.filtreler ?? {};
    if (kart !== "kazanim" && kart !== "kayip") {
      return validasyonHatasi("kart 'kazanim' veya 'kayip' olmalıdır.", ["kart"]);
    }
    if (seviye !== "takim" && seviye !== "bolge" && seviye !== "utt") {
      return validasyonHatasi("seviye 'takim', 'bolge' veya 'utt' olmalıdır.", ["seviye"]);
    }
    if (!tarihGecerliMi(filtreler.baslangic) || !tarihGecerliMi(filtreler.bitis)) {
      return validasyonHatasi("Tarih aralığı geçersiz.", ["filtreler"]);
    }
    if (filtreler.baslangic && filtreler.bitis && Date.parse(filtreler.baslangic) > Date.parse(filtreler.bitis)) {
      return validasyonHatasi("Başlangıç tarihi bitiş tarihinden sonra olamaz.", ["filtreler"]);
    }

    const { data: kullanici, error: kullaniciHatasi } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id, takim_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();
    if (kullaniciHatasi || !kullanici?.firma_id) {
      return hataYaniti("Kullanıcının analiz kapsamı bulunamadı.", "kullanicilar kapsamı", kullaniciHatasi);
    }
    const kapsam = kullanici as KullaniciKapsami;
    const baslangic = baslangicSeviyesi(rolKolu, kapsam);
    if (!seviyeIzinliMi(baslangic, seviye, filtreler)) {
      return rolHatasi("İstenen hiyerarşi seviyesi mevcut kapsam veya kırılım yolu için uygun değil.");
    }

    const scopeTakimId = rolKolu === "tm" || rolKolu === "bm" || (rolKolu === "uretici" && kapsam.takim_id)
      ? kapsam.takim_id
      : null;
    const scopeBolgeId = rolKolu === "bm" ? kapsam.bolge_id : null;
    const dagilimParametreleri = {
      p_firma_id: kapsam.firma_id,
      p_seviye: seviye,
      p_scope_takim_id: scopeTakimId,
      p_scope_bolge_id: scopeBolgeId,
      p_baslangic: filtreler.baslangic ?? null,
      p_bitis: filtreler.bitis ?? null,
      p_urun_id: filtreler.urun_id ?? null,
      p_egitim_turu: filtreler.egitim_turu ?? null,
      p_takim_id: filtreler.takim_id ?? null,
      p_bolge_id: filtreler.bolge_id ?? null,
      p_utt_id: filtreler.utt_id ?? null,
    };
    const ozetRpc = analizRpcAyarlari(rolKolu, "tuketim", user.id, filtreler);
    const [dagilimYanit, ozetYanit] = await Promise.all([
      adminSupabase.rpc("get_analiz_puan_dagilimi_kanonik", dagilimParametreleri),
      adminSupabase.rpc(ozetRpc.ad, ozetRpc.parametreler),
    ]);
    if (dagilimYanit.error) return hataYaniti("Puan dağılımı alınamadı.", "get_analiz_puan_dagilimi_kanonik", dagilimYanit.error);
    if (ozetYanit.error) return hataYaniti("Puan kartı mutabakatı alınamadı.", ozetRpc.ad, ozetYanit.error);

    const toplamAlani = kart === "kazanim" ? "kazanilan_toplam" : "kaybedilen_toplam";
    const hiyerarsi: PuanHiyerarsiSatiri[] = ((dagilimYanit.data ?? []) as Record<string, unknown>[]).map((ham) => {
      const satir = {
        ...ham,
        toplam_utt: sayi(ham.toplam_utt),
        aktif_utt: sayi(ham.aktif_utt),
        izleme_puani: sayi(ham.izleme_puani),
        cevaplama_puani: sayi(ham.cevaplama_puani),
        oneri_puani: sayi(ham.oneri_puani),
        extra_puani: sayi(ham.extra_puani),
        ileri_sarma_kaybi: sayi(ham.ileri_sarma_kaybi),
        yanlis_cevap_kaybi: sayi(ham.yanlis_cevap_kaybi),
        oneri_kaybi: sayi(ham.oneri_kaybi),
        challenge_kaybi: sayi(ham.challenge_kaybi),
        kazanilan_toplam: sayi(ham.kazanilan_toplam),
        kaybedilen_toplam: sayi(ham.kaybedilen_toplam),
      } as HamSatir;
      return { ...satir, kart_toplami: sayi(satir[toplamAlani]), kapsam_payi: 0 } as PuanHiyerarsiSatiri;
    });
    hiyerarsi.sort((a, b) => b.kart_toplami - a.kart_toplami || a.birim_adi.localeCompare(b.birim_adi, "tr"));
    const satirToplami = hiyerarsi.reduce((toplam, satir) => toplam + satir.kart_toplami, 0);
    for (const satir of hiyerarsi) {
      satir.kapsam_payi = satirToplami > 0 ? Number(((satir.kart_toplami / satirToplami) * 100).toFixed(1)) : 0;
    }

    const kaynaklar = kart === "kazanim" ? KAZANIM_KAYNAKLARI : KAYIP_KAYNAKLARI;
    const kaynakDagilimi = kaynaklar.map((kaynak) => {
      const deger = hiyerarsi.reduce((toplam, satir) => toplam + sayi(satir[kaynak.id]), 0);
      return { id: kaynak.id, ad: kaynak.ad, deger, yuzde: satirToplami > 0 ? Number(((deger / satirToplami) * 100).toFixed(1)) : 0 };
    });
    const ozetSatiri = (Array.isArray(ozetYanit.data) ? ozetYanit.data[0] : ozetYanit.data) as Record<string, unknown> | null;
    const kartAlani = kart === "kazanim" ? "kazanilan_toplam_puan" : "kaybedilen_toplam_puan";
    const kartToplami = sayi(ozetSatiri?.[kartAlani]);

    const sonuc: PuanDagilimYaniti = {
      kart,
      seviye,
      baslangic_seviyesi: baslangic,
      sonraki_seviye: sonrakiHiyerarsiSeviyesi(seviye),
      rol_kolu: rolKolu,
      kart_toplami: kartToplami,
      kaynak_dagilimi: kaynakDagilimi,
      hiyerarsi,
      mutabakat: { kart: kartToplami, satirlar: satirToplami, uyumlu: kartToplami === satirToplami },
    };
    return NextResponse.json(sonuc, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "POST /analiz/api/puan-dagilimi");
  }
}
