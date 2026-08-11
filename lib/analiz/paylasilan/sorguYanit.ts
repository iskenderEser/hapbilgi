import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  rolHatasi,
  sunucuHatasi,
  validasyonHatasi,
  yetkiHatasi,
} from "@/lib/utils/hataIsle";
import {
  ANALIZ_URETICI_ROLLERI,
  ANALIZ_YONETICI_ROLLERI,
} from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export type AnalizKategori = "uretim" | "tuketim";

export type AnalizFiltreleri = {
  baslangic?: string | null;
  bitis?: string | null;
  urun_id?: string | null;
  egitim_turu?: string | null;
  takim_id?: string | null;
  bolge_id?: string | null;
  utt_id?: string | null;
};

type Body = {
  kategori?: AnalizKategori;
  degisken_idleri?: string[];
  filtreler?: AnalizFiltreleri;
};

export type AnalizRolKolu = "yonetici" | "uretici" | "tm" | "bm";

const ROL_HATA_METINLERI: Record<AnalizRolKolu, string> = {
  yonetici: "Bu sayfa yalnızca yönetici roller içindir.",
  uretici: "Bu sayfa yalnızca üretici roller içindir.",
  tm: "Bu sayfa yalnızca TM rolü içindir.",
  bm: "Bu sayfa yalnızca BM rolü içindir.",
};

const TUKETIM_OZET_IDLERI = new Set([
  "kazanilan_toplam_puan",
  "kaybedilen_toplam_puan",
  "net_puan",
]);

function roleIzinVarMi(rolKolu: AnalizRolKolu, rol: string): boolean {
  if (rolKolu === "yonetici") return ANALIZ_YONETICI_ROLLERI.includes(rol);
  if (rolKolu === "uretici") return ANALIZ_URETICI_ROLLERI.includes(rol);
  return rol === rolKolu;
}

function kategoriIzinliMi(rolKolu: AnalizRolKolu, kategori: AnalizKategori): boolean {
  if (rolKolu === "tm" || rolKolu === "bm") return kategori === "tuketim";
  return true;
}

function tarihGecerliMi(value: string | null | undefined): boolean {
  return value == null || Number.isFinite(Date.parse(value));
}

async function secimiDogrula(
  adminSupabase: SupabaseClient,
  kategori: AnalizKategori,
  degiskenIdleri: string[],
): Promise<{ gecerli: true } | { gecerli: false; mesaj: string }> {
  const benzersiz = [...new Set(degiskenIdleri)];
  if (benzersiz.length !== degiskenIdleri.length) {
    return { gecerli: false, mesaj: "Aynı değişken birden fazla seçilemez." };
  }

  const degiskenTablosu = kategori === "uretim"
    ? "analiz_uretim_degiskenleri"
    : "analiz_tuketim_degiskenleri";
  const kombinasyonTablosu = kategori === "uretim"
    ? "analiz_uretim_kombinasyonlari"
    : "analiz_tuketim_kombinasyonlari";

  const { data: degiskenler, error: degiskenHatasi } = await adminSupabase
    .from(degiskenTablosu)
    .select("degisken_id")
    .in("degisken_id", benzersiz);

  if (degiskenHatasi) throw degiskenHatasi;
  if ((degiskenler ?? []).length !== benzersiz.length) {
    return { gecerli: false, mesaj: "Seçimde bu kategoriye ait olmayan değişken var." };
  }

  // Türev üçlü kullanıcı kombinasyonu değildir; dashboard'un kanonik özet çağrısıdır.
  if (kategori === "tuketim" && benzersiz.every((id) => TUKETIM_OZET_IDLERI.has(id))) {
    return { gecerli: true };
  }

  const sirali = [...benzersiz].sort();
  const { data: kombinasyon, error: kombinasyonHatasi } = await adminSupabase
    .from(kombinasyonTablosu)
    .select("id")
    .eq("boyut", sirali.length)
    .contains("degisken_idleri", sirali)
    .containedBy("degisken_idleri", sirali)
    .maybeSingle();

  if (kombinasyonHatasi) throw kombinasyonHatasi;
  if (!kombinasyon) {
    return { gecerli: false, mesaj: "Seçilen değişken kombinasyonu tanımlı değil." };
  }

  return { gecerli: true };
}

