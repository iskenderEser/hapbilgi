# B09 Açık İşi İçin Mevcut Durum ve Öncelik Kategorisi

*30.07.2026 taraması. Rol adı elle yazılmış 390 literal / 132 dosya. Her dosya tek bir öncelik kategorisine atandı (öncelik-önceliğiyle; toplam 132).*

**Yöntem notu:** "Gerçek Sorun" otomatik ölçütü *"bir satırda ≥2 geçerli rol"*. Bu ölçüt bazı meşru `hedef_rol`/seçenek dizilerini de içine alır; planlamada her dosya tek tek okununca bunlar listeden düşer. "Sorun Değil" ölçütü *"tüm rol literalleri yorum ya da tip-union"*. "Sessiz Hata" birebir doğrulandı.

Öncelik sırası (uzlaşılan): **1-4-5-2-3** → Gerçek Sorun → Sessiz Hata → Karışık Kullanım → Sınırda → Sorun Değil.

---

## 1 · Gerçek Sorun — 55 dosya *(en yüksek öncelik)*

roller.ts'te hazır olan bir rol grubunun elle yeniden yazıldığı dosyalar. Asıl B-09 işi. *(Bunların 10'u roller.ts'i zaten import ediyor — yani aynı dosyada iki yöntem karışık.)*

- `app/ana-sayfa/api/route.ts`
- `app/analiz/api/yorumla/route.ts`
- `app/eclub/ligi/api/export/route.ts`
- `app/eclub/ligi/api/route.ts`
- `app/eclub/ligi/api/takim-adi/route.ts`
- `app/eclub/ligi/page.tsx`
- `app/eclub/listem/_components/EczaneBlogu.tsx`
- `app/eclub/listem/api/eczaneler/route.ts`
- `app/eclub/listem/api/kisiler/route.ts`
- `app/eclub/listem/page.tsx`
- `app/eclub/oneriler/api/route.ts`
- `app/eclub/oneriler/api/yayinlar/route.ts`
- `app/eclub/oneriler/page.tsx`
- `app/eclub/panel/api/baslat/route.ts`
- `app/eclub/panel/api/bitir/route.ts`
- `app/eclub/panel/api/cevapla/route.ts`
- `app/eclub/panel/api/route.ts`
- `app/eclub/panel/api/sorular/route.ts`
- `app/eclub/store/api/adres/route.ts`
- `app/eclub/store/api/route.ts`
- `app/eclub/store/api/siparis/route.ts`
- `app/eclub/store/rapor/api/route.ts`
- `app/eczanem/utt/page.tsx`
- `app/hbligi/api/route.ts`
- `app/izle/api/[yayin_id]/route.ts`
- `app/izle/api/baslat/route.ts`
- `app/izle/api/begeni/route.ts`
- `app/izle/api/bitir/route.ts`
- `app/izle/api/cevap/route.ts`
- `app/izle/api/favori/route.ts`
- `app/izle/api/ileri-sarma/route.ts`
- `app/izle/api/route.ts`
- `app/izle/api/sorular/route.ts`
- `app/kullanicilar/page.tsx`
- `app/oneriler/api/[oneri_id]/route.ts`
- `app/oneriler/api/route.ts`
- `app/oneriler/page.tsx`
- `app/profil/api/route.ts`
- `app/profil/page.tsx`
- `app/raporlar/api/utt/route.ts`
- `app/takimlar/api/route.ts`
- `app/talepler-v2/_components/YeniTalepFormV2.tsx`
- `app/talepler/_components/YeniTalepForm.tsx`
- `app/talepler/_hooks/useTalepFormu.ts`
- `app/talepler/api/dosyalar/route.ts`
- `app/yayin-yonetimi/_types.ts`
- `components/Navbar.tsx`
- `lib/oneri/limitKontrol.ts`
- `lib/rapor/bm/getBmData.ts`
- `lib/rapor/tm/getTmData.ts`
- `lib/rapor/uretici/getUreticiData.ts`
- `lib/rapor/utt/getUttData.ts`
- `lib/utils/anaSayfa/bm.ts`
- `lib/utils/anaSayfa/yonetici.ts`
- `lib/video/gorunurluk.ts`

---

## 2 · Sessiz Hata — 1 dosya *(canlı kusur, öncelikli)*

Var olmayan rol yazılmış; gerçek kullanıcı etkileniyor. Bu dosya aynı zamanda bir "Gerçek Sorun" dosyası, ama canlı hata içerdiği için ayrı ve önce ele alınır.

- `app/store/siparisler/_components/SiparisFiltreleri.tsx` (satır 147–151) — `egt_uzm`, `egt_uzm_jr`, `ik_uzm`, `ik_uzm_jr` (doğrusu `egt_uz`, `ik_uz`). Sonuç: gerçek `egt_uz`/`egt_yon`/`egt_yrd_md`/`ik_uz`/`ik_yrd_md`/`ik_drk`/`ik_per` rolleri, sayfaya erişebildikleri hâlde "Takım" filtresinden sessizce düşüyor.

