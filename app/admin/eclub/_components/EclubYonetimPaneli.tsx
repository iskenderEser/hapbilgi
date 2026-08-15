// app/admin/eclub/_components/EclubYonetimPaneli.tsx
//
// M2-b — E-Club yönetim içeriği (onay bekleyen eczaneler + kayıtlı
// firma/eczane/kişi). Eski /admin/eclub sayfasının kabuksuz hâli: auth,
// Navbar ve hata konteyneri ANA panelin işidir; bu bileşen yalnız içeriktir
// ve ana paneldeki E-Club sekmesine gömülür (plan B.2).

"use client";

import { useState } from "react";
import { useEclubOnaylar } from "../_hooks/useEclubOnaylar";
import { useEclubKayitli } from "../_hooks/useEclubKayitli";
import { useEclubTestEczaneler } from "../_hooks/useEclubTestEczaneler";
import { useEclubTestTemizlik } from "../_hooks/useEclubTestTemizlik";
import { RENK_BORDO, RENK_BORDO_ZEMIN } from "../../_constants";
import { TEST_TEMIZLIK_ONAYI } from "@/lib/eclub/testGln";

const KISI_ROL_ETIKETLERI: Record<string, string> = {
  eczaci: "Eczacı",
  eczane_teknisyeni: "Eczane Teknisyeni",
};

interface EclubYonetimPaneliProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubYonetimPaneli({ hata, basari }: EclubYonetimPaneliProps) {
  // Ana panel bu bileşeni yalnız admin doğrulandıktan sonra render eder.
  const { bekleyenler, loading, islemLoading, kararVer } = useEclubOnaylar({ hazir: true, hata, basari });
  const {
    firmalar, seciliFirmaId, eczaneler, acikEczaneId, kisiler,
    firmaSec, eczaneTikla, kisiPasifeAl,
  } = useEclubKayitli({ hata, basari });
  const {
    testEczaneler, loading: testLoading, islemLoading: testIslemLoading,
    veriCek: testEczaneleriYenile, olustur: testEczaneOlustur, kullanilmayanlariSil,
  } = useEclubTestEczaneler({ hata, basari });
  const {
    onizleme: testTemizlikOnizleme, loading: testTemizlikLoading,
    onizlemeCek: testTemizlikOnizle, temizle: testVerileriniTemizle,
    onizlemeKapat: testTemizlikKapat,
  } = useEclubTestTemizlik({ hata, basari });

  const [reddetOnay, setReddetOnay] = useState<string | null>(null);
  const [pasifeOnay, setPasifeOnay] = useState<string | null>(null);
  const [testAdet, setTestAdet] = useState(30);
  const [testSilOnay, setTestSilOnay] = useState(false);
  const [testTemizlikOnayi, setTestTemizlikOnayi] = useState("");

