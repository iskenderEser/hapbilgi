# 📕 HapBilgi — REDBOOK (Açık İşler ve Teknik Borç Sicili)

*Açık işler ve teknik borçların çalışma nüshası. Kesin/mühürlü kararlar BLUEBOOK'ta; burada henüz kapanmamış, bekleyen veya sonraya bırakılmış kalemler tutulur.*

---

## § 6.4 — Açık İşler / Çalışma Nüshası

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
