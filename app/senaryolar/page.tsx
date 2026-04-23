// app/senaryolar/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface SenaryoSatir {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  son_durum: string | null;
  son_tarih: string;
}

type FiltreDurum = "Inceleme Bekleniyor" | "Onaylandi" | "Iptal Edildi";

export default function SenaryolarListePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [satirlar, setSatirlar] = useState<SenaryoSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreler, setFiltreler] = useState<Set<FiltreDurum>>(new Set());
  const { mesajlar, hata } = useHataMesaji();

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
    const supabase = createClient();

    const { data: talepler, error: talepError } = await supabase
      .from("talepler")
      .select(`
        talep_id,
        urunler(urun_adi),
        teknikler(teknik_adi)
      `)
      .order("created_at", { ascending: false });

    if (talepError) {
      hata("Talepler yüklenemedi.", "talepler tablosu SELECT", talepError.message);
      setLoading(false);
      return;
    }

    const sonuc = await Promise.all(
      (talepler ?? []).map(async (t: any) => {
        const { data: senaryolar } = await supabase
          .from("senaryolar")
          .select("senaryo_id, created_at")
          .eq("talep_id", t.talep_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const sonSenaryo = senaryolar?.[0];
        if (!sonSenaryo) return null;

        const { data: durumlar } = await supabase
          .from("senaryo_durumu")
          .select("durum, created_at")
          .eq("senaryo_id", sonSenaryo.senaryo_id)
          .order("created_at", { ascending: false })
          .limit(1);

        return {
          talep_id: t.talep_id,
          urun_adi: t.urunler?.urun_adi ?? "-",
          teknik_adi: t.teknikler?.teknik_adi ?? "-",
          son_durum: durumlar?.[0]?.durum ?? null,
          son_tarih: durumlar?.[0]?.created_at ?? sonSenaryo.created_at,
        };
      })
    );

    setSatirlar(sonuc.filter(Boolean) as SenaryoSatir[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) veriCek();
  }, [user]);

  const toggleFiltre = (durum: FiltreDurum) => {
    setFiltreler(prev => {
      const yeni = new Set(prev);
      if (yeni.has(durum)) { yeni.delete(durum); }
      else { yeni.add(durum); }
      return yeni;
    });
  };

  const filtreliSatirlar = filtreler.size === 0
    ? satirlar
    : satirlar.filter(s => s.son_durum && filtreler.has(s.son_durum as FiltreDurum));

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const durumRenk = (durum: string) => {
    switch (durum) {
      case "Onaylandi": return { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
      case "Iptal Edildi": return { bg: "#fef2f2", text: "#bc2d0d", border: "#fecaca" };
      case "Revizyon Bekleniyor": return { bg: "#fefce8", text: "#854d0e", border: "#fde68a" };
      case "Inceleme Bekleniyor": return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
      default: return { bg: "#f9fafb", text: "#737373", border: "#e5e7eb" };
    }
  };

  const filtreSec: { durum: FiltreDurum; etiket: string }[] = [
    { durum: "Inceleme Bekleniyor", etiket: "İnceleme Bekleyenler" },
    { durum: "Onaylandi", etiket: "Onaylananlar" },
    { durum: "Iptal Edildi", etiket: "İptal Edilenler" },
  ];

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

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>Senaryolar</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {filtreSec.map(f => (
                  <label key={f.durum} style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", color: filtreler.has(f.durum) ? "#111" : "#737373", fontWeight: filtreler.has(f.durum) ? 600 : 400 }}>
                    <input
                      type="checkbox"
                      checked={filtreler.has(f.durum)}
                      onChange={() => toggleFiltre(f.durum)}
                      style={{ accentColor: "#bc2d0d", width: "13px", height: "13px", cursor: "pointer" }}
                    />
                    {f.etiket}
                  </label>
                ))}
              </div>
            </div>
            <span style={{ fontSize: "12px", color: "#737373" }}>{filtreliSatirlar.length} kayıt</span>
          </div>

          {filtreliSatirlar.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
              {filtreler.size > 0 ? "Seçilen filtreye uygun senaryo bulunamadı." : "Henüz senaryo bulunmuyor."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #e5e7eb", background: "#fafafa" }}>
                  <th style={{ textAlign: "left", padding: "10px 20px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Ürün</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Teknik</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Son Durum</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Tarih</th>
                  <th style={{ padding: "10px 20px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtreliSatirlar.map((s) => {
                  const renk = durumRenk(s.son_durum ?? "");
                  return (
                    <tr key={s.talep_id} onClick={() => router.push(`/senaryolar/${s.talep_id}`)} style={{ borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                      <td style={{ padding: "12px 20px", color: "#111", fontWeight: 500 }}>{s.urun_adi}</td>
                      <td style={{ padding: "12px", color: "#737373" }}>{s.teknik_adi}</td>
                      <td style={{ padding: "12px" }}>
                        {s.son_durum && (
                          <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "20px", background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                            {s.son_durum}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px", color: "#737373", fontSize: "12px" }}>{formatTarih(s.son_tarih)}</td>
                      <td style={{ padding: "12px 20px" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="16" height="16"><path d="M9 5l7 7-7 7"/></svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}