  if (loading) {
    return <p className="text-sm text-gray-400 py-4 m-0">E-Club verileri yükleniyor...</p>;
  }

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: "860px", fontFamily: "'Nunito', sans-serif" }}>

      {/* --- Test Eczane Tanımları --- */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <div>
            <span className="block text-sm font-semibold text-gray-900">Test Eczane Tanımları</span>
            <span className="block mt-0.5 text-xs text-gray-500">UTT’nin gerçek kayıt akışında kullanacağı 111 önekli test GLN havuzu.</span>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{testEczaneler.length} kayıt</span>
        </div>

        <div className="px-4 md:px-5 py-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Oluşturulacak adet</span>
              <input
                type="number"
                min={1}
                max={100}
                value={testAdet}
                onChange={(e) => setTestAdet(Number(e.target.value))}
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 outline-none"
              />
            </label>
            <button
              onClick={() => testEczaneOlustur(testAdet)}
              disabled={testIslemLoading || !Number.isInteger(testAdet) || testAdet < 1 || testAdet > 100}
              className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: RENK_BORDO }}
            >
              {testIslemLoading ? "İşleniyor..." : `${testAdet || 0} Test Eczanesi Oluştur`}
            </button>

            {testEczaneler.some((eczane) => !eczane.kullaniliyor_mu) && (
              testSilOnay ? (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs text-gray-500">Kullanılmayanlar silinsin mi?</span>
                  <button
                    onClick={async () => { await kullanilmayanlariSil(); setTestSilOnay(false); }}
                    disabled={testIslemLoading}
                    className="text-xs px-2.5 py-2 rounded-lg border-none text-white cursor-pointer disabled:opacity-50"
                    style={{ background: "#bc2d0d" }}
                  >Evet, sil</button>
                  <button onClick={() => setTestSilOnay(false)} className="text-xs px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-gray-500 cursor-pointer">Vazgeç</button>
                </div>
              ) : (
                <button onClick={() => setTestSilOnay(true)} className="ml-auto text-xs px-3 py-2 rounded-lg bg-white cursor-pointer" style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>
                  Kullanılmayanları Sil
                </button>
              )
            )}
          </div>

          <p className="m-0 text-xs leading-5 text-gray-500">
            Üretilen kayıtlar onaylı master eczane olarak eklenir. UTT, ayrı bir test alanı olmadan mevcut GLN aramasına bu numaralardan birini yazar. “Kullanılmayanları Sil” yalnız boş kayıtları; “Test Sürecini Temizle” ise bağlı test zincirini kaldırır.
          </p>

          {testLoading ? (
            <p className="m-0 py-3 text-center text-xs text-gray-400">Test GLN’ler yükleniyor...</p>
          ) : testEczaneler.length > 0 ? (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 divide-y divide-gray-100">
              {testEczaneler.map((eczane) => (
                <div key={eczane.gln} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-gray-800">{eczane.eczane_adi}</span>
                    <span className="block text-[11px] text-gray-400 font-mono">{eczane.gln}</span>
                  </div>
                  <span className="flex-shrink-0 text-[10px] px-2 py-1 rounded-full" style={{ color: eczane.kullaniliyor_mu ? "#166534" : "#6b7280", background: eczane.kullaniliyor_mu ? "#dcfce7" : "#f3f4f6" }}>
                    {eczane.kullaniliyor_mu ? "UTT listesinde" : "Kullanılabilir"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 py-3 text-center text-xs text-gray-400">Henüz test GLN oluşturulmadı.</p>
          )}

          {!testTemizlikOnizleme && (
            <div className="flex justify-end border-t border-gray-100 pt-3">
              <button
                onClick={async () => { await testTemizlikOnizle(); }}
                disabled={testTemizlikLoading || testIslemLoading || testEczaneler.length === 0}
                className="text-xs px-3 py-2 rounded-lg bg-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}
              >
                {testTemizlikLoading
                  ? "Önizleniyor..."
                  : testEczaneler.length === 0
                    ? "Temizlenecek Test Verisi Yok"
                    : "Test Sürecini Temizle"}
              </button>
            </div>
          )}

          {testTemizlikOnizleme && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
              <div>
                <span className="block text-sm font-semibold text-red-900">Test temizliği önizlemesi</span>
                <span className="block mt-0.5 text-xs leading-5 text-red-700">Bu işlem yalnız 111 test zincirini siler ve geri alınamaz. Gerçek eczaneyle bağı bulunan kişi ve müşteriler korunur.</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  ["Test GLN", testTemizlikOnizleme.test_master_sayisi],
                  ["Eczane", testTemizlikOnizleme.eczane_sayisi],
                  ["Kişi", testTemizlikOnizleme.silinecek_kisi_sayisi],
                  ["Auth hesabı", testTemizlikOnizleme.auth_hesabi_sayisi],
                  ["E-Club öneri", testTemizlikOnizleme.eclub_oneri_sayisi],
                  ["E-Club izleme", testTemizlikOnizleme.eclub_izleme_sayisi],
                  ["E-Club sipariş", testTemizlikOnizleme.eclub_siparis_sayisi],
                  ["Eczanem sipariş", testTemizlikOnizleme.eczanem_siparis_sayisi],
                ].map(([etiket, deger]) => (
                  <div key={etiket} className="rounded-lg border border-red-100 bg-white px-3 py-2">
                    <span className="block text-[10px] text-gray-500">{etiket}</span>
                    <strong className="block mt-0.5 text-sm text-gray-900">{deger}</strong>
                  </div>
                ))}
              </div>

              {(testTemizlikOnizleme.korunacak_kisi_sayisi > 0 || testTemizlikOnizleme.korunacak_musteri_sayisi > 0) && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                  Gerçek bağları nedeniyle {testTemizlikOnizleme.korunacak_kisi_sayisi} E-Club kişisi ve {testTemizlikOnizleme.korunacak_musteri_sayisi} Eczanem müşterisi korunacak.
                </div>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs text-red-800">Onaylamak için <strong>{TEST_TEMIZLIK_ONAYI}</strong> yazın</span>
                <input
                  value={testTemizlikOnayi}
                  onChange={(e) => setTestTemizlikOnayi(e.target.value)}
                  placeholder={TEST_TEMIZLIK_ONAYI}
                  className="w-full border border-red-200 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { testTemizlikKapat(); setTestTemizlikOnayi(""); }}
                  disabled={testTemizlikLoading}
                  className="text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 cursor-pointer"
                >Vazgeç</button>
                <button
                  onClick={async () => {
                    const ok = await testVerileriniTemizle(testTemizlikOnayi);
                    if (ok) { setTestTemizlikOnayi(""); await testEczaneleriYenile(); }
                  }}
                  disabled={testTemizlikLoading || testTemizlikOnayi !== TEST_TEMIZLIK_ONAYI}
                  className="text-xs px-4 py-2 rounded-lg border-none bg-red-700 text-white font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testTemizlikLoading ? "Temizleniyor..." : "Test Zincirini Kalıcı Sil"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Onay Bekleyen Eczaneler --- */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Onay Bekleyen Eczaneler</span>
          <span className="text-xs text-gray-400">{bekleyenler.length} kayıt</span>
        </div>

        {bekleyenler.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 m-0">Onay bekleyen eczane yok.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {bekleyenler.map((b) => (
              <div key={b.gln} className="px-4 md:px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-900">{b.eczane_adi}</span>
                  <span className="text-xs text-gray-400 font-mono">{b.gln}</span>
                  <span className="text-xs text-gray-500">
                    {b.il}{b.ilce ? ` / ${b.ilce}` : ""}
                    {b.ekleyen_ad ? ` · Ekleyen: ${b.ekleyen_ad}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {reddetOnay === b.gln ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Silinsin mi?</span>
                      <button onClick={async () => { await kararVer(b.gln, "reddet"); setReddetOnay(null); }}
                        disabled={islemLoading}
                        className="text-xs px-2.5 py-1 rounded-lg border-none text-white cursor-pointer" style={{ background: "#bc2d0d" }}>
                        Evet, reddet
                      </button>
                      <button onClick={() => setReddetOnay(null)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer">Vazgeç</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => kararVer(b.gln, "onayla")} disabled={islemLoading}
                        className="text-xs px-3 py-1.5 rounded-lg border-none bg-green-700 text-white font-semibold cursor-pointer">Onayla</button>
                      <button onClick={() => setReddetOnay(b.gln)} disabled={islemLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-transparent cursor-pointer"
                        style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>Reddet</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Kayıtlı Firma / Eczane / Kişi --- */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-semibold text-gray-900">Kayıtlı Eczaneler ve Kişiler</span>
        </div>

        <div className="px-4 md:px-5 py-3 border-b border-gray-100">
          <label className="block text-xs text-gray-500 mb-1">Firma</label>
          <select
            value={seciliFirmaId}
            onChange={(e) => firmaSec(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 outline-none"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <option value="">Firma seçin...</option>
            {firmalar.map((f) => (
              <option key={f.firma_id} value={f.firma_id}>
                {f.firma_adi}{f.eclub_aktif ? "" : " (E-Club kapalı)"}
              </option>
            ))}
          </select>
        </div>

        {!seciliFirmaId ? (
          <p className="text-sm text-gray-400 text-center py-8 m-0">Eczaneleri görmek için firma seçin.</p>
        ) : eczaneler.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 m-0">Bu firmada kayıtlı eczane yok.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {eczaneler.map((e) => (
              <div key={e.eczane_id}>
                <div
                  onClick={() => eczaneTikla(e.eczane_id)}
                  className="px-4 md:px-5 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
                      style={{ transform: acikEczaneId === e.eczane_id ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-900">{e.eczane_adi}</span>
                      <span className="text-xs text-gray-400 font-mono">{e.gln} · {e.il}{e.ilce ? ` / ${e.ilce}` : ""}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{e.aktif_kisi_sayisi} kişi</span>
                </div>

                {acikEczaneId === e.eczane_id && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {kisiler.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4 m-0">Bu eczanede kayıtlı kişi yok.</p>
                    ) : (
                      kisiler.map((k) => (
                        <div key={k.kisi_id} className="pl-11 pr-4 md:pr-5 py-2.5 flex items-center justify-between gap-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                              style={{ background: RENK_BORDO_ZEMIN, color: RENK_BORDO }}>
                              {`${k.ad?.[0] ?? ""}${k.soyad?.[0] ?? ""}`}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm text-gray-900">{k.ad} {k.soyad}</span>
                              <span className="text-xs text-gray-400">
                                {KISI_ROL_ETIKETLERI[k.rol] ?? k.rol} · {k.aktif_mi ? "aktif" : "pasif"}
                              </span>
                            </div>
                          </div>

                          {k.aktif_mi ? (
                            pasifeOnay === k.kisi_id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">Emin misiniz?</span>
                                <button
                                  onClick={async () => { await kisiPasifeAl(k.kisi_id, e.eczane_id); setPasifeOnay(null); }}
                                  className="text-xs px-2.5 py-1 rounded-lg border-none text-white cursor-pointer"
                                  style={{ background: "#bc2d0d" }}>
                                  Evet, pasife al
                                </button>
                                <button onClick={() => setPasifeOnay(null)}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer">Vazgeç</button>
                              </div>
                            ) : (
                              <button onClick={() => setPasifeOnay(k.kisi_id)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-transparent cursor-pointer"
                                style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>Pasife al</button>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">Pasif</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
