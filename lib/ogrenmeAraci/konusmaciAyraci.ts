// lib/ogrenmeAraci/konusmaciAyraci.ts
//
// Podcast AI transkriptlerinde iki konuşmacı ayrımı ve isteğe bağlı adlandırma yardımcıları.

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Model çıktısındaki olası Markdown konuşmacı etiketlerini ve biçimlendirmelerini düz metne normalize eder:
 * **Konuşmacı 1:** -> Konuşmacı 1:
 * **Konuşmacı 2:** -> Konuşmacı 2:
 * **Konuşmacı 1**: -> Konuşmacı 1:
 * **Konuşmacı 2**: -> Konuşmacı 2:
 * *Konuşmacı 1:* -> Konuşmacı 1:
 * Yalnızca SATIR BAŞINDA yer alan konuşmacı etiketlerine uygulanır; konuşma içeriği kesinlikle değiştirilmez.
 */
/**
 * Model çıktısındaki veya transkript metnindeki konuşmacı etiketlerini ve satır boşluklarını normalize eder:
 * 1. İsimler bold yapılır: **Konuşmacı 1:** ve **Konuşmacı 2:** (veya özelleştirilmiş **Ahmet:** / **Ayşe:**)
 * 2. Konuşmacı 1 ile Konuşmacı 2 alt alta (\n);
 *    ikinci konuşmacı 1 ve konuşmacı 2 (yeni döngü) ile aralarında 1 satır boşluk (\n\n) bırakılır.
 * Monolog metinlere ve cümle içi içeriklere kesinlikle dokunulmaz.
 */
export function konusmaciMetniniNormalizeEt(metin: string): string {
  if (!metin || typeof metin !== "string") return metin;

  let sonuc = metin;

  // 1. Olası code block sarmalını kaldır (örn: ```text ... ```)
  sonuc = sonuc.replace(/^```[a-zA-Z0-9_-]*\r?\n/i, "").replace(/\r?\n```\s*$/i, "").trim();

  // 2. Satır satır inceleyip iki konuşmacı diyaloğu var mı denetle
  const lines = sonuc.split(/\r?\n/);
  const onEkMetinler: string[] = [];
  const bloklar: Array<{ etiket: string; metin: string }> = [];
  let suankiEtiket: string | null = null;
  let suankiMetinler: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Satır başındaki konuşmacı etiketini bul (örn: **Konuşmacı 1:**, [Konuşmacı 1]:, Konuşmacı 1:, **Ahmet:**)
    const match = line.match(/^(?:\*\*)?([^:\n*]{1,50})(?:\*\*)?:\s*(?:\*\*)?(.*)$/);
    if (match) {
      const etiket = match[1].replace(/^\*+|\*+$/g, "").trim();
      const kalan = match[2].trim();
      if (suankiEtiket !== null && suankiMetinler.length > 0) {
        bloklar.push({ etiket: suankiEtiket, metin: suankiMetinler.join(" ") });
      }
      suankiEtiket = etiket;
      suankiMetinler = kalan ? [kalan] : [];
    } else {
      if (suankiEtiket !== null) {
        suankiMetinler.push(line);
      } else {
        onEkMetinler.push(line);
      }
    }
  }

  if (suankiEtiket !== null && suankiMetinler.length > 0) {
    bloklar.push({ etiket: suankiEtiket, metin: suankiMetinler.join(" ") });
  }

  // Farklı etiketleri bul
  const benzersizEtiketler: string[] = [];
  for (const b of bloklar) {
    if (!benzersizEtiketler.includes(b.etiket)) {
      benzersizEtiketler.push(b.etiket);
    }
  }

  // İki konuşmacı yoksa (monolog vb.) orijinal metni dön
  if (benzersizEtiketler.length !== 2) {
    return sonuc;
  }

  // Ardışık aynı konuşmacıları birleştir
  const birlesik: Array<{ etiket: string; metin: string }> = [];
  for (const b of bloklar) {
    const son = birlesik[birlesik.length - 1];
    if (son && son.etiket === b.etiket) {
      son.metin += ` ${b.metin}`;
    } else {
      birlesik.push({ etiket: b.etiket, metin: b.metin });
    }
  }

  // Yeniden inşa et:
  // - İsimler bold: **Etiket:**
  // - Konuşmacı 1 ile Konuşmacı 2 alt alta (\n)
  // - Yeni döngü başladığında (ilk konuşmacıya dönüldüğünde) 1 satır boşluk (\n\n)
  const ilkEtiket = birlesik[0]?.etiket;
  let cikti = onEkMetinler.length > 0 ? `${onEkMetinler.join("\n")}\n\n` : "";
  for (let i = 0; i < birlesik.length; i++) {
    const b = birlesik[i];
    const replik = `**${b.etiket}:** ${b.metin}`;
    if (i === 0) {
      cikti += replik;
    } else {
      const onceki = birlesik[i - 1];
      const yeniDongu = b.etiket === ilkEtiket && onceki.etiket !== ilkEtiket;
      const ayirici = yeniDongu ? "\n\n" : "\n";
      cikti += ayirici + replik;
    }
  }

  return cikti;
}

/**
 * Metinde iki konuşmacı etiketinin ("Konuşmacı 1:" ve "Konuşmacı 2:") olup olmadığını kontrol eder.
 */
