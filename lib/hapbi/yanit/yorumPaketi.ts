import type {
  HapbiAnalitikDonem,
  HapbiAnalitikKapsam,
  HapbiAnalitikOlcut,
  HapbiAnalitikVarlik,
} from "@/lib/hapbi/analitik/sozlesme";
import { HapbiHata } from "@/lib/hapbi/sozlesme";
import type { HapbiDogrudanYanit } from "@/lib/hapbi/yanit/dogrudan";
import { hapbiDonemEtiketiniOlustur } from "@/lib/hapbi/yanit/kanit";

export interface HapbiYorumPaketiKaniti {
  id: string;
  ozne: HapbiAnalitikVarlik | null;
  urun: HapbiAnalitikVarlik | null;
  olcut: HapbiAnalitikOlcut;
  deger: number;
  kaynak: {
    id: string;
    baslik: string;
    url: string;
  };
}

export interface HapbiYorumPaketi {
  soru: string;
  kapsam: string;
  donem: string;
  bulgular: string[];
  kanitlar: HapbiYorumPaketiKaniti[];
  yorumSinirlari: string[];
}

export interface HapbiYorumPaketiGirdisi {
  soru: string;
  kapsam: HapbiAnalitikKapsam;
  donem: HapbiAnalitikDonem;
  dogrudanYanit: HapbiDogrudanYanit;
}

const YORUM_SINIRLARI = [
  "Kanıtlarda bulunmayan yeni sayı üretme.",
  "Kanıt olmadan neden-sonuç ilişkisi kurma.",
  "Puanı satış başarısı veya mesleki yeterlilik olarak yorumlama.",
  "Doğrulanmış erişim kapsamının dışındaki kişi, takım veya firma hakkında yorum yapma.",
] as const;

function kapsamEtiketi(kapsam: HapbiAnalitikKapsam): string {
  if (kapsam.tur === "kisisel") return "kişisel kapsam";
  if (kapsam.tur === "bm_sorumluluk") return "BM sorumluluk kapsamı";
  if (kapsam.tur === "takim") return "takım kapsamı";
  if (kapsam.tur === "firma") return "firma kapsamı";
  if (kapsam.tur === "eclub_kisisel") return "kişisel E-Club kapsamı";
  return "yetkili E-Club organizasyon kapsamı";
}

export function hapbiYorumPaketiniOlustur(
  girdi: HapbiYorumPaketiGirdisi,
): HapbiYorumPaketi {
  const kanitHaritasi = new Map(
    girdi.dogrudanYanit.kanitlar.map((kanit) => [kanit.id, kanit]),
  );
  const seciliKanitlar = [...new Set(girdi.dogrudanYanit.kanitIdleri)]
    .map((id) => kanitHaritasi.get(id));

  if (seciliKanitlar.length === 0 || seciliKanitlar.some((kanit) => !kanit)) {
    throw new HapbiHata(
      "YORUM_PAKETI_KANIT",
      502,
      "Yorum paketi için doğrulanmış kanıt seçilemedi.",
    );
  }

  const dogrulanmisKanitlar = seciliKanitlar.filter(
    (kanit): kanit is NonNullable<typeof kanit> => kanit !== undefined,
  );

  return {
    soru: girdi.soru.trim(),
    kapsam: kapsamEtiketi(girdi.kapsam),
    donem: hapbiDonemEtiketiniOlustur(girdi.donem),
    bulgular: [girdi.dogrudanYanit.cevap],
    kanitlar: dogrulanmisKanitlar.map((kanit) => ({
      id: kanit.id,
      ozne: kanit.ozne,
      urun: kanit.urun,
      olcut: kanit.olcut,
      deger: kanit.deger,
      kaynak: {
        id: kanit.kaynak.id,
        baslik: kanit.kaynak.baslik,
        url: kanit.kaynak.url,
      },
    })),
    yorumSinirlari: [...YORUM_SINIRLARI],
  };
}

export function hapbiYorumPaketiniJsonaCevir(paket: HapbiYorumPaketi): string {
  return JSON.stringify(paket);
}
