// app/admin/eclub-store/page.tsx
"use client";

import { HataMesajiContainer } from "@/components/HataMesaji";
import { useEclubStoreAdminPanel } from "./_hooks/useEclubStoreAdminPanel";
import { useEclubStoreKategori } from "./_hooks/useEclubStoreKategori";
import { useEclubStoreUrun } from "./_hooks/useEclubStoreUrun";
import { useEclubStoreSiparis } from "./_hooks/useEclubStoreSiparis";

import EclubStoreSekmeBari from "./_components/EclubStoreSekmeBari";
import EclubStoreUrunlerSekmesi from "./_components/EclubStoreUrunlerSekmesi";
import EclubStoreKategorilerSekmesi from "./_components/EclubStoreKategorilerSekmesi";
import EclubStoreSiparislerSekmesi from "./_components/EclubStoreSiparislerSekmesi";

export default function AdminEclubStorePage() {
  const admin = useEclubStoreAdminPanel();
  const kategori = useEclubStoreKategori({ hata: admin.hata, basari: admin.basari });
  const urun = useEclubStoreUrun({ hata: admin.hata, basari: admin.basari });
  const siparis = useEclubStoreSiparis({ hata: admin.hata, basari: admin.basari });

  if (admin.yukleniyor || !admin.kullanici) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 40px", borderBottom: "0.5px solid #e5e7eb" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>E-Club Store Yönetimi</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", color: "#737373" }}>{admin.kullanici.adSoyad}</span>
          <button onClick={admin.cikisYap} style={{ padding: "6px 12px", background: "#1d4ed8", border: "none", borderRadius: "6px", fontSize: "12px", color: "white", cursor: "pointer" }}>Çıkış</button>
        </div>
      </div>

      <HataMesajiContainer mesajlar={admin.mesajlar} />

      <div style={{ padding: "20px 40px", maxWidth: "1100px", margin: "0 auto" }}>
        <EclubStoreSekmeBari aktifSekme={admin.aktifSekme} setAktifSekme={admin.setAktifSekme} />

        {admin.aktifSekme === "urunler" && (
          <EclubStoreUrunlerSekmesi {...urun} hata={admin.hata} basari={admin.basari} />
        )}
        {admin.aktifSekme === "kategoriler" && (
          <EclubStoreKategorilerSekmesi {...kategori} hata={admin.hata} basari={admin.basari} />
        )}
        {admin.aktifSekme === "siparisler" && (
          <EclubStoreSiparislerSekmesi {...siparis} />
        )}
      </div>
    </div>
  );
}