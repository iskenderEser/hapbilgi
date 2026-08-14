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
import { STORE_GENEL_GOREN_ROLLER } from "@/lib/utils/roller";

interface SiparisFiltreleriProps {
  hiyerarsi: Hiyerarsi | null;
  filtreler: Filtreler;
  filtreDegistir: (alan: keyof Filtreler, deger: string) => void;
  filtreleriSifirla: () => void;
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #dfe7f1",
  borderRadius: "10px",
  fontSize: "12px",
  background: "white",
  color: "#374151",
  fontFamily: "'Nunito', sans-serif",
  cursor: "pointer",
  minWidth: 0,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #dfe7f1",
  borderRadius: "10px",
  fontSize: "12px",
  background: "white",
  color: "#374151",
  fontFamily: "'Nunito', sans-serif",
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "#71859d",
  display: "block",
  marginBottom: "4px",
  fontFamily: "'Nunito', sans-serif",
};

export default function SiparisFiltreleri(p: SiparisFiltreleriProps) {
  if (!p.hiyerarsi) return null;

  const h = p.hiyerarsi;
  const rol = h.rol;

  // TAKIM filtresini gören roller: firma genelini görenler (STORE_GENEL_GOREN_ROLLER)
  // eksi yönlendiriciler — bm yalnız kullanıcı listesini, tm zaten kendi takımında.
  // Tek kaynak roller.ts; blok eskiden elle yazılıydı ve dört rol hatalı kodla (egt_uzm/
  // ik_uzm) yazıldığından gerçek egt_uz/egt_yon/egt_yrd_md/ik_* rolleri filtreyi göremiyordu.
  const takimFiltresiGoren =
    STORE_GENEL_GOREN_ROLLER.includes(rol) && rol !== "bm" && rol !== "tm";

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
    <section className="mb-4 rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-[#203653]">Filtreler</h2>
          <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">Listeyi ekip, durum veya sipariş tarihine göre daraltın.</p>
        </div>
        {aktifFiltreVar && (
          <button
            onClick={p.filtreleriSifirla}
            className="rounded-lg border border-[#dfe7f1] bg-white px-3 py-1.5 text-[11px] font-bold text-[#61748b] transition-colors hover:bg-[#f6f9fc]"
          >
            Filtreleri Temizle
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {/* FİRMA — sadece admin */}
      {rol === "admin" && (
        <div className="min-w-0">
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

      {/* TAKIM — TM hariç (TM kendi takımında zaten), BM hariç (yalnız kullanıcı) */}
      {takimFiltresiGoren && (
        <div className="min-w-0">
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
        <div className="min-w-0">
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
      <div className="min-w-0">
        <label style={labelStyle}>{rol === "bm" ? "UTT / KD_UTT" : "Kullanıcı"}</label>
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
      <div className="min-w-0">
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
      <div className="min-w-0">
        <label style={labelStyle}>Tarih başlangıç</label>
        <input
          type="date"
          value={p.filtreler.tarih_baslangic}
          onChange={(e) => p.filtreDegistir("tarih_baslangic", e.target.value)}
          style={inputStyle}
        />
      </div>
      <div className="min-w-0">
        <label style={labelStyle}>Tarih bitiş</label>
        <input
          type="date"
          value={p.filtreler.tarih_bitis}
          onChange={(e) => p.filtreDegistir("tarih_bitis", e.target.value)}
          style={inputStyle}
        />
      </div>

      </div>
    </section>
  );
}
