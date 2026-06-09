# HapBilgi Rapor Metrikleri Sözlüğü

Bu belge HapBilgi platformundaki rapor sayfalarında gösterilen tüm metriklerin tanımını, formülünü, veri kaynağını ve periyot davranışını içerir. Yeni rol raporları eklendikçe (TM, GM, PM, UTT) bu belge genişletilecek.

**Versiyon**: v1 — BM Raporu (Haziran 2026)

---

## BM Raporu

BM (Bölge Müdürü) raporu, bir BM'nin sorumlu olduğu bölgedeki UTT/KD_UTT performansını ve bölgenin takım/şirket içindeki konumunu gösterir.

**Sayfa**: `app/raporlar/bm/page.tsx`
**API**: `app/raporlar/api/bm/route.ts`
**Veri katmanı**: `lib/rapor/bm/getBmData.ts`, `lib/rapor/bm/aggregateUtt.ts`

---

### 1. Başlık bloğu (kullanıcı bilgisi)

- **Gösterildiği yer**: Sayfa başı (sol üst)
- **İçerik**: Ad Soyad · "BM" · Bölge adı · Takım adı
- **Beslendiği alan**: `data.kullanici`
- **Veri kaynağı**: `kullanicilar` tablosu + `bolgeler` + `takimlar` join
- **Periyot davranışı**: Periyottan bağımsız (statik kullanıcı bilgisi)

### 2. Periyot toggle

- **Gösterildiği yer**: Sayfa başı (sağ üst)
- **Seçenekler**: Günlük / Haftalık / Aylık / Dönemlik / Yıllık
- **Beslendiği alan**: Frontend state `periyot` (varsayılan: `bu_ay`)
- **Veri kaynağı**: `lib/utils/raporUtils.ts` → `PERIYOTLAR` sabiti
- **Tarih hesabı**: `lib/utils/tarihAraligi.ts` → seçilen periyodu `baslangic` ve `bitis` timestamp'ine çevirir

### 3. Takım katkısı kartı

- **Gösterildiği yer**: Üst grid (sol)
- **Formül**: `(bolge_toplam_puan / takim_toplam_puan) * 100`
- **Beslendiği alan**: `data.katki.takim_katki_yuzdesi`, `bolge_toplam_puan`, `takim_toplam_puan`
- **Veri kaynağı**:
  - `bolge_toplam_puan` ← `get_analiz_utt` RPC çıktısının toplamı (periyot filtreli)
  - `takim_toplam_puan` ← `v_rapor_takim.toplam_puan` view (periyot filtresi YOK)
- **Periyot davranışı**: ⚠️ Karışık — pay periyota duyarlı, payda tüm zamanlar. Periyot değiştirince katkı yüzdesi anlamsız sonuç verebilir.

### 4. Şirket katkısı kartı

- **Gösterildiği yer**: Üst grid (sağ)
- **Formül**: `(bolge_toplam_puan / sirket_toplam_puan) * 100`
- **Beslendiği alan**: `data.katki.sirket_katki_yuzdesi`
- **Veri kaynağı**:
  - `bolge_toplam_puan` ← `get_analiz_utt` RPC (periyot filtreli)
  - `sirket_toplam_puan` ← `v_rapor_sirket.toplam_puan` view (periyot filtresi YOK)
- **Periyot davranışı**: ⚠️ Karışık (3 numaralı metrikle aynı sorun)

### 5. Bölge toplam puan

- **Gösterildiği yer**: 2. satır grid (sol)
- **Formül**: Bölgedeki UTT'lerin `kazanilan_puanlar`'daki tüm pozitif puanlarının toplamı
- **Beslendiği alan**: `data.bolge_ozet.toplam_puan`
- **Veri kaynağı**: `get_analiz_utt` RPC çıktısının UTT bazında toplamı (route.ts içinde `aggregateUtt` ile)
- **Periyot davranışı**: ✅ Periyot filtreli

### 6. Ortalama puan / UTT

