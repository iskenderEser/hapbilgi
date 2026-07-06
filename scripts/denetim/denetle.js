// scripts/denetim/denetle.js
//
// HapBilgi kod↔DB tutarlılık denetleyicisi.
// kullanim.json (koddaki .from/.select/.rpc) ile sema.json (gerçek DB şeması)
// karşılaştırır, uyuşmazlıkları raporlar:
//   - olmayan tablo/view (.from)
//   - olmayan RPC (.rpc)
//   - olmayan kolon (.select — üst seviye + nested embed)
//   - FK'si olmayan embed (nested embed ama ilişki yok)
//
// Kullanım:  node scripts/denetim/denetle.js
// Önce çalıştır: sema-cek.js (sema.json) + kod-tara.js (kullanim.json)
//
// NOT: .from ve .select ayrı çağrılar; hangi select hangi tabloya ait olduğunu
// AST birebir eşlemez. Bu yüzden select denetimi "embed kök tablosu"nu select
// içinden okur (nested embed'lerde tablo adı zaten yazılıdır). Üst seviye
// kolonların hangi tabloya ait olduğu belirsizse (from ayrı satırda), o kolonlar
// "sahipsiz" sayılıp yalnızca TÜM tablolarda hiç bulunmayanlar raporlanır
// (yanlış-pozitifi önlemek için muhafazakâr).

const fs = require("fs");
const path = require("path");

const sema = require("./sema.json");
const kullanim = require("./kullanim.json");

const hatalar = [];

function hata(dosya, satir, mesaj) {
  hatalar.push({ dosya, satir, mesaj });
}

// ─── 1. .from denetimi: tablo/view var mı ────────────────────────────────────
for (const f of kullanim.fromlar) {
  if (!sema.tablolar[f.tablo]) {
    hata(f.dosya, f.satir, `Tablo/view yok: "${f.tablo}"`);
  }
}

// ─── 2. .rpc denetimi: fonksiyon var mı ──────────────────────────────────────
for (const r of kullanim.rpcler) {
  if (!sema.rpc[r.fonksiyon]) {
    hata(r.dosya, r.satir, `RPC yok: "${r.fonksiyon}"`);
  }
}

// ─── 3. .select denetimi: embed'lerdeki kolonlar sahip tablolarında var mı ───
// Select gramerini ayrıştır: kolonlar + nested embed'ler.
// Nested embed: "tabloAdi ( iç ... )" veya "tabloAdi!inner ( iç ... )"
// Embed içindeki tablo adı bilindiği için o embed'in kolonları o tabloya aittir.

for (const s of kullanim.selectler) {
  const dugumler = selectAyristir(s.ham);
  // Kök embed'lerin ebeveyni, select'in ait olduğu from tablosudur (kod-tara ekler).
  const ebeveyn = s.tablo ?? null;

  // Üst-seviye kolon denetimi: select'in from tablosu biliniyorsa,
  // üst-seviye kolonlar (embed olmayanlar) o tabloda var mı?
  if (ebeveyn && sema.tablolar[ebeveyn]) {
    const tablo = sema.tablolar[ebeveyn];
    for (const d of dugumler) {
      if (d.tur !== "kolon") continue;
      const ad = ustKolonNormalize(d.ad);
      if (ad === null) continue; // atlanacak (*, alias, ifade)
      if (!tablo.kolonlar[ad]) {
        hata(s.dosya, s.satir, `Kolon yok: "${ebeveyn}.${ad}"`);
      }
    }
  }

  for (const d of dugumler) {
    if (d.tur === "embed") {
      embedDenetle(d, s.dosya, s.satir, ebeveyn);
    }
  }
}

// Üst-seviye bir kolon parçasını denetime uygun hale getirir.
// null dönerse denetlenmez (yıldız, alias tanımı, fonksiyon/ifade, boş).
function ustKolonNormalize(ham) {
  let ad = ham.trim();
  if (!ad || ad === "*") return null;
  // "takma_ad:gercek" → gerçek kolon adını denetle (alias hedefi)
  if (ad.includes(":")) ad = ad.split(":").pop().trim();
  // fonksiyon/cast/json yolu/parantez içeren ifadeleri atla
  if (/[()]/.test(ad)) return null;
  if (ad.includes("->") || ad.includes("::")) return null;
  // yalnız geçerli kolon adı biçimi (harf/rakam/alt çizgi)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ad)) return null;
  return ad;
}

