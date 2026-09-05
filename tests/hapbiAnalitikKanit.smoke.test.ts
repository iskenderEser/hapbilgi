import assert from "node:assert/strict";
import test from "node:test";
import { hapbiAnalitikKanitlariOlustur } from "@/lib/hapbi/analitik/kanit";
import type { HapbiAnalitikSonuc } from "@/lib/hapbi/analitik/sozlesme";
import { hapbiYanitUret, sonYanitiDogrula } from "@/lib/hapbi/gemini";
import type { HapbiAracSonucu } from "@/lib/hapbi/sozlesme";

const kaynak = { id: "a1", baslik: "T-Club analitik sonucu", url: "/hbligi", zaman: "2026-09-04", donem: "2026 / dönem: 3" };
const berk = { tur: "kullanici" as const, id: "utt-1", ad: "Berk Kılıç" };
const zeynep = { tur: "kullanici" as const, id: "utt-2", ad: "Zeynep Arslan" };
const urunA = { tur: "urun" as const, id: "urun-1", ad: "Ürün A" };
const urunB = { tur: "urun" as const, id: "urun-2", ad: "Ürün B" };

const sonuc: HapbiAnalitikSonuc = {
  surum: "hapbi-analitik-v1",
  sorgu: {
    surum: "hapbi-analitik-v1",
    veri_alani: "tclub",
    kapsam: { tur: "takim", kaynak_rol: "pm", kullanici_id: "pm-1", firma_id: "f1", takim_id: "t1" },
    donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
    olcutler: ["net_puan", "ileri_sarma_kaybi"],
    boyutlar: ["kullanici", "urun"],
    filtreler: [],
    islem: "siralama",
    siralama: { olcut: "net_puan", yon: "azalan" },
  },
  veri_durumu: "var",
  satirlar: [
    { boyutlar: { kullanici: berk, urun: urunA }, olcumler: { net_puan: 582, ileri_sarma_kaybi: 84 } },
    { boyutlar: { kullanici: zeynep, urun: urunB }, olcumler: { net_puan: 414, ileri_sarma_kaybi: 56 } },
  ],
  toplamlar: { net_puan: 996, ileri_sarma_kaybi: 140 },
  olgular: [
    { ozne: berk, iliski: "net_puan", deger: 582, baglam: { kullanici: berk, urun: urunA } },
    { ozne: berk, iliski: "ileri_sarma_kaybi", deger: 84, baglam: { kullanici: berk, urun: urunA } },
    { ozne: zeynep, iliski: "net_puan", deger: 414, baglam: { kullanici: zeynep, urun: urunB } },
    { ozne: zeynep, iliski: "ileri_sarma_kaybi", deger: 56, baglam: { kullanici: zeynep, urun: urunB } },
  ],
  kaynaklar: [kaynak],
  tam_mi: true,
};

const kanitlar = hapbiAnalitikKanitlariOlustur(sonuc, kaynak.id);
const aracSonucu: HapbiAracSonucu = { durum: "ok", kaynak, veri: { ...sonuc, kanitlar } };
const id = (parca: string) => kanitlar.find((kanit) => kanit.id.includes(parca))!.id;

test("analitik kanıt: satır ve toplam olgularına kararlı kimlik verir", () => {
  assert.equal(kanitlar.length, 6);
  assert.equal(id("utt-1:net_puan"), "a1:satir:kullanici:utt-1:net_puan:1");
  assert.equal(id("toplam:net_puan"), "a1:toplam:net_puan");
});

test("analitik kanıt: doğru kişi, ölçüt, değer ve dönem ilişkisini kabul eder", () => {
  const yanit = sonYanitiDogrula({
    yanit_turu: "bilgi",
    cevap: "3. çeyrekte Berk Kılıç 582 net puan aldı.",
    kaynak_idleri: ["a1"],
    kanit_idleri: [id("utt-1:net_puan")],
  }, [aracSonucu], "test");
  assert.match(yanit.cevap, /582 net puan/);
});

test("analitik kanıt: kanıtsız ve bilinmeyen olgu kimliğini reddeder", () => {
  const ortak = { yanit_turu: "bilgi", cevap: "Berk Kılıç 582 net puan aldı.", kaynak_idleri: ["a1"] };
  assert.throws(() => sonYanitiDogrula(ortak, [aracSonucu], "test"), /olgu kanıtları seçilmedi/);
  assert.throws(() => sonYanitiDogrula({ ...ortak, kanit_idleri: ["a1:olmayan"] }, [aracSonucu], "test"), /bilinmeyen bir olgu/);
});

