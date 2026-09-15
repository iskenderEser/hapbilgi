# 📕 HapBilgi — REDBOOK (Açık İşler ve Teknik Borç Sicili)

*Açık işler ve teknik borçların çalışma nüshası. Kesin/mühürlü kararlar BLUEBOOK'ta; burada henüz kapanmamış, bekleyen veya sonraya bırakılmış kalemler tutulur.*

---

## § 6.4 — Açık İşler / Çalışma Nüshası

### Kasada Bekleyen Geliştirmeler

- **HBStore: dönemlik kullanım.** Mağaza kullanımını takvim çeyreklerine göre düzenle. Önceden belirtilen kurgu: her dönemin son haftasında açık; dönemin son günü 23:59'da kapanır ve sonraki dönemin son haftasında yeniden açılır.
- **E-Club Store: aylık kullanım.** Mağaza kullanımını aylık olarak düzenle. Ay içindeki açılış/kapanış günleri henüz belirlenmedi.

*Kayıt tarihi: 9 Eylül 2026 — İskender talebiyle hatırlatma olarak kasaya alındı; uygulama yapılmadı.*

### Teknik Borç

- **[TB-01] İzleme tablolarında soru-hakkı alan asimetrisi (tek-kaynak yönetimi).**
  Dört izleme tablosu soru hakkını tek tip tutmuyor: `izleme_kayitlari` (UTT) ve
  `eclub_izleme_kayitlari` (E-Club) `soru_hakki_var_mi` + `soru_hakki_nedeni`
  kullanırken; `cc_izleme_kayitlari` (BM) ve `eczanem_izleme_kayitlari` (müşteri)
  `cevaplandi_mi` kullanıyor. Soru-kesinti kuralı, dördüne eklenen tek tip
  `soru_erisimi_acik_mi` kapısıyla **davranış olarak** tekleştirildi; ancak eski
  iki alan yerinde kaldığından aynı alanda **üç bayrak** yan yana yaşıyor.
  **Bekleyen iş:** soru-hakkı kavramını tek alan/tek kaynağa indirgeyen refactor.
  Puan ve uygunluk mantığına dokunacağı için ayrı, kapsamlı ve riskli bir iştir;
  soru-kesinti kuralı canlıda oturduktan sonra ele alınmalıdır.
  *Kayıt tarihi: 30 Ağustos 2026 — İskender talebiyle.*

- **[TB-02] Dijital Broşür ve Literatür üretici inceleme/revizyon deneyimi.**
  İÜ yükleme ve teslim güvenliği modernize edildi; üretici inceleme arayüzünün
  kalan iyileştirmeleri kullanıcı kararıyla sonraya bırakıldı. Literatür
  incelemesinde isteğe bağlı yayın görseli PDF yanında gösterilmeli; kapak yoksa
  varsayılan Literatür kapağı kullanılmalı. Dijital Broşür ve Literatürde dosya
  doğrulama bilgileri açık gösterilmeli, revizyonda mevcut dosyalar korunmalı ve
  yalnız değiştirilen PDF/kapak/ana görselin yeniden yüklenmesine izin veren akış
  tamamlanmalıdır. Ham Bunny Storage yolları istemciye açılmamalıdır.
  *Kayıt tarihi: 15 Eylül 2026 — İskender talebiyle Faz 4 ertelendi.*