---

## 3 · Karışık Kullanım — 26 dosya

roller.ts'i import eden ama yanında tekil rolü elle yazan dosyalar. *(Bu 26 + Gerçek Soruna terfi eden 10 import'lu dosya = "36 karışık dosya" rakamı.)*

- `app/ana-sayfa/page.tsx`
- `app/analiz/page.tsx`
- `app/oneriler/api/kullanicilar/route.ts`
- `app/raporlar/api/eczanem/route.ts`
- `app/raporlar/page.tsx`
- `app/senaryolar/[talep_id]/page.tsx`
- `app/senaryolar/api/durum/route.ts`
- `app/senaryolar/api/route.ts`
- `app/soru-setleri/[video_durum_id]/page.tsx`
- `app/soru-setleri/api/durum/route.ts`
- `app/soru-setleri/api/route.ts`
- `app/store/page.tsx`
- `app/talepler/[talep_id]/page.tsx`
- `app/talepler/api/route.ts`
- `app/teknikler/api/route.ts`
- `app/urunler/api/route.ts`
- `app/videolar/[senaryo_durum_id]/page.tsx`
- `app/videolar/api/bunny-durum/route.ts`
- `app/videolar/api/durum/route.ts`
- `app/videolar/api/route.ts`
- `app/yayin-yonetimi/api/bekleyenler/route.ts`
- `components/ana-sayfa/BmAnaSayfa.tsx`
- `components/ana-sayfa/IuAnaSayfa.tsx`
- `components/ana-sayfa/TmAnaSayfa.tsx`
- `lib/admin/kullaniciDogrulama.ts`
- `lib/utils/talepZinciri.ts`

---

## 4 · Sınırda — 45 dosya

Yalnız tekil-rol karşılaştırması, roller.ts import etmiyor. Merkezileştirme kazancı düşük; isteğe bağlı.

- `app/analiz/api/bm/kapsam/route.ts`
- `app/analiz/api/bm/sorgu/route.ts`
- `app/analiz/api/tm/kapsam/route.ts`
- `app/analiz/api/tm/sorgu/route.ts`
- `app/analiz/bm/layout.tsx`
- `app/analiz/bm/page.tsx`
- `app/analiz/tm/layout.tsx`
- `app/analiz/tm/page.tsx`
- `app/challenge-club/api/route.ts`
- `app/challenge-club/api/uygun-aliciler/route.ts`
- `app/challenge-club/api/uygun-videolar/route.ts`
- `app/challenge-club/izle/[yayin_id]/page.tsx`
- `app/challenge-club/izle/api/baslat/route.ts`
- `app/challenge-club/izle/api/bitir/route.ts`
- `app/challenge-club/izle/api/cevap/route.ts`
- `app/challenge-club/izle/api/ileri-sarma/route.ts`
- `app/challenge-club/page.tsx`
- `app/eclub/ligi/_hooks/useEclubLigi.ts`
- `app/eclub/oneriler/_components/OneriGonder.tsx`
- `app/eczanem/page.tsx`
- `app/hbligi/page.tsx`
- `app/kullanicilar/api/route.ts`
- `app/login/page.tsx`
- `app/onaylanan-talepler/page.tsx`
- `app/oneriler/api/yayinlar/route.ts`
- `app/raporlar/api/bm/route.ts`
- `app/raporlar/api/tm/route.ts`
- `app/videolar/api/bunny-yukleme-baslat/route.ts`
- `app/yayin-yonetimi/_hooks/useYayinYonetimi.ts`
- `app/yayin-yonetimi/page.tsx`
- `components/TalepSahibiKarti.tsx`
- `components/pill/VaryantPill.tsx`
- `components/raporlar/EczanemDokumBolumu.tsx`
- `lib/analiz/paylasilan/promptOlustur.ts`
- `lib/cc/uygunAliciListesi.ts`
- `lib/cc/uygunVideoListesi.ts`
- `lib/hbligi/getBmLig.ts`
- `lib/hbligi/getTmLig.ts`
- `lib/hbligi/getUttLig.ts`
- `lib/uretim/surec.ts`
- `lib/uretim/toastMesaj.ts`
- `lib/utils/anaSayfa/bmAktivite.ts`
- `lib/utils/anaSayfa/utt.ts`
- `lib/utils/durum/mesaj.ts`
- `lib/video/departman.ts`

---

## 5 · Sorun Değil — 5 dosya *(kapsam dışı)*

Tüm rol literalleri yorum ya da tip-union; dokunulmaz.

- `app/admin/api/eclub/onaylar/route.ts`
- `app/eclub/listem/_types.ts`
- `app/eclub/oneriler/_types.ts`
- `components/pill/DurumPill.tsx`
- `types/auth.ts`

---

**Toplam:** 55 + 1 + 26 + 45 + 5 = **132 dosya.**