test("analitik kanıt: kaynakta bulunan sayıları yanlış kişilere bağlamayı reddeder", () => {
  assert.throws(() => sonYanitiDogrula({
    yanit_turu: "bilgi",
    cevap: "Berk Kılıç 414 net puan aldı; Zeynep Arslan 582 net puan aldı.",
    kaynak_idleri: ["a1"],
    kanit_idleri: [id("utt-1:net_puan"), id("utt-2:net_puan")],
  }, [aracSonucu], "test"), /ölçüm ilişkisi doğrulanamadı/);
});

test("analitik kanıt: adı kullanılan varlık için seçilmiş olgu arar", () => {
  assert.throws(() => sonYanitiDogrula({
    yanit_turu: "bilgi",
    cevap: "Zeynep Arslan ekip sıralamasında yer alıyor.",
    kaynak_idleri: ["a1"],
    kanit_idleri: [id("utt-1:net_puan")],
  }, [aracSonucu], "test"), /Zeynep Arslan için seçilmiş analitik olgu/);
});

test("analitik kanıt: kişi ile ürünün aynı sonuç satırında bağlı olmasını ister", () => {
  assert.doesNotThrow(() => sonYanitiDogrula({
    yanit_turu: "bilgi",
    cevap: "Berk Kılıç, Ürün A için 582 net puan üretti.",
    kaynak_idleri: ["a1"],
    kanit_idleri: [id("utt-1:net_puan")],
  }, [aracSonucu], "test"));
  assert.throws(() => sonYanitiDogrula({
    yanit_turu: "bilgi",
    cevap: "Berk Kılıç, Ürün B için 582 net puan üretti.",
    kaynak_idleri: ["a1"],
    kanit_idleri: [id("utt-1:net_puan"), id("utt-2:net_puan")],
  }, [aracSonucu], "test"), /aynı analitik olguda/);
});

test("analitik kanıt: seçilmiş toplam olgusunu kişi olgusundan ayırır", () => {
  assert.doesNotThrow(() => sonYanitiDogrula({
    yanit_turu: "bilgi",
    cevap: "Ekibin toplam ileri sarma kaybı 140 puandır.",
    kaynak_idleri: ["a1"],
    kanit_idleri: [id("toplam:ileri_sarma_kaybi")],
  }, [aracSonucu], "test"));
  assert.throws(() => sonYanitiDogrula({
    yanit_turu: "bilgi",
    cevap: "Ekibin toplam ileri sarma kaybı 140 puandır.",
    kaynak_idleri: ["a1"],
    kanit_idleri: [id("utt-1:ileri_sarma_kaybi")],
  }, [aracSonucu], "test"), /seçilen kaynakta bulunamadı/);
});

test("analitik kanıt: yanlış kişi-değer ilişkisini yayımlamaz ve tek düzeltme turunda onarır", async () => {
  const modelIstekleri: Record<string, unknown>[] = [];
  let tur = 0;
  const yanit = await hapbiYanitUret({
    soru: "3. çeyrekte ilk iki UTT'yi net puana göre göster",
    pathname: "/hbligi", rol: "pm", takvim: { yil: 2026, ay: 9, ceyrek: 3, hafta: 36 }, gecmis: [],
    arac: async () => aracSonucu,
    apiKey: "test", model: "gemini-test", izinliAraclar: ["analitik_sorgu"], azamiModelCagrisi: 3, azamiAracCagrisi: 1,
    fetcher: (async (_girdi, baslatma) => {
      const govde = JSON.parse(String(baslatma?.body)) as Record<string, unknown>;
      modelIstekleri.push(govde);
      tur++;
      const functionCall = tur === 1 ? {
        name: "analitik_sorgu",
        args: { veri_alani: "tclub", periyot: "donem", yil: 2026, ceyrek: 3, olcutler: ["net_puan"], boyutlar: ["kullanici"], islem: "siralama" },
      } : tur === 2 ? {
        name: "yaniti_sun",
        args: {
          yanit_turu: "bilgi", cevap: "Berk Kılıç 414 net puan, Zeynep Arslan 582 net puan aldı.", kaynak_idleri: ["a1"],
          kanit_idleri: [id("utt-1:net_puan"), id("utt-2:net_puan")],
        },
      } : {
        name: "yaniti_sun",
        args: {
          yanit_turu: "bilgi", cevap: "Berk Kılıç 582 net puan, Zeynep Arslan 414 net puan aldı.", kaynak_idleri: ["a1"],
          kanit_idleri: [id("utt-1:net_puan"), id("utt-2:net_puan")],
        },
      };
      return new Response(JSON.stringify({
        usageMetadata: { totalTokenCount: 10 },
        candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ functionCall }] } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });
  assert.match(yanit.cevap, /Berk Kılıç 582.*Zeynep Arslan 414/);
  assert.equal(modelIstekleri.length, 3);
  assert.match(JSON.stringify(modelIstekleri[2]), /ANALITIK_ILISKI/);
});