// PostgREST embed adında ':' olabilir:
//   "takma_ad:gercek_tablo"  → gercek_tablo
//   "takma_ad:fk_kolon"      → fk_kolon'un ebeveyn tablodaki FK hedefi
//   "tablo:fk_kolon"         → tablo
// ebeveynTablo: bu embed'in çağrıldığı üst tablo (kök embed'de null).
function embedTabloCoz(ham, ebeveynTablo) {
  if (!ham.includes(":")) return ham;
  const [sol, sag] = ham.split(":");
  if (sema.tablolar[sag]) return sag; // takma_ad:tablo
  if (sema.tablolar[sol]) return sol; // tablo:fk_kolon
  // sag bir tablo değil → FK kolonu olabilir. Ebeveyn tablonun FK'lerinden
  // kaynak_kolon === sag olanın hedef tablosunu bul.
  if (ebeveynTablo && sema.fk[ebeveynTablo]) {
    const fk = sema.fk[ebeveynTablo].find((f) => f.kaynak_kolon === sag);
    if (fk) return fk.hedef_tablo;
  }
  // sol da FK kolonu olabilir (alias yoksa "tablo:fk" değil "fk" tek başına)
  if (ebeveynTablo && sema.fk[ebeveynTablo]) {
    const fk = sema.fk[ebeveynTablo].find((f) => f.kaynak_kolon === sol);
    if (fk) return fk.hedef_tablo;
  }
  return sag || sol; // çözülemedi → hata olarak raporlanır
}

// Bir embed düğümünü denetler: tablo var mı, kolonları var mı, alt embed'leri özyinele.
function embedDenetle(embed, dosya, satir, ebeveynTablo) {
  // PostgREST alias/FK-hint sözdizimi: "takma_ad:tablo" / "takma_ad:fk_kolon".
  const tabloAdi = embedTabloCoz(embed.tablo, ebeveynTablo);

  const tablo = sema.tablolar[tabloAdi];

  if (!tablo) {
    hata(dosya, satir, `Embed tablosu yok: "${tabloAdi}"`);
    return;
  }

  for (const c of embed.cocuklar) {
    if (c.tur === "kolon") {
      if (!tablo.kolonlar[c.ad]) {
        hata(dosya, satir, `Kolon yok: "${tabloAdi}.${c.ad}"`);
      }
    } else if (c.tur === "embed") {
      // Nested embed: kaynak tablodan hedefe FK var mı? (uyarı düzeyinde)
      const cocukTablo = embedTabloCoz(c.tablo, tabloAdi);
      const fkVar = embedFkVarMi(tabloAdi, cocukTablo);
      if (!fkVar) {
        hata(dosya, satir, `Embed FK'si yok: "${tabloAdi}" → "${cocukTablo}" (PostgREST embed çalışmayabilir)`);
      }
      embedDenetle(c, dosya, satir, tabloAdi);
    }
  }
}

// İki tablo arasında (her iki yönde) FK var mı?
function embedFkVarMi(a, b) {
  const ab = (sema.fk[a] ?? []).some((f) => f.hedef_tablo === b);
  const ba = (sema.fk[b] ?? []).some((f) => f.hedef_tablo === a);
  return ab || ba;
}

// ─── Select ayrıştırıcı ──────────────────────────────────────────────────────
// Girdi: "a, b, tablo ( x, y, alt ( z ) ), c"
// Çıktı: [ {tur:kolon,ad:a}, {tur:kolon,ad:b}, {tur:embed,tablo,cocuklar:[...]}, ... ]
function selectAyristir(ham) {
  // Boşluk/yeni satır sadeleştir
  const s = ham.replace(/\s+/g, " ").trim();
  const { dugumler } = ayristirIc(s, 0);
  return dugumler;
}

// pos'tan başlayıp bir seviye ayrıştırır; ')' veya string sonunda durur.
function ayristirIc(s, pos) {
  const dugumler = [];
  let tampon = "";

  const bitir = () => {
    const parca = tampon.trim();
    tampon = "";
    if (parca) {
      // "!inner"/"!left" gibi hint'leri temizle
      const ad = parca.split("!")[0].trim();
      if (ad) dugumler.push({ tur: "kolon", ad });
    }
  };

  while (pos < s.length) {
    const ch = s[pos];

    if (ch === "(") {
      // tampon = embed tablo adı (hint dahil olabilir)
      const tabloAdi = tampon.trim().split("!")[0].trim();
      tampon = "";
      const { dugumler: cocuklar, sonPos } = ayristirIc(s, pos + 1);
      dugumler.push({ tur: "embed", tablo: tabloAdi, cocuklar });
      pos = sonPos;
      continue;
    }

    if (ch === ")") {
      bitir();
      return { dugumler, sonPos: pos + 1 };
    }

    if (ch === ",") {
      bitir();
      pos++;
      continue;
    }

    tampon += ch;
    pos++;
  }

  bitir();
  return { dugumler, sonPos: pos };
}

// ─── Rapor ───────────────────────────────────────────────────────────────────
if (hatalar.length === 0) {
  console.log("✓ Uyuşmazlık bulunamadı. Kod ile DB şeması tutarlı.");
} else {
  // Dosyaya göre grupla, sırala
  hatalar.sort((a, b) => (a.dosya + a.satir).localeCompare(b.dosya + b.satir));
  console.log(`✗ ${hatalar.length} uyuşmazlık bulundu:\n`);
  for (const h of hatalar) {
    console.log(`  ${h.dosya}:${h.satir} — ${h.mesaj}`);
  }
  console.log("");
}

// JSON çıktısı da yaz (ileride CI/entegrasyon için)
fs.writeFileSync(
  path.join(__dirname, "denetim-sonuc.json"),
  JSON.stringify({ tarih: new Date().toISOString(), hata_sayisi: hatalar.length, hatalar }, null, 2),
  "utf8"
);