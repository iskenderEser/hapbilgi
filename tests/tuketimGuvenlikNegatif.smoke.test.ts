import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { etkilesimYayinYetkisi } from "../lib/etkilesim/yayinYetkisi.ts";
import { ogrenmeAraciTamamlamaKapisi } from "../lib/ogrenmeAraci/tamamlamaKapisi.ts";
import { podcastTranskriptErisiminiCoz } from "../lib/ogrenmeAraci/podcastTranskriptErisimi.ts";
import { yayinThumbnailCevabi } from "../lib/ogrenmeAraci/yayinThumbnail.ts";

type Satir = Record<string, unknown>;
type Tablolar = Record<string, Satir[]>;

class Sorgu implements PromiseLike<{ data: Satir[] | Satir | null; error: null }> {
  private kosullar: Array<[string, unknown]> = [];
  private dahilKosullari: Array<[string, unknown[]]> = [];
  private readonly satirlar: Satir[];
  constructor(satirlar: Satir[]) { this.satirlar = satirlar; }
  select() { return this; }
  eq(alan: string, deger: unknown) { this.kosullar.push([alan, deger]); return this; }
  in(alan: string, degerler: unknown[]) { this.dahilKosullari.push([alan, degerler]); return this; }
  limit() { return this; }
  private sonuc() {
    return this.satirlar.filter((satir) =>
      this.kosullar.every(([alan, deger]) => satir[alan] === deger)
      && this.dahilKosullari.every(([alan, degerler]) => degerler.includes(satir[alan])),
    );
  }
  async maybeSingle() { return { data: this.sonuc()[0] ?? null, error: null }; }
  then<TResult1 = { data: Satir[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Satir[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.sonuc(), error: null }).then(onfulfilled, onrejected);
  }
}

function sahteDb(tablolar: Tablolar): SupabaseClient {
  return { from: (tablo: string) => new Sorgu(tablolar[tablo] ?? []) } as unknown as SupabaseClient;
}

const yayin = {
  yayin_id: "yayin-1",
  durum: "yayinda",
  firma_id: "firma-1",
  takim_id: "takim-1",
  hedef_roller: ["utt"],
  arac_turu: "podcast",
};

test("UTT etkileşimi yanlış kullanıcı, takım, hedef veya eksik öneri bağıyla açılamaz", async () => {
  const temel: Tablolar = {
    v_yayin_detay: [yayin],
    kullanicilar: [{ kullanici_id: "utt-1", firma_id: "firma-1", takim_id: "takim-1", aktif_mi: true }],
    oneri_kayitlari: [{ oneri_id: "oneri-1", kullanici_id: "utt-1", yayin_id: "yayin-1" }],
  };
  assert.equal(await etkilesimYayinYetkisi(sahteDb(temel), { userId: "utt-1", rol: "utt", yayinId: "yayin-1" }), true);
  assert.equal(await etkilesimYayinYetkisi(sahteDb({ ...temel, oneri_kayitlari: [] }), { userId: "utt-1", rol: "utt", yayinId: "yayin-1" }), false);
  assert.equal(await etkilesimYayinYetkisi(sahteDb({ ...temel, kullanicilar: [{ ...temel.kullanicilar[0], takim_id: "takim-2" }] }), { userId: "utt-1", rol: "utt", yayinId: "yayin-1" }), false);
  assert.equal(await etkilesimYayinYetkisi(sahteDb({ ...temel, v_yayin_detay: [{ ...yayin, hedef_roller: ["bm"] }] }), { userId: "utt-1", rol: "utt", yayinId: "yayin-1" }), false);
  assert.equal(await etkilesimYayinYetkisi(sahteDb(temel), { userId: "baska-utt", rol: "utt", yayinId: "yayin-1" }), false);
});

test("BM yalnız kendisine ait challenge kaydında etkileşim kurabilir", async () => {
  const temel: Tablolar = {
    v_yayin_detay: [{ ...yayin, hedef_roller: ["bm"] }],
    kullanicilar: [{ kullanici_id: "bm-1", firma_id: "firma-1", takim_id: "takim-1", aktif_mi: true }],
    challenge_kayitlari: [{ challenge_id: "challenge-1", alan_id: "bm-1", yayin_id: "yayin-1" }],
  };
  assert.equal(await etkilesimYayinYetkisi(sahteDb(temel), { userId: "bm-1", rol: "bm", yayinId: "yayin-1" }), true);
  assert.equal(await etkilesimYayinYetkisi(sahteDb({ ...temel, challenge_kayitlari: [{ challenge_id: "c-2", alan_id: "bm-2", yayin_id: "yayin-1" }] }), { userId: "bm-1", rol: "bm", yayinId: "yayin-1" }), false);
});

