import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  KullaniciKategoriDagilimi,
  KullaniciOzetSatiri,
  KullaniciUrunDagilimi,
} from '@/lib/rapor/bm/getBmData';
import { kategorileriTopla, ozetToplami, urunleriTopla } from '@/lib/rapor/bm/toplamlar';

function ozet(kullanici_id: string, video_puani: number): KullaniciOzetSatiri {
  return {
    kullanici_id,
    ad: kullanici_id,
    soyad: 'UTT',
    izlenme_sayisi: 1,
    video_puani,
    soru_puani: 0,
    oneri_puani: 0,
    extra_puan: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
    toplam_net_puan: video_puani,
  };
}

test('mutlu: UTT özetleri ile aynı kategori ve ürün satırları bölge toplamına dönüşür', () => {
  const utt1 = ozet('u1', 10);
  const utt2 = ozet('u2', 20);
  const kategoriler: KullaniciKategoriDagilimi[] = [
    { ...utt1, icerik_turu: 'urun', teknik_dagilimi: [{ teknik_adi: 'Anlatım', izlenme_sayisi: 1 }] },
    { ...utt2, icerik_turu: 'urun', teknik_dagilimi: [{ teknik_adi: 'Anlatım', izlenme_sayisi: 1 }] },
  ];
  const urunler: KullaniciUrunDagilimi[] = [
    { ...utt1, urun_id: 'p1', urun_adi: 'Ürün 1', teknik_dagilimi: [] },
    { ...utt2, urun_id: 'p1', urun_adi: 'Ürün 1', teknik_dagilimi: [] },
  ];

  assert.equal(ozetToplami([utt1, utt2]).toplam_net_puan, 30);
  assert.deepEqual(kategorileriTopla(kategoriler), [{
    icerik_turu: 'urun',
    izlenme_sayisi: 2,
    video_puani: 30,
    soru_puani: 0,
    oneri_puani: 0,
    extra_puan: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
    toplam_net_puan: 30,
    teknik_dagilimi: [{ teknik_adi: 'Anlatım', izlenme_sayisi: 2 }],
  }]);
  assert.equal(urunleriTopla(urunler)[0]?.toplam_net_puan, 30);
});

test('red: farklı kategori ve ürün kimlikleri tek satırda birleştirilmez', () => {
  const utt = ozet('u1', 10);
  const kategoriler: KullaniciKategoriDagilimi[] = [
    { ...utt, icerik_turu: 'urun', teknik_dagilimi: [] },
    { ...utt, icerik_turu: 'ik', teknik_dagilimi: [] },
  ];
  const urunler: KullaniciUrunDagilimi[] = [
    { ...utt, urun_id: 'p1', urun_adi: 'Ürün 1', teknik_dagilimi: [] },
    { ...utt, urun_id: 'p2', urun_adi: 'Ürün 2', teknik_dagilimi: [] },
  ];

  assert.deepEqual(kategorileriTopla(kategoriler).map(satir => satir.icerik_turu).sort(), ['ik', 'urun']);
  assert.deepEqual(urunleriTopla(urunler).map(satir => satir.urun_id).sort(), ['p1', 'p2']);
});
