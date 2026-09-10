import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBmPerformans } from "@/lib/tclub/hbligi/getBmPerformans";
import { bmPuaniniOku } from "@/lib/bi/bmPuan";
import { uttPuaniniOku } from "@/lib/bi/uttPuan";
import type { PuanSorgusu } from "@/lib/bi/puanSozlesmesi";

test("HB Ligi getBmPerformans: RPC'den gelen eclub_puani > 0 olan UTT'lerin kazanilan_toplam ve net_puan değerleri BM saha toplamına yansır", async () => {
  const mockBm = [
    { kullanici_id: "bm-1", ad: "Ahmet", soyad: "Yılmaz", bolge_id: "bolge-1" },
  ];
  const mockBolgeler = [
    { bolge_id: "bolge-1", bolge_adi: "Marmara" },
  ];
  const mockUttPerformans = [
    {
      kullanici_id: "utt-1",
      ad: "Ali",
      soyad: "Kaya",
      tamamlanan_izleme: 4,
      benzersiz_yayin: 3,
      izleme_puani: 40,
      cevaplama_puani: 20,
      oneri_puani: 10,
      extra_puan: 5,
      ileri_sarma_kaybi: 2,
      yanlis_cevap_kaybi: 3,
      oneri_kaybi: 1,
      eclub_puani: 25, // E-Club kazanımı > 0
      kazanilan_toplam: 100, // 40 + 20 + 10 + 5 + 25 = 100
      kaybedilen_toplam: 6,  // 2 + 3 + 1 = 6
      net_puan: 94,          // 100 - 6 = 94
    },
    {
      kullanici_id: "utt-2",
      ad: "Ayşe",
      soyad: "Demir",
      tamamlanan_izleme: 2,
      benzersiz_yayin: 2,
      izleme_puani: 20,
      cevaplama_puani: 10,
      oneri_puani: 0,
      extra_puan: 0,
      ileri_sarma_kaybi: 0,
      yanlis_cevap_kaybi: 1,
      oneri_kaybi: 0,
      eclub_puani: 15, // E-Club kazanımı > 0
      kazanilan_toplam: 45, // 20 + 10 + 0 + 0 + 15 = 45
      kaybedilen_toplam: 1, // 0 + 1 + 0 = 1
      net_puan: 44,         // 45 - 1 = 44
    },
  ];

  let rpcParametreleri: Record<string, unknown> | null = null;

  const supabaseMock = {
    from(tablo: string) {
      if (tablo === "kullanicilar") {
        const sorgu = {
          select() { return sorgu; },
          eq(alan: string, _deger: unknown) {
            assert.ok(["rol", "aktif_mi", "firma_id", "takim_id"].includes(alan));
            return sorgu;
          },
          then(resolve: (val: { data: typeof mockBm; error: null }) => void) {
            resolve({ data: mockBm, error: null });
          },
        };
        return sorgu;
      }
      if (tablo === "bolgeler") {
        const sorgu = {
          select() { return sorgu; },
          in() { return sorgu; },
          then(resolve: (val: { data: typeof mockBolgeler; error: null }) => void) {
            resolve({ data: mockBolgeler, error: null });
          },
        };
        return sorgu;
      }
      throw new Error(`Beklenmeyen tablo: ${tablo}`);
    },
    async rpc(fn: string, params: Record<string, unknown>) {
      assert.equal(fn, "get_bm_utt_performans_v2");
      rpcParametreleri = params;
      return { data: mockUttPerformans, error: null };
    },
  } as unknown as SupabaseClient;

  const periyot = { periyot: "ay" as const, yil: 2026, ay: 9 };
  const sonuclar = await getBmPerformans(
    supabaseMock,
    { firma_id: "firma-1", takim_id: "takim-1" },
    periyot,
  );

  assert.equal(sonuclar.length, 1);
  const bmSonuc = sonuclar[0];

  assert.equal(bmSonuc.bm_id, "bm-1");
  assert.equal(bmSonuc.bm_adi, "Ahmet Yılmaz");
  assert.equal(bmSonuc.bolge_adi, "Marmara");
  assert.equal(bmSonuc.toplam_utt, 2);
  assert.equal(bmSonuc.aktif_utt, 2);

  // E-Club dahil RPC toplamları
  assert.equal(bmSonuc.eclub_puani, 40); // 25 + 15
  assert.equal(bmSonuc.kazanilan_toplam, 145); // 100 + 45 (E-Club dahil)
  assert.equal(bmSonuc.kaybedilen_toplam, 7); // 6 + 1
  assert.equal(bmSonuc.net_puan, 138); // 94 + 44 = 138 (145 - 7)

  // Kalemler korunmuş mu
  assert.equal(bmSonuc.izleme_puani, 60);
  assert.equal(bmSonuc.cevaplama_puani, 30);
  assert.equal(bmSonuc.oneri_puani, 10);
  assert.equal(bmSonuc.extra_puan, 5);
  assert.equal(bmSonuc.ileri_sarma_kaybi, 2);
  assert.equal(bmSonuc.yanlis_cevap_kaybi, 4);
  assert.equal(bmSonuc.oneri_kaybi, 1);

  // Eski hatalı formül (E-Club'ı dışlayan) ile karşılaştır
  const eskiHataliKazanilanToplam = bmSonuc.izleme_puani + bmSonuc.cevaplama_puani + bmSonuc.oneri_puani + bmSonuc.extra_puan;
  assert.equal(eskiHataliKazanilanToplam, 105);
  assert.notEqual(bmSonuc.kazanilan_toplam, eskiHataliKazanilanToplam, "kazanilan_toplam E-Club'ı içermeli");
  assert.equal(bmSonuc.kazanilan_toplam, eskiHataliKazanilanToplam + (bmSonuc.eclub_puani ?? 0));

  // RPC parametreleri doğru aktarılmış mı
  assert.ok(rpcParametreleri !== null);
  assert.equal((rpcParametreleri as Record<string, unknown>).p_bm_id, "bm-1");
});

