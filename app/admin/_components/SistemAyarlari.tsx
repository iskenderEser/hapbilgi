// app/admin/_components/SistemAyarlari.tsx
//
// Sistem Ayarları paneli — sistem_ayarlari tablosunun admin ekranı.
// Üst bardaki "Sistem Ayarları" butonuyla açılır (firma görünümünün alternatifi).
// Her satır: anahtar + açıklama + değer alanı + Kaydet.
// deger jsonb: sayı ya da sayı dizisi (dizi, virgülle ayrılmış metin olarak düzenlenir).

"use client";

import { useEffect, useState } from "react";
import type { SistemAyari } from "../_types";
import { RENK_BORDO, RENK_BORDO_KENAR, RENK_BORDO_ZEMIN } from "../_constants";
import {
  ECLUB_GONDERI_AYARLARI,
  ECLUB_GONDERI_AYAR_ANAHTARLARI,
  eclubGonderiAyariMi,
} from "@/lib/eclub/gonderiAyarlari";

interface SistemAyarlariProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function SistemAyarlari({ hata, basari }: SistemAyarlariProps) {
  const [ayarlar, setAyarlar] = useState<SistemAyari[]>([]);
  const [duzenlenen, setDuzenlenen] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [kaydeden, setKaydeden] = useState<string | null>(null);
  const [mesaiBypass, setMesaiBypass] = useState<boolean | null>(null);
  const [bypassKaydediliyor, setBypassKaydediliyor] = useState(false);

  const degerMetni = (deger: number | number[]): string =>
    Array.isArray(deger) ? deger.join(", ") : String(deger);

