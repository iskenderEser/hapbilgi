import type { HapbiYorumSonucu } from "./yorum";
import type { HapbiYorumPaketi } from "./yorumPaketi";

export type HapbiYorumDogrulamaBaglami = Readonly<{
  izinliVarlikAdlari: readonly string[];
  tumBilinenVarlikAdlari: readonly string[];
}>;

export type HapbiYorumDogrulamaHatasi =
  | "model_yaniti_basarisiz"
  | "yorum_metni_eksik"
  | "yeni_sayi_uretildi"
  | "kanitsiz_neden_uretildi"
  | "kapsam_disi_varlik_uretildi"
  | "puan_yanlis_anlamlandirildi";

export type HapbiYorumDogrulamaSorunu = Readonly<{
  hata: HapbiYorumDogrulamaHatasi;
  ayrinti: string;
  bulunanDeger?: string;
}>;

export type HapbiDogrulanmisYorum = Readonly<{
  metin: string;
  modelCagrisi: 1;
}>;

export type HapbiYorumDogrulamaSonucu =
  | Readonly<{
    dogrulandi: true;
    yorum: HapbiDogrulanmisYorum;
  }>
  | Readonly<{
    dogrulandi: false;
    sorunlar: readonly HapbiYorumDogrulamaSorunu[];
  }>;

const NEDEN_KALIPLARI = [
  /\bçünkü\b/gu,
  /\bnedeniyle\b/gu,
  /\bsebebiyle\b/gu,
  /\bsonucu olarak\b/gu,
  /\bkaynaklan(?:ıyor|maktadır|mış|abilir)?\b/gu,
  /\byol aç(?:ıyor|mıştır|abilir)?\b/gu,
  /\bsayesinde\b/gu,
] as const;

const YASAK_PUAN_KALIPLARI = [
  /\bpuan\w*\b[^.!?\n]{0,80}\bsatış başar(?:ısı|ısını|ısının|ısıyla)\b/gu,
  /\bsatış başar(?:ısı|ısını|ısının|ısıyla)\b[^.!?\n]{0,80}\bpuan\w*\b/gu,
  /\bpuan\w*\b[^.!?\n]{0,80}\bmesleki yeterlilik\b/gu,
  /\bmesleki yeterlilik\b[^.!?\n]{0,80}\bpuan\w*\b/gu,
  /\bpuan\w*\b[^.!?\n]{0,80}\bkesin başarı\b/gu,
  /\bkesin başarı\b[^.!?\n]{0,80}\bpuan\w*\b/gu,
  /\bpuan\w*\b[^.!?\n]{0,80}\bbaşarılıdır\b/gu,
  /\bbaşarılıdır\b[^.!?\n]{0,80}\bpuan\w*\b/gu,
] as const;

function metniTemizle(metin: string): string {
  return metin.trim().replace(/\r\n/gu, "\n");
}

