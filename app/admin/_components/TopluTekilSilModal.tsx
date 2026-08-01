// app/admin/_components/TopluTekilSilModal.tsx
//
// Toplu/Tekil Silme — Aşama 4 (docs/toplu_tekil_silme_is_plani.md).
// Navbar "Toplu/Tekil Sil" butonunun modalı. İki mod:
//   Toplu → Tüm Veriler (tüm firmalar)   → mod='tum'
//   Tekil → talep_id ile                 → mod='tekil'
// (Firma silme burada DEĞİL — o firma kartında, Aşama 5.)
// Akış: tip seç → (tekil: talep_id) → Önizle (sayım) → son onay → Sil.
// API: POST /admin/api/veri-sil  { islem:'sayim'|'sil', mod, talep_id? }

"use client";

import { useState } from "react";
import { RENK_BORDO } from "../_constants";

interface Props {
  acik: boolean;
  onKapat: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

type Tip = "tum" | "tekil";

interface Onizleme {
  yayin: number; izleme: number; puan_kaydi: number; oneri: number; challenge: number;
  gonderim: number; push: number; bildirim: number; siparis_silinecek: number; siparis_korunacak: number;
}

const ONAY_KELIMESI = "TÜM VERİLER";

const SATIRLAR: [keyof Onizleme, string][] = [
  ["yayin", "Kapsamdaki yayın"],
  ["izleme", "İzleme kaydı"],
  ["puan_kaydi", "Puan/kayıp kaydı"],
  ["oneri", "Öneri"],
  ["challenge", "Challenge"],
  ["gonderim", "Eczanem gönderim"],
  ["push", "Push kaydı"],
  ["bildirim", "Bildirim"],
  ["siparis_silinecek", "Silinecek sipariş"],
];

export default function TopluTekilSilModal({ acik, onKapat, hata, basari }: Props) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [talepId, setTalepId] = useState("");
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [onayMetni, setOnayMetni] = useState("");
  const [loading, setLoading] = useState(false);

  if (!acik) return null;

  const sifirla = () => { setTip(null); setTalepId(""); setOnizleme(null); setOnayMetni(""); };
  const kapat = () => { sifirla(); onKapat(); };

  const govde = (islem: "sayim" | "sil") =>
    tip === "tum"
      ? { islem, mod: "tum" }
      : { islem, mod: "tekil", talep_id: talepId.trim() };