- **Gösterildiği yer**: 2. satır grid (orta)
- **Formül**: `bolge_toplam_puan / utt_sayisi` (yuvarlanmış)
- **Beslendiği alan**: `data.bolge_ozet.ortalama_puan`, `en_yuksek_puan`
- **Veri kaynağı**: `aggregateUtt` çıktısı
- **Periyot davranışı**: ✅ Periyot filtreli (pay) + statik (payda = bölgedeki UTT sayısı)
- **Notlar**: Alt yazıda "En yüksek: X" gösterilir — bölgedeki en yüksek puanlı UTT'nin puanı

### 7. İzlenme oranı

- **Gösterildiği yer**: 2. satır grid (sağ)
- **Formül**: `(toplam_izlenme / (toplam_yayin × utt_sayisi)) * 100`
- **Beslendiği alan**: `data.bolge_ozet.izlenme_orani`, `toplam_izlenme`, `kalan_izlenme`
- **Veri kaynağı**:
  - `toplam_izlenme` ← `aggregateUtt` çıktısı (tamamlanan izlemelerin toplamı)
  - `toplam_yayin` ← `yayin_yonetimi` tablosu (`durum='yayinda' AND hedef_roller contains 'bm'`)
  - `utt_sayisi` ← RPC çıktısının satır sayısı
- **Periyot davranışı**: ⚠️ Karışık — izlenme periyotlu, yayın sayısı periyotsuz
- **Notlar**: "Öğrenme Yatırımı Realizasyonu" mantığıyla tasarlandı (video adedi bazlı). Süre çarpanı manuel.

### 8. Aktif UTT

- **Gösterildiği yer**: 3. satır grid (sol)
- **Formül**: Tamamlanan izlemesi > 0 olan UTT sayısı / toplam UTT sayısı
- **Beslendiği alan**: `data.bolge_ozet.aktif_utt`, `toplam_utt`, `hic_izlemeyen_utt`
- **Veri kaynağı**: `aggregateUtt` (her UTT için `tamamlanan_izleme > 0` kontrolü)
- **Periyot davranışı**: ✅ Periyot filtreli (RPC üzerinden gelen tamamlanan izleme periyot içindeki)
- **Notlar**: BM ihbar metriği. "5 UTT'n var, 2'si izleme yaptı" mantığı.

### 9. Bölge lig sırası

- **Gösterildiği yer**: 3. satır grid (orta)
- **Formül**: BM'nin bölgesinin takım içindeki sırası (puana göre azalan)
- **Beslendiği alan**: `data.lig.bolge_sirasi / data.lig.toplam_bolge_sayisi`
- **Veri kaynağı**: `v_rapor_bolge` view'ından `takim_id` filtresi + `toplam_puan DESC` sıralaması
- **Periyot davranışı**: ⚠️ Periyot filtresi YOK — view tüm zamanlar üzerinden sıralama yapıyor

### 10. Toplam yayın

- **Gösterildiği yer**: 3. satır grid (sağ)
- **Formül**: `yayin_yonetimi`'nde `durum='yayinda'` ve `hedef_roller` içinde `'bm'` olan yayın sayısı
- **Beslendiği alan**: `data.bolge_ozet.toplam_yayin`
- **Veri kaynağı**: `getBmData.ts` içinde doğrudan `yayin_yonetimi` sorgusu
- **Periyot davranışı**: ⚠️ Periyot filtresi YOK — yayında olan tüm yayınlar

### 11. Uyarı barı (Hatırlat butonu)

- **Gösterildiği yer**: Aksiyon barı (kırmızı bant)
- **Görünme koşulu**: `bekleyen_oneri_olan_utt_sayisi > 0 || hic_izlemeyen_utt > 0`
- **İçerik**: "X UTT'nin bekleyen önerisi var · Y UTT henüz hiç izlememiş"
- **Beslendiği alan**: `oneri_etkinligi.bekleyen_oneri_olan_utt_sayisi`, `bolge_ozet.hic_izlemeyen_utt`
- **Hatırlat butonu**: ⚠️ `disabled` — ölü feature
- **Notlar**: v31'de aktive edilecek veya kaldırılacak