  const veriCek = async () => {
    setLoading(true);
    const res = await fetch("/admin/api/sistem-ayarlari");
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Ayarlar yüklenemedi.", d.adim, d.detay);
    } else {
      const gelen: SistemAyari[] = d.ayarlar ?? [];
      setAyarlar(gelen);
      const metinler: Record<string, string> = {};
      for (const a of gelen) metinler[a.anahtar] = degerMetni(a.deger);
      setDuzenlenen(metinler);
    }
    setLoading(false);
  };

  // İlk yükleme yalnızca bileşen açıldığında yapılır; veriCek kaydetme sonrasında da kullanılır.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void veriCek(); }, []);

  // Mesai bypass düğmesinin mevcut durumu (test aracı).
  useEffect(() => {
    void (async () => {
      const res = await fetch("/admin/api/mesai-bypass");
      const d = await res.json();
      if (res.ok) setMesaiBypass(d.aktif === true);
    })();
  }, []);

  const handleMesaiBypassToggle = async () => {
    const yeni = !(mesaiBypass ?? false);
    setBypassKaydediliyor(true);
    const res = await fetch("/admin/api/mesai-bypass", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif: yeni }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Mesai bypass güncellenemedi.", d.adim, d.detay);
    } else {
      setMesaiBypass(yeni);
      basari(yeni ? "Mesai bypass AÇILDI (test modu)." : "Mesai bypass KAPATILDI (gerçek kural).");
    }
    setBypassKaydediliyor(false);
  };

  // Metni deger'e çevirir: mevcut değer dizi ise virgüllü sayı dizisi, değilse tek sayı.
  const metniDegereCevir = (ayar: SistemAyari, metin: string): number | number[] | null => {
    if (Array.isArray(ayar.deger)) {
      const parcalar = metin.split(",").map((p) => Number(p.trim()));
      if (parcalar.length === 0 || parcalar.some((p) => !Number.isFinite(p) || p <= 0)) return null;
      return parcalar;
    }
    const sayi = Number(metin.trim());
    if (!Number.isFinite(sayi) || sayi <= 0) return null;
    if (eclubGonderiAyariMi(ayar.anahtar) && !Number.isInteger(sayi)) return null;
    return sayi;
  };

  const handleKaydet = async (ayar: SistemAyari) => {
    const metin = duzenlenen[ayar.anahtar] ?? "";
    const deger = metniDegereCevir(ayar, metin);
    if (deger === null) {
      hata(`${ayar.anahtar}: değer pozitif sayı${Array.isArray(ayar.deger) ? "lar (virgülle ayrılmış)" : ""} olmalıdır.`);
      return;
    }

    setKaydeden(ayar.anahtar);
    const res = await fetch("/admin/api/sistem-ayarlari", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anahtar: ayar.anahtar, deger }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Ayar güncellenemedi.", d.adim, d.detay);
    } else {
      const eclubTanimi = ECLUB_GONDERI_AYARLARI.find((tanim) => tanim.anahtar === ayar.anahtar);
      basari(`${eclubTanimi?.baslik ?? ayar.anahtar} güncellendi.`);
      await veriCek();
    }
    setKaydeden(null);
  };

  if (loading) {
    return <p style={{ fontSize: "13px", color: "#737373" }}>Ayarlar yükleniyor…</p>;
  }

  const eclubAyarlar = ECLUB_GONDERI_AYARLARI
    .map((tanim) => ({ tanim, ayar: ayarlar.find((ayar) => ayar.anahtar === tanim.anahtar) }))
    .filter((satir): satir is { tanim: typeof ECLUB_GONDERI_AYARLARI[number]; ayar: SistemAyari } => !!satir.ayar);
  const genelAyarlar = ayarlar.filter((ayar) => !ECLUB_GONDERI_AYAR_ANAHTARLARI.has(ayar.anahtar));

  return (
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "4px" }}>
        Sistem Ayarları
      </h2>
      <p style={{ fontSize: "12px", color: "#737373", marginBottom: "16px" }}>
        Değerler tüm firmalara aynı uygulanır. Yeni ayar eklemek migration işidir; buradan yalnızca mevcut değerler güncellenir.
      </p>

      {/* Test aracı — Mesai bypass düğmesi (production'da dinlenmez) */}
      <section
        style={{
          maxWidth: 980,
          marginBottom: "24px",
          padding: "16px",
          border: "0.5px solid #fde68a",
          borderRadius: "12px",
          background: "#fffbeb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#111" }}>
              Test: Mesai kuralını atla
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: 1.5, color: "#737373" }}>
              Açıkken mesai günü/saati kuralı atlanır — izleme her zaman kayıt olur, puan ve sorular çalışır.
              Kapalıyken gerçek kural işler (mesai dışı → kayıt yok, bilgilendirme modalı). Yalnız test/geliştirme içindir; canlıda etkisizdir.
            </p>
          </div>
          <button
            onClick={handleMesaiBypassToggle}
            disabled={mesaiBypass === null || bypassKaydediliyor}
            aria-pressed={mesaiBypass === true}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              border: "none",
              borderRadius: "999px",
              fontSize: "13px",
              fontWeight: 800,
              cursor: mesaiBypass === null || bypassKaydediliyor ? "not-allowed" : "pointer",
              background: mesaiBypass ? "#16a34a" : "#e5e7eb",
              color: mesaiBypass ? "white" : "#6b7280",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "999px",
                background: mesaiBypass ? "white" : "#9ca3af",
              }}
            />
            {mesaiBypass === null ? "..." : bypassKaydediliyor ? "..." : mesaiBypass ? "AÇIK" : "KAPALI"}
          </button>
        </div>
      </section>

      <section
        style={{
          maxWidth: 980,
          marginBottom: "24px",
          padding: "16px",
          border: `0.5px solid ${RENK_BORDO_KENAR}`,
          borderRadius: "12px",
          background: RENK_BORDO_ZEMIN,
        }}
      >
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#111" }}>
          E-Club Video Gönderim Ayarları
        </h3>
        <p style={{ margin: "4px 0 14px", fontSize: "12px", color: "#737373" }}>
          Öneri izleme süresi ve aynı videonun aynı kişiye tekrar gönderim süresi tüm firmalar için buradan yönetilir.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "10px" }}>
          {eclubAyarlar.map(({ tanim, ayar }) => {
            const degisti = degerMetni(ayar.deger) !== (duzenlenen[ayar.anahtar] ?? "");
            const kaydediliyor = kaydeden === ayar.anahtar;
            return (
              <div
                key={ayar.anahtar}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "154px",
                  padding: "13px",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: "10px",
                  background: "#fff",
                }}
              >
                <label htmlFor={`ayar-${ayar.anahtar}`} style={{ fontSize: "13px", fontWeight: 800, color: "#111" }}>
                  {tanim.baslik}
                </label>
                <p style={{ flex: 1, margin: "4px 0 12px", fontSize: "11px", lineHeight: 1.45, color: "#737373" }}>
                  {tanim.aciklama}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ display: "flex", flex: 1, alignItems: "center", overflow: "hidden", border: "0.5px solid #d1d5db", borderRadius: "7px", background: "#fff" }}>
                    <input
                      id={`ayar-${ayar.anahtar}`}
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={duzenlenen[ayar.anahtar] ?? ""}
                      onChange={(e) => setDuzenlenen((prev) => ({ ...prev, [ayar.anahtar]: e.target.value }))}
                      style={{ minWidth: 0, width: "100%", border: "none", outline: "none", padding: "7px 9px", fontSize: "13px", fontWeight: 700, color: "#111", fontFamily: "'Nunito', sans-serif" }}
                    />
                    <span style={{ padding: "0 9px", fontSize: "11px", color: "#737373", borderLeft: "0.5px solid #e5e7eb" }}>
                      {tanim.birim}
                    </span>
                  </div>
                  <button
                    onClick={() => handleKaydet(ayar)}
                    disabled={kaydediliyor || !degisti}
                    style={{
                      padding: "7px 12px",
                      border: "none",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: degisti ? RENK_BORDO : "#f3f4f6",
                      color: degisti ? "white" : "#9ca3af",
                      cursor: degisti ? "pointer" : "not-allowed",
                      fontFamily: "'Nunito', sans-serif",
                    }}
                  >
                    {kaydediliyor ? "..." : "Kaydet"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", maxWidth: 860 }}>
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 180px 90px", gap: "0", background: "#f9fafb", padding: "10px 14px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>
          <span>Anahtar</span>
          <span>Açıklama</span>
          <span>Değer</span>
          <span></span>
        </div>
        {genelAyarlar.map((a) => (
          <div key={a.anahtar}
            style={{ display: "grid", gridTemplateColumns: "240px 1fr 180px 90px", alignItems: "center", padding: "10px 14px", borderTop: "0.5px solid #e5e7eb", fontSize: "12px" }}>
            <span style={{ fontWeight: 700, color: "#111", wordBreak: "break-all" }}>{a.anahtar}</span>
            <span style={{ color: "#737373", paddingRight: "12px" }}>{a.aciklama ?? "-"}</span>
            <input
              value={duzenlenen[a.anahtar] ?? ""}
              onChange={(e) => setDuzenlenen((prev) => ({ ...prev, [a.anahtar]: e.target.value }))}
              style={{
                border: "0.5px solid #d1d5db", borderRadius: "6px", padding: "6px 8px",
                fontSize: "12px", color: "#111", fontFamily: "'Nunito', sans-serif", width: "150px",
              }}
            />
            <button
              onClick={() => handleKaydet(a)}
              disabled={kaydeden === a.anahtar || degerMetni(a.deger) === (duzenlenen[a.anahtar] ?? "")}
              style={{
                padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                background: degerMetni(a.deger) === (duzenlenen[a.anahtar] ?? "") ? "#f3f4f6" : RENK_BORDO,
                color: degerMetni(a.deger) === (duzenlenen[a.anahtar] ?? "") ? "#9ca3af" : "white",
                cursor: degerMetni(a.deger) === (duzenlenen[a.anahtar] ?? "") ? "not-allowed" : "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {kaydeden === a.anahtar ? "..." : "Kaydet"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
