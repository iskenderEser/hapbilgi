// app/store/siparisler/_components/SiparisFiltreleri.tsx
//
// Rol bazlı hiyerarşik filtre dropdown'ları + durum + tarih aralığı.
// Saf UI — useSiparisListe ve useHiyerarsi hook'larının return değerlerini prop alır.
//
// Görünüm rol bazlı:
//   - BM: kullanıcı + durum + tarih
//   - TM: bölge → kullanıcı + durum + tarih
//   - üretici/yönetici: takım → bölge → kullanıcı + durum + tarih
//   - admin: firma → takım → bölge → kullanıcı + durum + tarih

"use client";

import type {
  Filtreler,
  Hiyerarsi,
  HiyerarsiTakim,
  HiyerarsiBolge,
  HiyerarsiKullanici,
} from "../_types";
import { DURUM_ETIKETLERI } from "@/lib/store/sabitler";

interface SiparisFiltreleriProps {
  hiyerarsi: Hiyerarsi | null;
  filtreler: Filtreler;
  filtreDegistir: (alan: keyof Filtreler, deger: string) => void;
  filtreleriSifirla: () => void;
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "0.5px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "12px",
  background: "white",
  color: "#374151",
  fontFamily: "'Nunito', sans-serif",
  cursor: "pointer",
  minWidth: "140px",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "0.5px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "12px",
  background: "white",
  color: "#374151",
  fontFamily: "'Nunito', sans-serif",
  minWidth: "140px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "#737373",
  display: "block",
  marginBottom: "4px",
  fontFamily: "'Nunito', sans-serif",
};

export default function SiparisFiltreleri(p: SiparisFiltreleriProps) {
  if (!p.hiyerarsi) return null;

  const h = p.hiyerarsi;
  const rol = h.rol;

  // ─── Görüntülenecek listeleri rol bazlı hesapla ────────────────────────────

  // FİRMA listesi (admin için)
  const firmalar = h.firmalar ?? [];

  // TAKIM listesi
  let takimlar: HiyerarsiTakim[] = [];
  if (rol === "admin") {
    const seciliFirma = firmalar.find((f) => f.firma_id === p.filtreler.firma_id);
    takimlar = seciliFirma?.takimlar ?? [];
  } else if (h.takimlar) {
    takimlar = h.takimlar;
  }

  // BÖLGE listesi
  let bolgeler: HiyerarsiBolge[] = [];
  if (rol === "tm" && h.bolgeler) {
    bolgeler = h.bolgeler;
  } else if (p.filtreler.takim_id) {
    const seciliTakim = takimlar.find((t) => t.takim_id === p.filtreler.takim_id);
    bolgeler = seciliTakim?.bolgeler ?? [];
  }

  // KULLANICI listesi
  let kullanicilar: HiyerarsiKullanici[] = [];
  if (rol === "bm" && h.kullanicilar) {
    kullanicilar = h.kullanicilar;
  } else if (p.filtreler.bolge_id) {
    const seciliBolge = bolgeler.find((b) => b.bolge_id === p.filtreler.bolge_id);
    kullanicilar = seciliBolge?.kullanicilar ?? [];
  }

  // ─── Aktif filtre var mı? ──────────────────────────────────────────────────

  const aktifFiltreVar =
    !!p.filtreler.firma_id ||
    !!p.filtreler.takim_id ||
    !!p.filtreler.bolge_id ||
    !!p.filtreler.kullanici_id ||
    !!p.filtreler.durum ||
    !!p.filtreler.tarih_baslangic ||
    !!p.filtreler.tarih_bitis;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: "#f9fafb",
        border: "0.5px solid #e5e7eb",
        borderRadius: "8px",
        padding: "12px",
        marginBottom: "16px",
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "flex-end",
      }}
    >
      {/* FİRMA — sadece admin */}
      {rol === "admin" && (
        <div>
          <label style={labelStyle}>Firma</label>
          <select
            value={p.filtreler.firma_id}
            onChange={(e) => p.filtreDegistir("firma_id", e.target.value)}
            style={selectStyle}
          >
            <option value="">Tümü</option>
            {firmalar.map((f) => (
              <option key={f.firma_id} value={f.firma_id}>
                {f.firma_adi}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* TAKIM — TM hariç (TM kendi takımında zaten) */}
      {(rol === "admin" || rol === "pm" || rol === "jr_pm" || rol === "kd_pm" ||
        rol === "med_md" || rol === "egt_md" || rol === "egt_uzm" || rol === "egt_uzm_jr" ||
        rol === "ik_md" || rol === "ik_uzm" || rol === "ik_uzm_jr" ||
        rol === "gm" || rol === "gm_yrd" || rol === "drk" || rol === "paz_md" ||
        rol === "blm_md" || rol === "grp_pm" || rol === "sm") && (
        <div>
          <label style={labelStyle}>Takım</label>
          <select
            value={p.filtreler.takim_id}
            onChange={(e) => p.filtreDegistir("takim_id", e.target.value)}
            style={selectStyle}
            disabled={rol === "admin" && !p.filtreler.firma_id}
          >
            <option value="">Tümü</option>
            {takimlar.map((t) => (
              <option key={t.takim_id} value={t.takim_id}>
                {t.takim_adi}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* BÖLGE — BM hariç */}
      {rol !== "bm" && (
        <div>
          <label style={labelStyle}>Bölge</label>
          <select
            value={p.filtreler.bolge_id}
            onChange={(e) => p.filtreDegistir("bolge_id", e.target.value)}
            style={selectStyle}
            disabled={rol !== "tm" && !p.filtreler.takim_id}
          >
            <option value="">Tümü</option>
            {bolgeler.map((b) => (
              <option key={b.bolge_id} value={b.bolge_id}>
                {b.bolge_adi}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* KULLANICI */}
      <div>
        <label style={labelStyle}>Kullanıcı</label>
        <select
          value={p.filtreler.kullanici_id}
          onChange={(e) => p.filtreDegistir("kullanici_id", e.target.value)}
          style={selectStyle}
          disabled={rol !== "bm" && !p.filtreler.bolge_id}
        >
          <option value="">Tümü</option>
          {kullanicilar.map((k) => (
            <option key={k.kullanici_id} value={k.kullanici_id}>
              {k.ad} {k.soyad} ({k.rol})
            </option>
          ))}
        </select>
      </div>

      {/* DURUM */}
      <div>
        <label style={labelStyle}>Durum</label>
        <select
          value={p.filtreler.durum}
          onChange={(e) => p.filtreDegistir("durum", e.target.value)}
          style={selectStyle}
        >
          <option value="">Tümü</option>
          {Object.entries(DURUM_ETIKETLERI).map(([deger, etiket]) => (
            <option key={deger} value={deger}>
              {etiket}
            </option>
          ))}
        </select>
      </div>

      {/* TARİH ARALIĞI */}
      <div>
        <label style={labelStyle}>Tarih başlangıç</label>
        <input
          type="date"
          value={p.filtreler.tarih_baslangic}
          onChange={(e) => p.filtreDegistir("tarih_baslangic", e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Tarih bitiş</label>
        <input
          type="date"
          value={p.filtreler.tarih_bitis}
          onChange={(e) => p.filtreDegistir("tarih_bitis", e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* TEMİZLE */}
      {aktifFiltreVar && (
        <button
          onClick={p.filtreleriSifirla}
          style={{
            padding: "6px 12px",
            background: "white",
            border: "0.5px solid #e5e7eb",
            borderRadius: "6px",
            fontSize: "11px",
            color: "#737373",
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          Filtreyi Temizle
        </button>
      )}
    </div>
  );
}