### 12. Öneri etkinliği — Gönderilen

- **Gösterildiği yer**: Öneri etkinliği grid (sol)
- **Formül**: BM'nin gönderdiği toplam öneri sayısı (alıcılarda görünen)
- **Beslendiği alan**: `data.oneri_etkinligi.gonderilen`
- **Veri kaynağı**: `aggregateUtt.toplamOneri` (UTT bazında alınan önerilerin toplamı)
- **Periyot davranışı**: ✅ Periyot filtreli

### 13. Öneri etkinliği — Tamamlanan

- **Gösterildiği yer**: Öneri etkinliği grid (orta)
- **Formül**: `tamamlanan / gonderilen * 100`
- **Beslendiği alan**: `data.oneri_etkinligi.tamamlanan`, `tamamlanma_orani`
- **Veri kaynağı**: `aggregateUtt.tamamlananOneri`
- **Periyot davranışı**: ✅ Periyot filtreli

### 14. Öneri etkinliği — Bekleyen

- **Gösterildiği yer**: Öneri etkinliği grid (sağ)
- **Formül**: `100 - tamamlanma_orani` (yüzde olarak)
- **Beslendiği alan**: `data.oneri_etkinligi.bekleyen`
- **Veri kaynağı**: `aggregateUtt.bekleyenOneri`
- **Periyot davranışı**: ✅ Periyot filtreli

### 15. HBLigi sıralaması — Bölgeler

- **Gösterildiği yer**: HBLigi bloğu
- **İçerik**: BM'nin takımındaki bölgelerin sıralı listesi (puana göre azalan)
- **Üst metrikler**:
  - `Bölge sırası`: BM'nin sırası / toplam bölge sayısı
  - `Bir üst sıra için`: Üst sıradaki bölgenin puan farkı (BM birinciyse — sınır kuralı: kendi puanı)
  - `Takipçiyle farkın`: Alt sıradaki bölgenin puan farkı (BM sonuncuysa — sınır kuralı: kendi puanı)
- **Beslendiği alan**: `data.lig.bolge_siralamasi[]`, `bir_ust_puan_farki`, `takipci_farki`
- **Veri kaynağı**: `v_rapor_bolge` view, BM'nin takımındaki bölgeler
- **Periyot davranışı**: ⚠️ Periyot filtresi YOK — view tüm zamanlar üzerinden
- **Notlar**: BM kendi takımı içindeki bölgeleri görür, diğer takımları görmez. C kuralı: sınır durumda kendi puanı gösterilir.

### 16. UTT Listesi — Puan & Katkı

- **Gösterildiği yer**: UTT Listesi bloğu (bar grafik)
- **İçerik**: Bölgedeki her UTT için bar — `puan / toplam_puan * 100` yüzdesi
- **Beslendiği alan**: `data.utt_listesi[]`
- **Veri kaynağı**: `get_analiz_utt` RPC, BM'nin bölgesi filtrelenmiş
- **Periyot davranışı**: ✅ Periyot filtreli
- **Notlar**: UTT puanına göre azalan sıralama. Toplam ve ortalama üstte gösterilir.

### 17. UTT Bazında Puan Dökümü & Kayıplar

- **Gösterildiği yer**: Detay tablo
- **Kolonlar**: UTT / Video / Soru / Öneri / Extra / Kayıplar / Öneri durumu
- **Formüller**:
  - **Video** = `puan_turu='izleme'` toplamı (kullanıcı bazlı)
  - **Soru** = `puan_turu='cevaplama'` toplamı
  - **Öneri** = `puan_turu='oneri'` toplamı
  - **Extra** = `puan_turu='extra'` toplamı
  - **Kayıplar** = `ileri_sarma_kaybi + yanlis_cevap_kaybi + oneri_kaybi` (mutlak değer)
- **Beslendiği alan**: `data.utt_listesi[]`, `data.ortalama_utt`
- **Veri kaynağı**: `get_analiz_utt` RPC + view eklemeleri
- **Periyot davranışı**: ✅ Periyot filtreli
- **Notlar**: Net/Gross ayrımı bu kademede henüz yok — sadece kayıplar ayrı kolon olarak gösteriliyor.