test("bi bmPuaniniOku: get_bm_puan_ozet RPC'sini kullanır, challenge_kayip_kayitlari dahil toplamları ve tekil ölçütleri döndürür", async () => {
  const simdi = new Date("2026-09-09T12:00:00+03:00");
  let fromCagrildi = false;
  let rpcParametreleri: Record<string, unknown> | null = null;

  const dbMock = {
    async rpc(fn: string, params: Record<string, unknown>) {
      assert.equal(fn, "get_bm_puan_ozet");
      rpcParametreleri = params;
      return {
        data: [{
          bm_id: params.p_bm_id,
          izleme_puani: 100,
          cevaplama_puani: 40,
          extra_puan: 20,
          cc_gonderme_puani: 10,
          cc_referral_puani: 30,
          ileri_sarma_kaybi: 5,
          yanlis_cevap_kaybi: 3,
          challenge_kaybi: 15, // Challenge kaybı > 0
          toplam_kazanc: 200,  // 100 + 40 + 20 + 10 + 30 = 200
          toplam_kayip: 23,    // 5 + 3 + 15 = 23
          toplam_net: 177,     // 200 - 23 = 177
        }],
        error: null,
      };
    },
    from(_tablo: string) {
      fromCagrildi = true;
      throw new Error("from() çağrılmamalı");
    },
  } as unknown as SupabaseClient;

  // 1. toplam_net testi: kazanc (200) - ileri (5) - yanlis (3) - challenge (15) = 177
  const netSorgu: PuanSorgusu = { olcut: "toplam_net", zaman: "ay", geriye: 0, karsilastir: false };
  const netSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", netSorgu, simdi);
  assert.equal(netSonuc.puan, 177);

  // 2. toplam_kayip testi: ileri (5) + yanlis (3) + challenge (15) = 23
  const kayipSorgu: PuanSorgusu = { olcut: "toplam_kayip", zaman: "ay", geriye: 0, karsilastir: false };
  const kayipSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", kayipSorgu, simdi);
  assert.equal(kayipSonuc.puan, 23);

  // 3. toplam_kazanc testi: kazanc = 200 (challenge kaybından ETKİLENMEZ)
  const kazancSorgu: PuanSorgusu = { olcut: "toplam_kazanc", zaman: "ay", geriye: 0, karsilastir: false };
  const kazancSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", kazancSorgu, simdi);
  assert.equal(kazancSonuc.puan, 200);

  // 4. Tekil kayıp ölçütleri testi: ileri_sarma = 5, yanlis_cevap = 3
  const ileriSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", { olcut: "ileri_sarma", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(ileriSonuc.puan, 5);

  const yanlisSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", { olcut: "yanlis_cevap", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(yanlisSonuc.puan, 3);

  // 5. Tekil kazanç ölçütleri testi
  const izlemeSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", { olcut: "izleme", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(izlemeSonuc.puan, 100);

  const cevaplamaSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", { olcut: "cevaplama", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(cevaplamaSonuc.puan, 40);

  const extraSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", { olcut: "extra", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(extraSonuc.puan, 20);

  const ccGondermeSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", { olcut: "cc_gonderme", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(ccGondermeSonuc.puan, 10);

  const ccReferralSonuc = await bmPuaniniOku(dbMock, "bm-test-id", "bm", { olcut: "cc_referral", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(ccReferralSonuc.puan, 30);

  // from çağrılmadığı ve RPC parametreleri doğrulandı
  assert.equal(fromCagrildi, false, "Ayrı tablolara sorgu yapılmamalı, RPC kullanılmalı");
  assert.equal(rpcParametreleri?.p_bm_id, "bm-test-id");
});

test("bi uttPuaniniOku: E-Club kazanımı ve kayıplar RPC'den tek seferde okunur, ikinci sorgu yapılmaz, toplamlar korunur", async () => {
  const simdi = new Date("2026-09-09T12:00:00+03:00");
  let fromCagrildi = false;

  const dbMock = {
    async rpc(fn: string, params: Record<string, unknown>) {
      assert.equal(fn, "get_kullanici_ozet");
      assert.equal(params.p_kullanici_id, "utt-test-id");
      return {
        data: [{
          video_puani: 100,
          soru_puani: 40,
          extra_puan: 20,
          oneri_puani: 10,
          eclub_puani: 30, // E-Club kazanımı > 0
          ileri_sarma_kaybi: 5, // Kayıp > 0
          yanlis_cevap_kaybi: 3,
          oneri_kaybi: 2,
          toplam_net_puan: 190, // RPC toplam_net_puan
        }],
        error: null,
      };
    },
    from(_tablo: string) {
      fromCagrildi = true;
      throw new Error("from() çağrılmamalı");
    },
  } as unknown as SupabaseClient;

  // 1. Tekil kalemler
  const izleme = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "izleme", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(izleme.puan, 100);

  const cevaplama = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "cevaplama", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(cevaplama.puan, 40);

  const extra = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "extra", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(extra.puan, 20);

  const oneri = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "oneri", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(oneri.puan, 10);

  const eclub = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "eclub", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(eclub.puan, 30);

  const ileriSarma = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "ileri_sarma", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(ileriSarma.puan, 5);

  const yanlisCevap = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "yanlis_cevap", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(yanlisCevap.puan, 3);

  const oneriKaybi = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "oneri_kaybi", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(oneriKaybi.puan, 2);

  // 2. Toplamlar
  const toplamKazanc = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "toplam_kazanc", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(toplamKazanc.puan, 200); // 100 + 40 + 20 + 10 + 30

  const toplamKayip = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "toplam_kayip", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(toplamKayip.puan, 10); // 5 + 3 + 2

  const toplamNet = await uttPuaniniOku(dbMock, "utt-test-id", "utt", { olcut: "toplam_net", zaman: "ay", geriye: 0, karsilastir: false }, simdi);
  assert.equal(toplamNet.puan, 190); // RPC toplam_net_puan

  // İkinci sorgu yapılmadığı doğrulanır
  assert.equal(fromCagrildi, false, "eclub_utt_puanlari tablosuna sorgu yapılmamalı");
});
