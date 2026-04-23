// app/hbligi/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

interface LigSatiri {
  sira: number;
  lig_id: string;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  takim: string;
  firma: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  toplam_puan: number;
  guncelleme_tarihi: string;
}

interface Filtreler {
  bolgeler: { bolge_id: string; bolge_adi: string }[];
  takimlar: { takim_id: string; takim_adi: string }[];
  firmalar: { firma_id: string; firma_adi: string }[];
}

export default function HBLigiPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [lig, setLig] = useState<LigSatiri[]>([]);
  const [filtreler, setFiltreler] = useState<Filtreler>({ bolgeler: [], takimlar: [], firmalar: [] });
  const [loading, setLoading] = useState(true);
  const [secilenBolge, setSecilenBolge] = useState("");
  const [secilenTakim, setSecilenTakim] = useState("");
  const [secilenFirma, setSecilenFirma] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      setRol(data.user.user_metadata?.rol ?? "");
    });
  }, []);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const veriCek = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (secilenBolge) params.set("bolge_id", secilenBolge);
    if (secilenTakim) params.set("takim_id", secilenTakim);
    if (secilenFirma) params.set("firma_id", secilenFirma);

    const res = await fetch(`/hbligi/api?${params.toString()}`);
    const data = await res.json();
    setLig(data.lig ?? []);
    setFiltreler(data.filtreler ?? { bolgeler: [], takimlar: [], firmalar: [] });
    setLoading(false);
  };

  useEffect(() => {
    if (user) veriCek();
  }, [user, secilenBolge, secilenTakim, secilenFirma]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const siraRenk = (sira: number) => {
    if (sira === 1) return "#f59e0b";
    if (sira === 2) return "#9ca3af";
    if (sira === 3) return "#b45309";
    return "#e5e7eb";
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Başlık */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: 0 }}>HBLigi</h1>
            {lig.length > 0 && lig[0].guncelleme_tarihi && (
              <p style={{ fontSize: "11px", color: "#9ca3af", margin: "4px 0 0" }}>Son güncelleme: {formatTarih(lig[0].guncelleme_tarihi)}</p>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "#737373" }}>{lig.length} kişi</span>
        </div>

        {/* Filtreler */}
        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "14px 20px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#737373" }}>Firma</label>
            <select value={secilenFirma} onChange={(e) => { setSecilenFirma(e.target.value); setSecilenTakim(""); setSecilenBolge(""); }} style={{ border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", minWidth: "140px" }}>
              <option value="">Tümü</option>
              {filtreler.firmalar.map(f => <option key={f.firma_id} value={f.firma_id}>{f.firma_adi}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#737373" }}>Takım</label>
            <select value={secilenTakim} onChange={(e) => { setSecilenTakim(e.target.value); setSecilenBolge(""); }} style={{ border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", minWidth: "140px" }}>
              <option value="">Tümü</option>
              {filtreler.takimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#737373" }}>Bölge</label>
            <select value={secilenBolge} onChange={(e) => setSecilenBolge(e.target.value)} style={{ border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", minWidth: "140px" }}>
              <option value="">Tümü</option>
              {filtreler.bolgeler.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
            </select>
          </div>
          {(secilenBolge || secilenTakim || secilenFirma) && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={() => { setSecilenBolge(""); setSecilenTakim(""); setSecilenFirma(""); }} style={{ padding: "6px 12px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "11px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                Filtreyi Temizle
              </button>
            </div>
          )}
        </div>

        {/* Lig tablosu */}
        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          {lig.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Henüz lig verisi bulunmuyor.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #e5e7eb", background: "#fafafa" }}>
                  <th style={{ textAlign: "center", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", width: "40px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Ad Soyad</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Bölge</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Takım</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>İzleme</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Cevap</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Öneri</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Extra</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {lig.map((l) => (
                  <tr key={l.lig_id} style={{ borderBottom: "0.5px solid #f3f4f6", background: l.kullanici_id === user?.id ? "#f0f9ff" : "white" }}>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: siraRenk(l.sira), display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: l.sira <= 3 ? "white" : "#737373" }}>{l.sira}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px", color: "#111", fontWeight: l.kullanici_id === user?.id ? 700 : 500 }}>
                      {l.ad}
                      {l.kullanici_id === user?.id && <span style={{ fontSize: "10px", color: "#56aeff", marginLeft: "6px" }}>sen</span>}
                    </td>
                    <td style={{ padding: "12px", color: "#737373" }}>{l.bolge}</td>
                    <td style={{ padding: "12px", color: "#737373" }}>{l.takim}</td>
                    <td style={{ padding: "12px 8px", textAlign: "center", color: "#374151" }}>{l.izleme_puani}</td>
                    <td style={{ padding: "12px 8px", textAlign: "center", color: "#374151" }}>{l.cevaplama_puani}</td>
                    <td style={{ padding: "12px 8px", textAlign: "center", color: "#374151" }}>{l.oneri_puani}</td>
                    <td style={{ padding: "12px 8px", textAlign: "center", color: "#374151" }}>{l.extra_puani}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#56aeff" }}>{l.toplam_puan}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}