### 18. Ürün bazlı izlenme sayıları

- **Gösterildiği yer**: Alt grid (sol)
- **İçerik**: Bölgedeki ürün başına izlenme sayısı, bar grafik
- **Beslendiği alan**: `data.urun_bazli_dagilim[]`
- **Veri kaynağı**: `v_rapor_urun_izlenme` view, `bolge_id` filtresi
- **Periyot davranışı**: ⚠️ Periyot filtresi YOK

### 19. Teknik bazlı izlenme sayıları

- **Gösterildiği yer**: Alt grid (sağ)
- **İçerik**: Bölgedeki teknik başına izlenme sayısı
- **Beslendiği alan**: `data.teknik_bazli_dagilim[]`
- **Veri kaynağı**: `v_rapor_urun_izlenme` view (aynı view, farklı kolon)
- **Periyot davranışı**: ⚠️ Periyot filtresi YOK

### 20. Beğeni & Favori listeleri

- **Gösterildiği yer**: Sayfa altı
- **İçerik**: BM'nin takımında en çok beğenilen / favorilenen yayınlar (top 5)
- **Beslendiği alan**: `data.begeni_listesi[]`, `data.favori_listesi[]`
- **Veri kaynağı**: `v_rapor_begeni_favori` view, `takim_id` filtresi
- **Periyot davranışı**: ⚠️ Periyot filtresi YOK
- **Notlar**: Beğeni listesi `begeni_sayisi DESC`, favori listesi `favori_sayisi DESC` ile sıralı.

---

## Açık Sorular (v31'de Çözülecek)

- **Periyot davranış tutarsızlığı**: Pek çok metrikte pay periyot filtreli, payda periyotsuz. Bu kasıtlı bir tasarım mı yoksa eksik mi?
- **`v_rapor_takim` ve `v_rapor_sirket` periyot filtresi**: View'lar periyot parametresi alamaz; RPC versiyonu (`get_analiz_takim`) var ama bu sayfada kullanılmıyor.
- **Hatırlat butonu**: Aktive mi edilecek, kaldırılacak mı?
- **Net Puan / Gross Puan ayrımı**: BM Raporu'nda Toplam Puan (Gross) gösteriliyor, Net Puan ayrı kolon olarak yok. Eklenecek mi?
- **Toplam yayın hedef rol filtresi**: Şu an sadece `hedef_roller contains 'bm'` ile filtre var. UTT, KD_UTT, TM gibi diğer hedef rolleri kapsayacak mı?

---

## Veri Sözleşmesi (RaporData)

```typescript
interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; bolge_adi: string; takim_adi: string };
  katki: {
    takim_katki_yuzdesi: number;
    sirket_katki_yuzdesi: number;
    bolge_toplam_puan: number;
    takim_toplam_puan: number;
    sirket_toplam_puan: number;
  };
  bolge_ozet: {
    toplam_utt: number;
    aktif_utt: number;
    hic_izlemeyen_utt: number;
    toplam_puan: number;
    ortalama_puan: number;
    en_yuksek_puan: number;
    izlenme_orani: number;
    toplam_izlenme: number;
    kalan_izlenme: number;
    toplam_yayin: number;
  };
  lig: {
    bolge_sirasi: number | null;
    toplam_bolge_sayisi: number;
    bir_ust_puan_farki: number | null;
    takipci_farki: number | null;
    bolge_siralamasi: Array<{ sira: number; bolge_adi: string; puan: number; kendisi_mi: boolean }>;
  };
  oneri_etkinligi: {
    gonderilen: number;
    tamamlanan: number;
    tamamlanma_orani: number;
    bekleyen: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  utt_listesi: UttItem[];
  ortalama_utt: OrtalamaUtt;
  urun_bazli_dagilim: Array<{ urun_adi: string; izlenme_sayisi: number }>;
  teknik_bazli_dagilim: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}
```