function karsilastirmaMetni(metin: string): string {
  return metin
    .normalize("NFC")
    .toLocaleLowerCase("tr-TR")
    .replace(/[’']/gu, "")
    .replace(/[^\p{L}\p{N}%.,+-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function sayiBelirtecleriniBul(metin: string): string[] {
  return metin.match(/[-+]?\d+(?:[.,]\d+)?%?/gu) ?? [];
}

function sayiBelirteciniNormalizeEt(belirtec: string): string {
  const yuzde = belirtec.endsWith("%");
  const ham = yuzde ? belirtec.slice(0, -1) : belirtec;
  const sayi = Number(ham.replace(",", "."));
  return Number.isFinite(sayi) ? `${sayi}${yuzde ? "%" : ""}` : belirtec;
}

function pakettekiSayiKumesi(paket: HapbiYorumPaketi): Set<string> {
  const kume = new Set<string>();
  for (const belirtec of sayiBelirtecleriniBul(JSON.stringify(paket))) {
    kume.add(sayiBelirteciniNormalizeEt(belirtec));
  }
  return kume;
}

function yeniSayilariBul(metin: string, paket: HapbiYorumPaketi): string[] {
  const izinliSayilar = pakettekiSayiKumesi(paket);
  const yeniSayilar = new Set<string>();
  // Satır başındaki Markdown liste numarası bir ölçüm veya hedef değildir.
  const icerik = metin.replace(/^ {0,3}\d{1,9}[.)][\t ]+/gmu, "");
  for (const belirtec of sayiBelirtecleriniBul(icerik)) {
    if (!izinliSayilar.has(sayiBelirteciniNormalizeEt(belirtec))) yeniSayilar.add(belirtec);
  }
  return [...yeniSayilar];
}

function cumlelereAyir(metin: string): string[] {
  return metin
    .split(/(?<=[.!?])\s+|\n+/gu)
    .map((cumle) => cumle.trim())
    .filter(Boolean);
}

function nedenIfadesiVarMi(metin: string): boolean {
  const normal = karsilastirmaMetni(metin);
  return NEDEN_KALIPLARI.some((kalip) => {
    kalip.lastIndex = 0;
    return kalip.test(normal);
  });
}

function kanitliNedenCumlesiMi(cumle: string, paket: HapbiYorumPaketi): boolean {
  const normalCumle = karsilastirmaMetni(cumle);
  return paket.secilmisKanitlar.some((kanit) => {
    const normalKanit = karsilastirmaMetni(kanit);
    return normalKanit === normalCumle;
  });
}

function kanitsizNedenleriBul(metin: string, paket: HapbiYorumPaketi): string[] {
  return cumlelereAyir(metin).filter((cumle) =>
    nedenIfadesiVarMi(cumle) && !kanitliNedenCumlesiMi(cumle, paket)
  );
}

function varlikMetindeGeciyorMu(metin: string, varlik: string): boolean {
  const normalMetin = ` ${karsilastirmaMetni(metin)} `;
  const normalVarlik = karsilastirmaMetni(varlik);
  return normalVarlik.length > 1 && normalMetin.includes(` ${normalVarlik} `);
}

function paketVarliklari(paket: HapbiYorumPaketi): string[] {
  return [...new Set([
    ...paket.dogrulanmisBulgular.map((bulgu) => bulgu.ad),
    paket.kapsamEtiketi,
  ].map((deger) => karsilastirmaMetni(deger)).filter(Boolean))];
}

function kapsamDisiVarliklariBul(
  metin: string,
  paket: HapbiYorumPaketi,
  baglam: HapbiYorumDogrulamaBaglami,
): string[] {
  const izinli = new Set([
    ...baglam.izinliVarlikAdlari,
    ...paketVarliklari(paket),
  ].map((deger) => karsilastirmaMetni(deger)).filter(Boolean));

  return [...new Set(baglam.tumBilinenVarlikAdlari)]
    .filter((varlik) => !izinli.has(karsilastirmaMetni(varlik)))
    .filter((varlik) => varlikMetindeGeciyorMu(metin, varlik));
}

function yasakPuanYorumlariniBul(metin: string): string[] {
  const normal = karsilastirmaMetni(metin);
  const bulunan = new Set<string>();
  for (const kalip of YASAK_PUAN_KALIPLARI) {
    kalip.lastIndex = 0;
    for (const eslesme of normal.matchAll(kalip)) bulunan.add(eslesme[0]);
  }
  return [...bulunan];
}

export function hapbiYorumunuDogrula(
  modelSonucu: HapbiYorumSonucu,
  paket: HapbiYorumPaketi,
  baglam: HapbiYorumDogrulamaBaglami,
): HapbiYorumDogrulamaSonucu {
  if (!modelSonucu.basarili) {
    return {
      dogrulandi: false,
      sorunlar: [{
        hata: "model_yaniti_basarisiz",
        ayrinti: "Model çağrısı başarılı olmadığı için yorum doğrulanamadı.",
      }],
    };
  }

  const metin = metniTemizle(modelSonucu.yorum);
  if (!metin) {
    return {
      dogrulandi: false,
      sorunlar: [{
        hata: "yorum_metni_eksik",
        ayrinti: "Model cevabında doğrulanabilecek yorum metni bulunmuyor.",
      }],
    };
  }

  const sorunlar: HapbiYorumDogrulamaSorunu[] = [];
  for (const sayi of yeniSayilariBul(metin, paket)) {
    sorunlar.push({
      hata: "yeni_sayi_uretildi",
      ayrinti: "Model, doğrulanmış yorum paketinde bulunmayan bir sayı üretti.",
      bulunanDeger: sayi,
    });
  }

  for (const cumle of kanitsizNedenleriBul(metin, paket)) {
    sorunlar.push({
      hata: "kanitsiz_neden_uretildi",
      ayrinti: "Model, seçilmiş kanıtlarda bulunmayan bir neden üretti.",
      bulunanDeger: cumle,
    });
  }

  for (const varlik of kapsamDisiVarliklariBul(metin, paket, baglam)) {
    sorunlar.push({
      hata: "kapsam_disi_varlik_uretildi",
      ayrinti: "Model, sunucunun belirlediği kapsamın dışındaki bir varlıktan söz etti.",
      bulunanDeger: varlik,
    });
  }

  for (const ifade of yasakPuanYorumlariniBul(metin)) {
    sorunlar.push({
      hata: "puan_yanlis_anlamlandirildi",
      ayrinti: "Model, puanı satış başarısı, mesleki yeterlilik veya kesin başarı göstergesi olarak yorumladı.",
      bulunanDeger: ifade,
    });
  }

  if (sorunlar.length > 0) {
    if (sorunlar.every((sorun) => sorun.hata === "kanitsiz_neden_uretildi")) {
      const reddedilenler = new Set(sorunlar.map((sorun) => sorun.bulunanDeger));
      const kalan = cumlelereAyir(metin).filter((cumle) => !reddedilenler.has(cumle));
      const temizMetin = kalan.join("\n\n");
      // Cümle silinir; sözcük silerek kanıtsız bir iddia gizlenmez.
      // Yalnız başlık kaldıysa öneri yerine kullanılmaz.
      if (kalan.some((cumle) => /[.!?]$/u.test(cumle))) {
        return hapbiYorumunuDogrula({ ...modelSonucu, yorum: temizMetin }, paket, baglam);
      }
    }
    return { dogrulandi: false, sorunlar };
  }
  return {
    dogrulandi: true,
    yorum: {
      metin,
      modelCagrisi: 1,
    },
  };
}
