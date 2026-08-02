// components/panel/BilgiSayfa.tsx
//
// Bilgi sayfaları ortak kabuğu — Faz 1 / Adım 1.6
// (docs/ana_sayfa_kabuk_donusum_is_plani.md).
//
// Navbar bilgi pillerinin (HapBilgi Nedir / Nasıl Çalışır / Sözleşmeler / İletişim)
// açtığı sayfaların ortak iskeleti: başlık + "içerik yakında" placeholder. Gerçek
// içerik sonra girilecek. Navbar + sol liste (panel) layout'undan otomatik gelir.

interface BilgiSayfaProps {
  baslik: string;
}

export default function BilgiSayfa({ baslik }: BilgiSayfaProps) {
  return (
    <div style={{ padding: "24px", fontFamily: "'Nunito', sans-serif" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#111", marginBottom: "12px" }}>{baslik}</h1>
      <p style={{ fontSize: "14px", color: "#737373" }}>İçerik yakında.</p>
    </div>
  );
}