export function analizRpcAyarlari(
  rolKolu: AnalizRolKolu,
  kategori: AnalizKategori,
  kullaniciId: string,
  filtreler: AnalizFiltreleri,
): { ad: string; parametreler: Record<string, string | null> } {
  const ortak = {
    p_kullanici_id: kullaniciId,
    p_baslangic: filtreler.baslangic ?? null,
    p_bitis: filtreler.bitis ?? null,
    p_urun_id: filtreler.urun_id ?? null,
    p_egitim_turu: filtreler.egitim_turu ?? null,
  };

  if (rolKolu === "yonetici") {
    if (kategori === "uretim") {
      return {
        ad: "get_analiz_yonetici_uretim",
        parametreler: { ...ortak, p_takim_id: filtreler.takim_id ?? null },
      };
    }
    return {
      ad: "get_analiz_yonetici_tuketim",
      parametreler: {
        ...ortak,
        p_takim_id: filtreler.takim_id ?? null,
        p_bolge_id: filtreler.bolge_id ?? null,
        p_utt_id: filtreler.utt_id ?? null,
      },
    };
  }

  if (rolKolu === "uretici") {
    if (kategori === "uretim") {
      return { ad: "get_analiz_uretici_uretim", parametreler: ortak };
    }
    return {
      ad: "get_analiz_uretici_tuketim",
      parametreler: {
        ...ortak,
        p_takim_id: filtreler.takim_id ?? null,
        p_bolge_id: filtreler.bolge_id ?? null,
        p_utt_id: filtreler.utt_id ?? null,
      },
    };
  }

  if (rolKolu === "tm") {
    return {
      ad: "get_analiz_tm_tuketim",
      parametreler: {
        ...ortak,
        p_bolge_id: filtreler.bolge_id ?? null,
        p_utt_id: filtreler.utt_id ?? null,
      },
    };
  }

  return {
    ad: "get_analiz_bm_tuketim",
    parametreler: { ...ortak, p_utt_id: filtreler.utt_id ?? null },
  };
}

export async function analizSorguYanit(
  request: NextRequest,
  rolKolu: AnalizRolKolu,
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!roleIzinVarMi(rolKolu, rol)) return rolHatasi(ROL_HATA_METINLERI[rolKolu]);

    const body = (await request.json()) as Body;
    const { kategori, degisken_idleri: degiskenIdleri, filtreler = {} } = body;

    if (!kategori || !["uretim", "tuketim"].includes(kategori)) {
      return validasyonHatasi("kategori 'uretim' veya 'tuketim' olmalıdır.", ["kategori"]);
    }
    if (!kategoriIzinliMi(rolKolu, kategori)) {
      return validasyonHatasi("Bu rol için yalnız tüketim analizi kullanılabilir.", ["kategori"]);
    }
    if (!Array.isArray(degiskenIdleri) || degiskenIdleri.length === 0 || degiskenIdleri.length > 3) {
      return validasyonHatasi("Bir ile üç arasında değişken seçilmelidir.", ["degisken_idleri"]);
    }
    if (!tarihGecerliMi(filtreler.baslangic) || !tarihGecerliMi(filtreler.bitis)) {
      return validasyonHatasi("Tarih aralığı geçersiz.", ["filtreler"]);
    }
    if (
      filtreler.baslangic && filtreler.bitis
      && Date.parse(filtreler.baslangic) > Date.parse(filtreler.bitis)
    ) {
      return validasyonHatasi("Başlangıç tarihi bitiş tarihinden sonra olamaz.", ["filtreler"]);
    }

    const secim = await secimiDogrula(adminSupabase, kategori, degiskenIdleri);
    if (!secim.gecerli) return validasyonHatasi(secim.mesaj, ["degisken_idleri"]);

    const rpc = analizRpcAyarlari(rolKolu, kategori, user.id, filtreler);
    const { data, error } = await adminSupabase.rpc(rpc.ad, rpc.parametreler);
    if (error) {
      return hataYaniti("Analiz verisi çekilirken hata oluştu.", rpc.ad, error);
    }

    const satir = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!satir) return hataYaniti("Analiz fonksiyonu sonuç döndürmedi.", rpc.ad);

    const sonuclar: Record<string, number> = {};
    for (const id of degiskenIdleri) {
      const deger = satir[id];
      if (typeof deger !== "number" && typeof deger !== "string") {
        return hataYaniti("Analiz metriği sonuçta bulunamadı.", `${rpc.ad}.${id}`);
      }
      sonuclar[id] = Number(deger);
    }

    return NextResponse.json({ sonuclar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, `POST /analiz/api/${rolKolu}/sorgu`);
  }
}