test("E-Club etkileşimi aktif firma, doğru unvan hedefi ve kişiye ait öneriyi birlikte ister", async () => {
  const temel: Tablolar = {
    v_yayin_detay: [{ ...yayin, hedef_roller: ["eczaci"] }],
    eclub_kisiler: [{ kisi_id: "kisi-1", auth_user_id: "auth-1", rol: "eczaci", ad: "E", soyad: "K", eposta: "e@test", telefon: "1" }],
    eclub_kisi_eczane: [{ kisi_id: "kisi-1", eczane_id: "eczane-1", aktif_mi: true }],
    eclub_eczane_firma: [{ eczane_id: "eczane-1", firma_id: "firma-1", aktif_mi: true }],
    firmalar: [{ firma_id: "firma-1", firma_adi: "Firma", aktif: true, eclub_aktif: true, eclub_store_aktif: true, eczanem_aktif: true }],
    eclub_oneri_kayitlari: [{ oneri_id: "oneri-1", kisi_id: "kisi-1", yayin_id: "yayin-1" }],
  };
  const girdi = { userId: "auth-1", rol: "eczaci", yayinId: "yayin-1", eclubKisi: { kisi_id: "kisi-1", rol: "eczaci" } };
  assert.equal(await etkilesimYayinYetkisi(sahteDb(temel), girdi), true);
  assert.equal(await etkilesimYayinYetkisi(sahteDb({ ...temel, eclub_oneri_kayitlari: [] }), girdi), false);
  assert.equal(await etkilesimYayinYetkisi(sahteDb({ ...temel, firmalar: [{ ...temel.firmalar[0], eclub_aktif: false }] }), girdi), false);
  assert.equal(await etkilesimYayinYetkisi(sahteDb({ ...temel, v_yayin_detay: [{ ...yayin, hedef_roller: ["eczane_teknisyeni"] }] }), girdi), false);
});

test("durdurulmuş yayın, bozuk veya başka türe ait kanıtla tamamlanamaz", () => {
  const podcastKaniti = { aracTuru: "podcast", surum: 1, olusturulmaTarihi: new Date().toISOString(), veri: { dogrulanmisSaniye: 98, sonaUlasti: true } };
  assert.equal(ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "durduruldu", aracTuru: "podcast", tamamlamaKaniti: podcastKaniti }).ok, false);
  assert.equal(ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "yayinda", aracTuru: "gorsel", tamamlamaKaniti: podcastKaniti }).ok, false);
  assert.equal(ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "yayinda", aracTuru: "podcast", tamamlamaKaniti: { ...podcastKaniti, olusturulmaTarihi: "bozuk" } }).ok, false);
});

test("API cevapları ham depolama yollarını ve onaysız transkript sırlarını sızdırmaz", () => {
  const cevap = yayinThumbnailCevabi({
    yayin_id: "y-1",
    arac_id: "a-1",
    arac_turu: "podcast",
    arac_dosya_yolu: "gizli/ses.mp3",
    arac_kapak_yolu: "gizli/kapak.webp",
    arac_transkript_yolu: "gizli/transkript.pdf",
    arac_metadata: { kapak_dogrulandi: false, taslak_metin: "gizli" },
  });
  const metin = JSON.stringify(cevap);
  for (const gizli of ["gizli/ses.mp3", "gizli/kapak.webp", "gizli/transkript.pdf", "taslak_metin"]) assert.equal(metin.includes(gizli), false);

  const transkript = podcastTranskriptErisiminiCoz({
    metadata: { transkript: { durum: "ai_taslak", taslak_metin: "özel taslak", ai_girisim_id: "g-1" } },
    transkriptYolu: "gizli/transkript.pdf",
    imzaliUrlUret: () => "https://cdn.test/sizinti",
  });
  assert.equal(transkript.transkriptUrl, null);
  assert.equal(JSON.stringify(transkript).includes("özel taslak"), false);
  assert.equal(JSON.stringify(transkript).includes("g-1"), false);
});
