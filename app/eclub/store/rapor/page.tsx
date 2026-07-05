// app/eclub/store/rapor/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";

interface RaporSatir {
  siparis_id: string;
  firma_id: string;
  kullanilan_puan: number;
  ad_soyad: string;
  eczane_adi: string;
  urun_adi: string;
  siparis_toplam: number;
  durum: string;
  tarih: string | null;
}

const DURUM_ETIKET: Record<string, string> = {
  beklemede: "Beklemede", hazirlaniyor: "Hazırlanıyor", kargoda: "Kargoda",
  teslim_edildi: "Teslim Edildi", iptal: "İptal",
};

export default function EclubStoreRaporPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata } = useHataMesaji();

  const [satirlar, setSatirlar] = useState<RaporSatir[]>([]);
  const [adminMi, setAdminMi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtreEczane, setFiltreEczane] = useState("");
  const [filtreKisi, setFiltreKisi] = useState("");

  const raporCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/eclub/store/rapor/api");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Rapor yüklenemedi.", d.adim, d.detay); return; }
      setSatirlar(d.satirlar ?? []);
      setAdminMi(d.admin === true);
    } catch (err) {
      hata("Rapor yüklenirken hata oluştu.", "raporCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    raporCek();
  }, [kullanici, authYukleniyor, router, raporCek]);

  const handleCikis = async () => { await cikisYap(); router.push("/login"); };

  const filtreli = useMemo(() => {
    return satirlar.filter((s) => {
      const f = (v: string, ara: string) => !ara || v.toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr"));
      return f(s.eczane_adi, filtreEczane) && f(s.ad_soyad, filtreKisi);
    });
  }, [satirlar, filtreEczane, filtreKisi]);

  const toplamKullanilan = useMemo(() => filtreli.reduce((a, s) => a + s.kullanilan_puan, 0), [filtreli]);

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" };
  const thNum: React.CSSProperties = { ...th, textAlign: "right" };
  const td: React.CSSProperties = { padding: "7px 10px", whiteSpace: "nowrap", color: "#111" };
  const tdNum: React.CSSProperties = { ...td, textAlign: "right" };
  const filtreInput: React.CSSProperties = { width: "100%", marginTop: "4px", padding: "3px 6px", fontSize: "11px", border: "0.5px solid #e5e7eb", borderRadius: "4px", outline: "none" };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />

      <div className="max-w-5xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 m-0">E-Club Store — Puan Kullanım Raporu</h1>
          <p className="text-sm text-gray-500 m-0">
            {adminMi ? "Tüm firmaların puan kullanımı (admin görünümü)." : "Firmanızın puanının kullanıldığı siparişler."}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Toplam Kullanılan Puan</span>
          <span className="text-sm font-bold" style={{ color: "#16a34a" }}>{toplamKullanilan}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "760px" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                <th style={th}>Eczane<input value={filtreEczane} onChange={(e) => setFiltreEczane(e.target.value)} placeholder="filtrele" style={filtreInput} /></th>
                <th style={th}>Kişi<input value={filtreKisi} onChange={(e) => setFiltreKisi(e.target.value)} placeholder="filtrele" style={filtreInput} /></th>
                <th style={th}>Ürün</th>
                <th style={thNum}>Sipariş Toplamı</th>
                <th style={thNum}>{adminMi ? "Firma Katkısı" : "Firma Puanınız"}</th>
                <th style={th}>Durum</th>
                <th style={th}>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filtreli.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "24px" }}>Kayıt yok.</td></tr>
              ) : filtreli.map((s, i) => (
                <tr key={i} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                  <td style={td}>{s.eczane_adi}</td>
                  <td style={td}>{s.ad_soyad}</td>
                  <td style={td}>{s.urun_adi}</td>
                  <td style={tdNum}>{s.siparis_toplam}</td>
                  <td style={{ ...tdNum, fontWeight: 600, color: "#16a34a" }}>{s.kullanilan_puan}</td>
                  <td style={td}>{DURUM_ETIKET[s.durum] ?? s.durum}</td>
                  <td style={td}>{s.tarih ? new Date(s.tarih).toLocaleDateString("tr") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}