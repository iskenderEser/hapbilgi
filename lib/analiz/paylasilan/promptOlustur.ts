// lib/analiz/paylasilan/promptOlustur.ts
//
// AI yorum motoru için prompt fabrikası.
// Rol-aware: aynı pill kombinasyonu BM için "bölgemde olan", TM için "takımımda olan",
// yönetici için "firmada olan" anlamına gelir. Bağlam role göre değişir, semantik aynı.
//
// Yönetici dalıyla başlıyoruz. BM/TM/üretici dalları sonraki fazlarda eklenir.

import type { Kategori, Kombinasyon } from "@/lib/analiz/paylasilan/kombinasyonlar";

export type Rol = "yonetici" | "uretici" | "tm" | "bm";

export type PromptBaglami = {
  rol: Rol;
  rol_ad?: string; // "Yönetici", "BM Şaban Altın", vb. — frontend'den gelebilir
  scope_aciklama?: string; // örn. "Yıldız takımı / İzmir bölgesi"
  periyot_etiketi?: string; // "Aylık", "Bu Hafta", "Dönemlik" vb.
  urun_adi?: string | null;
  egitim_turu?: string | null;
  takim_adi?: string | null;
  bolge_adi?: string | null;
  utt_adi?: string | null;
};

export type PromptGirdisi = {
  kategori: Kategori;
  kombinasyon: Kombinasyon;
  degisken_adlari: Record<string, string>;
  sonuclar: Record<string, number>;
  baglam: PromptBaglami;
};

function rolGirisCumlesi(baglam: PromptBaglami): string {
  switch (baglam.rol) {
    case "yonetici":
      return `Sen HapBilgi platformunda bir yönetici (GM/Direktör/Pazarlama vb.) için firma genelinde analiz yorumlayan bir asistansın.`;
    case "uretici":
      return `Sen HapBilgi platformunda bir üretici rol (PM/Eğitmen/Medikal Müdür) için kendi yetki alanında analiz yorumlayan bir asistansın.`;
    case "tm":
      return `Sen HapBilgi platformunda bir Takım Müdürü (TM) için takımı kapsamında analiz yorumlayan bir asistansın.`;
    case "bm":
      return `Sen HapBilgi platformunda bir Bölge Müdürü (BM) için bölgesi kapsamında analiz yorumlayan bir asistansın.`;
  }
}

function filtreOzeti(baglam: PromptBaglami): string {
  const parcalar: string[] = [];
  if (baglam.periyot_etiketi) parcalar.push(`Periyot: ${baglam.periyot_etiketi}`);
  if (baglam.takim_adi) parcalar.push(`Takım: ${baglam.takim_adi}`);
  if (baglam.bolge_adi) parcalar.push(`Bölge: ${baglam.bolge_adi}`);
  if (baglam.urun_adi) parcalar.push(`Ürün: ${baglam.urun_adi}`);
  if (baglam.egitim_turu) parcalar.push(`Eğitim Türü: ${baglam.egitim_turu}`);
  if (baglam.utt_adi) parcalar.push(`UTT: ${baglam.utt_adi}`);
  return parcalar.length > 0 ? parcalar.join(", ") : "Filtre yok (tüm kapsam)";
}

function metriklerOzeti(
  degisken_idleri: string[],
  degisken_adlari: Record<string, string>,
  sonuclar: Record<string, number>
): string {
  return degisken_idleri
    .map((id) => `- ${degisken_adlari[id] ?? id}: ${sonuclar[id] ?? 0}`)
    .join("\n");
}

function kategoriEtiketi(kategori: Kategori): string {
  return kategori === "uretim" ? "Üretim Analizi" : "Tüketim Analizi";
}

function tamamlayiciNotu(kombinasyon: Kombinasyon): string {
  if (kombinasyon.tamamlayici_mi) {
    return `\n\nNot: Seçilen metrikler birbirinin tamamlayıcısıdır (örn. izlenen + izlenmeyen). Bu ilişkiyi yorumda dikkate al.`;
  }
  return "";
}

export function promptOlustur(girdi: PromptGirdisi): string {
  const { kategori, kombinasyon, degisken_adlari, sonuclar, baglam } = girdi;

  return [
    rolGirisCumlesi(baglam),
    ``,
    `**Analiz türü:** ${kategoriEtiketi(kategori)}`,
    `**Seçilen kombinasyon:** ${kombinasyon.tanim}`,
    `**Filtreler:** ${filtreOzeti(baglam)}`,
    ``,
    `**Metrikler ve sonuçlar:**`,
    metriklerOzeti(kombinasyon.degisken_idleri, degisken_adlari, sonuclar),
    tamamlayiciNotu(kombinasyon),
    ``,
    `Lütfen bu verilere bakarak ${baglam.rol_ad ?? "kullanıcı"} için kısa, somut ve eyleme dönük bir yorum yaz. Yorumun 3-5 cümleyi geçmesin. Türkçe yaz.`,
  ].join("\n");
}