  const cagir = async (islem: "sayim" | "sil") => {
    const res = await fetch("/admin/api/veri-sil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde(islem)),
    });
    const d = await res.json();
    if (!res.ok) throw { d };
    return d;
  };

  const onizle = async () => {
    setLoading(true); setOnizleme(null); setOnayMetni("");
    try {
      setOnizleme(await cagir("sayim"));
    } catch (e) {
      const d = (e as { d?: { hata?: string; adim?: string; detay?: string } }).d;
      hata(d?.hata ?? "Önizleme alınamadı.", d?.adim, d?.detay);
    } finally { setLoading(false); }
  };

  const sil = async () => {
    setLoading(true);
    try {
      const d = await cagir("sil");
      basari(`Silme tamamlandı — yayın: ${d.yayin_sayisi ?? 0}, sipariş: ${d.silinen_siparis ?? 0}.`);
      kapat();
    } catch (e) {
      const d = (e as { d?: { hata?: string; adim?: string; detay?: string } }).d;
      hata(d?.hata ?? "Silme başarısız.", d?.adim, d?.detay);
    } finally { setLoading(false); }
  };

  const tekilGecerli = tip === "tekil" ? talepId.trim().length > 0 : true;
  const onayGecerli = tip === "tum" ? onayMetni.trim() === ONAY_KELIMESI : true;
  const silAktif = !!onizleme && tekilGecerli && onayGecerli && !loading;

  const kutu = (arkaplan: string): React.CSSProperties => ({
    padding: "10px 14px", borderRadius: "8px", background: arkaplan,
    border: "1px solid #e5e5e5", fontSize: "13px", cursor: "pointer", textAlign: "left",
    fontFamily: "'Nunito', sans-serif",
  });

  return (
    <div
      onClick={kapat}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "460px", maxHeight: "90vh", overflow: "auto",
          background: "white", borderRadius: "12px", padding: "20px",
          fontFamily: "'Nunito', sans-serif", boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{ fontSize: "15px", fontWeight: 800, color: "#111" }}>Toplu / Tekil Sil</span>
          <button onClick={kapat} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#737373" }}>×</button>
        </div>

        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 12px", marginBottom: "14px" }}>
          <span style={{ fontSize: "12px", color: RENK_BORDO }}>
            Yalnız test ortamı. Üretilen veri silinir; kimlik, ürün içeriği ve bitmiş siparişler korunur. <b>Geri alınamaz.</b>
          </span>
        </div>

        {/* 1) Tip seçimi */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
          <button onClick={() => { setTip("tum"); setOnizleme(null); setOnayMetni(""); }}
            style={{ ...kutu(tip === "tum" ? "#fef2f2" : "#fafafa"), borderColor: tip === "tum" ? "#fca5a5" : "#e5e5e5" }}>
            <b>Tüm Veriler</b> — tüm firmaların üretilen verisi
          </button>
          <button onClick={() => { setTip("tekil"); setOnizleme(null); }}
            style={{ ...kutu(tip === "tekil" ? "#eff6ff" : "#fafafa"), borderColor: tip === "tekil" ? "#93c5fd" : "#e5e5e5" }}>
            <b>Tek Talep</b> — talep_id ile
          </button>
        </div>

        {/* 2) Tekil: talep_id */}
        {tip === "tekil" && (
          <input
            value={talepId}
            onChange={(e) => { setTalepId(e.target.value); setOnizleme(null); }}
            placeholder="talep_id (UUID)"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: "13px", border: "1px solid #e5e5e5", borderRadius: "8px", marginBottom: "12px", fontFamily: "'Nunito', sans-serif" }}
          />
        )}

        {/* 3) Önizle */}
        {tip && (
          <button onClick={onizle} disabled={loading || !tekilGecerli}
            style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #d4d4d4", background: "white", fontSize: "13px", fontWeight: 700, color: "#111", cursor: loading || !tekilGecerli ? "not-allowed" : "pointer", opacity: loading || !tekilGecerli ? 0.5 : 1, marginBottom: "14px", fontFamily: "'Nunito', sans-serif" }}>
            {loading ? "…" : "Önizle (kaç kayıt?)"}
          </button>
        )}

        {/* 4) Önizleme sonucu + son onay + Sil */}
        {onizleme && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "4px", columnGap: "10px", fontSize: "12.5px", marginBottom: "10px" }}>
              {SATIRLAR.map(([k, etiket]) => (
                <div key={k} style={{ display: "contents" }}>
                  <span style={{ color: "#525252" }}>{etiket}</span>
                  <span style={{ textAlign: "right", fontWeight: 700, color: "#111" }}>{onizleme[k]}</span>
                </div>
              ))}
              <span style={{ color: "#16a34a" }}>Korunacak sipariş</span>
              <span style={{ textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{onizleme.siparis_korunacak}</span>
            </div>

            {tip === "tum" && (
              <input
                value={onayMetni}
                onChange={(e) => setOnayMetni(e.target.value)}
                placeholder={`Onay için "${ONAY_KELIMESI}" yazın`}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: "13px", border: "1px solid #fca5a5", borderRadius: "8px", marginBottom: "10px", fontFamily: "'Nunito', sans-serif" }}
              />
            )}

            <button onClick={sil} disabled={!silAktif}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: RENK_BORDO, color: "white", fontSize: "13px", fontWeight: 800, cursor: silAktif ? "pointer" : "not-allowed", opacity: silAktif ? 1 : 0.5, fontFamily: "'Nunito', sans-serif" }}>
              {loading ? "Siliniyor…" : "Kalıcı olarak sil"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