export function metindeIkiKonusmaciVarMi(metin: string): boolean {
  if (!metin || typeof metin !== "string") return false;
  const k1Var = /(?:^|\r?\n)\s*(?:\*\*)?Konuşmacı 1(?:\*\*)?:\s*(?:\*\*)?/.test(metin);
  const k2Var = /(?:^|\r?\n)\s*(?:\*\*)?Konuşmacı 2(?:\*\*)?:\s*(?:\*\*)?/.test(metin);
  if (k1Var && k2Var) return true;

  // Satır başlarında iki farklı konuşmacı etiketi var mı (kullanıcı adlandırdıysa örn: Ahmet: ve Ayşe: veya A: ve Konuşmacı 2:)?
  return metindekiIkiKonusmaciyiBul(metin) !== null;
}

/**
 * Kullanıcı girdisini güvenli düz metne dönüştürür (HTML etiketlerini, iki noktaları ve satır sonlarını temizler).
 */
export function konusmaciAdiniTemizle(ad: string): string {
  if (!ad || typeof ad !== "string") return "";
  return ad
    .replace(/<[^>]*>/g, "") // HTML etiketlerini kaldır
    .replace(/[:]/g, "") // İki nokta karakterini temizle (etiket sonuna kendimiz koyuyoruz)
    .replace(/[\r\n\t]/g, " ") // Satır sonu ve tab karakterlerini boşluğa çevir
    .replace(/^\*+|\*+$/g, "") // Yıldız işaretlerini temizle (bold etiketi kendimiz koyuyoruz)
    .trim()
    .slice(0, 50); // En fazla 50 karakter
}

/**
 * Konuşmacı adlarının geçerliliğini denetler.
 */
export function konusmaciAdlariGecerliMi(
  ad1: string,
  ad2: string
): { gecerli: boolean; hata?: string } {
  if (ad1.length > 50 || ad2.length > 50) {
    return { gecerli: false, hata: "Konuşmacı adı en fazla 50 karakter olabilir." };
  }

  const t1 = konusmaciAdiniTemizle(ad1);
  const t2 = konusmaciAdiniTemizle(ad2);

  // İki alanın nihai etiketleri (boş bırakılanlar varsayılan etiketi korur)
  const efektif1 = t1 || "Konuşmacı 1";
  const efektif2 = t2 || "Konuşmacı 2";

  // İki konuşmacıya aynı ad verilemez (Türkçe büyük/küçük harf duyarsız)
  if (efektif1.toLocaleLowerCase("tr-TR") === efektif2.toLocaleLowerCase("tr-TR")) {
    return { gecerli: false, hata: "İki konuşmacıya aynı ad verilemez." };
  }

  return { gecerli: true };
}

/**
 * Metin içindeki yalnızca SATIR BAŞINDA yer alan konuşmacı etiketini günceller.
 * Konuşma cümleleri içindeki benzer ifadeleri kesinlikle değiştirmez.
 * Hem bold (**etiket:**) hem düz (etiket:) etiketleri destekler.
 */
export function konusmaciEtiketiniGuncelle(
  metin: string,
  eskiEtiket: string,
  yeniEtiket: string
): string {
  if (!metin || typeof metin !== "string") return metin;
  const temizEski = eskiEtiket.replace(/^\*+|\*+$/g, "").trim();
  const temizYeni = yeniEtiket.replace(/^\*+|\*+$/g, "").trim();
  if (!temizEski || !temizYeni || temizEski === temizYeni) return metin;

  const regex = new RegExp(
    `(^|\\r?\\n)(\\*\\*)?${escapeRegExp(temizEski)}(\\*\\*)?:?(\\*\\*)?\\s*`,
    "g"
  );
  return metin.replace(regex, (tam, on, b1, b2, b3) => {
    const boldMu = Boolean(b1 || b2 || b3?.includes("**"));
    if (boldMu) {
      return `${on}**${temizYeni}:** `;
    }
    return `${on}${temizYeni}: `;
  });
}

/**
 * Metinde iki konuşmacı olup olmadığını algılar ve etiketlerini döner.
 * Default "Konuşmacı 1" / "Konuşmacı 2" veya daha önce özelleştirilmiş 2 konuşmacı etiketini tespit eder.
 */
export function metindekiIkiKonusmaciyiBul(
  metin: string
): { etiket1: string; etiket2: string } | null {
  if (!metin || typeof metin !== "string") return null;

  // 1. Doğrudan varsayılan etiketler var mı?
  const k1Var = /(?:^|\r?\n)\s*(?:\*\*)?Konuşmacı 1(?:\*\*)?:\s*(?:\*\*)?/.test(metin);
  const k2Var = /(?:^|\r?\n)\s*(?:\*\*)?Konuşmacı 2(?:\*\*)?:\s*(?:\*\*)?/.test(metin);
  if (k1Var && k2Var) {
    return { etiket1: "Konuşmacı 1", etiket2: "Konuşmacı 2" };
  }

  // 2. Satır başlarında iki farklı konuşmacı etiketi var mı?
  const lines = metin.split(/\r?\n/);
  const etiketler: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(?:\*\*)?([^:\n*]{1,50})(?:\*\*)?:\s*(?:\*\*)?(.*)$/);
    if (match) {
      const etiket = match[1].replace(/^\*+|\*+$/g, "").trim();
      if (etiket && !etiketler.includes(etiket)) {
        etiketler.push(etiket);
      }
    }
  }

  // Yalnızca tam olarak 2 konuşmacı etiketi varsa
  if (etiketler.length === 2) {
    if (etiketler[0] === "Konuşmacı 2" && etiketler[1] !== "Konuşmacı 2") {
      return { etiket1: etiketler[1], etiket2: etiketler[0] };
    }
    return { etiket1: etiketler[0], etiket2: etiketler[1] };
  }

  return null;
}
