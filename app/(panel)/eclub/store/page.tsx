"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Coins,
  Gift,
  Info,
  Package,
  Sparkles,
  Store,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  EclubKisiBaslik,
  EclubKisiBosDurum,
  EclubKisiSayfa,
  EclubKisiStat,
  EclubKisiYukleniyor,
} from "@/components/eclub/EclubKisiSayfa";
import { useEclubStore } from "./_hooks/useEclubStore";
import type { BaremSatiri } from "@/lib/eclub/store/eclubStoreTipler";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { useEclubStoreTakvim } from "@/hooks/useEclubStoreTakvim";

export default function EclubStorePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const {
    cekYayinlar,
    loading,
    yenileniyor,
    yenile,
    cekTalebiOlustur,
  } = useEclubStore({ hata, basari });
  const { takvim, acik: storeAcik, yenile: takvimYenile } = useEclubStoreTakvim({
    aktif: Boolean(eclubKisi),
  });

  const [islemId, setIslemId] = useState<string | null>(null);
  const islemLoading = Boolean(islemId);
  const [seciliUrun, setSeciliUrun] = useState<unknown | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) {
      router.replace("/login");
      return;
    }
    if (!eclubKisi) router.replace("/ana-sayfa");
  }, [authYukleniyor, kullanici, eclubKisi, router]);

  if (authYukleniyor || !kullanici || loading) return <EclubKisiYukleniyor />;

  const handleTalepVer = async (
    yayinId: string,
    siparisVerilsinMi: boolean,
    urunAdi: string,
  ) => {
    if (!storeAcik) {
      hata(
        `E-Club Store şu an siparişe kapalıdır. Talepler 2 ayda bir ilk 7 günde (${takvim?.sonrakiDonemEtiketi ?? "Store Günleri"}) verilebilir.`,
      );
      return;
    }
    setIslemId(yayinId);
    const ok = await cekTalebiOlustur(yayinId, siparisVerilsinMi);
    setIslemId(null);
    if (ok) {
      basari(`${urunAdi} için hediye çeki talebiniz UTT onayına iletildi.`);
    }
  };

  const tumunuYenile = async () => {
    await Promise.all([yenile(), takvimYenile()]);
  };

  const toplamHavuzPuani = cekYayinlar.reduce(
    (acc, y) => acc + (y.havuz_toplam_puan ?? y.toplanan_puan ?? 0),
    0,
  );
  const toplamHakEdilenTl = cekYayinlar.reduce(
    (acc, y) => acc + (y.baz_cek_tutari_tl ?? y.hak_edilen_cek_tl ?? 0),
    0,
  );

  return (
    <EclubKisiSayfa>
      <EclubKisiBaslik
        ikon={Store}
        baslik="E-Club Store"
        rehberAnahtar="eclub-store-magaza"
        aciklama="Eczane çalışanlarının kazandığı puanlar eczane havuzunda toplanır ve satış şartına göre Migros Hediye Çeki'ne dönüşür."
        aksiyon={
          <div className="flex gap-2">
            <YenileButonu
              yenileniyor={yenileniyor}
              onYenile={tumunuYenile}
              disabled={Boolean(seciliUrun) || islemLoading}
            />
            <Link
              href="/eclub/store/siparislerim"
              className="rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] hover:bg-[#f6f9fc]"
            >
              Çeklerim & Taleplerim
            </Link>
          </div>
        }
      />

      {/* İstatistikler */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <EclubKisiStat
          ikon={Coins}
          etiket="Eczane Havuz Puanı"
          deger={toplamHavuzPuani.toLocaleString("tr-TR")}
          detay="Eczane çalışanlarının toplam puanı"
          renk="#16865f"
          zemin="#ebf8f2"
        />
        <EclubKisiStat
          ikon={Gift}
          etiket="Toplam Çek Değeri"
          deger={`${toplamHakEdilenTl.toLocaleString("tr-TR")} TL`}
          detay="Yayın ayarındaki puan/TL karşılığı"
          renk="#2563eb"
          zemin="#eff6ff"
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <EclubKisiStat
            ikon={Calendar}
            etiket="Store Sipariş Takvimi"
            deger={storeAcik ? "Siparişe Açık" : "Siparişe Kapalı"}
            detay={takvim?.sonrakiDonemEtiketi ? `Dönem: ${takvim.sonrakiDonemEtiketi}` : "2 ayda bir ilk 7 gün"}
            renk={storeAcik ? "#16865f" : "#d97706"}
            zemin={storeAcik ? "#ebf8f2" : "#fef3c7"}
          />
        </div>
      </section>

      {/* Sipariş & Devir Kuralı Bilgi Kutusu */}
      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow">
            <Info size={16} />
          </div>
          <div className="text-xs leading-relaxed text-slate-700">
            <h3 className="text-sm font-bold text-slate-900">
              📌 Migros Hediye Çeki & Sipariş Kuralları
            </h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-slate-600">
              <li>
                <strong>Sipariş Penceresi:</strong> Siparişler 2 ayda bir, takip eden ayın ilk 7 gününde verilir.
              </li>
              <li>
                <strong>Puan Karşılığı:</strong> Toplanan puanlar yayında tanımlanan puan/TL karşılığıyla Migros Hediye Çeki&apos;ne dönüştürülür.
              </li>
              <li>
                <strong>Devir & Bakiye Kuralı:</strong> İlk baremin altında kalan puanlar ile son baremin üzerindeki artık puanlar sonraki iki aylık döneme devreder.
              </li>
              <li>
                <strong>Zaman Aşımı:</strong> Sipariş dönemi içerisinde talep edilmeyen barem puanları dönem bitiminde yanar.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Çek & Satış Şartı Listesi */}
      {cekYayinlar.length === 0 ? (
        <EclubKisiBosDurum
          ikon={Gift}
          baslik="Henüz puan biriken yayın bulunmuyor"
          aciklama="Eczane çalışanlarınız eğitimleri izleyip soruları yanıtladıkça firmanızın ürünleri ve hak ettiğiniz hediye çekleri burada listelenecektir."
        />
      ) : (
        <div className="grid gap-4">
          {cekYayinlar.map((item) => {
            const toplananPuan = item.havuz_toplam_puan ?? item.toplanan_puan ?? 0;
            const bazCek = item.baz_cek_tutari_tl ?? item.hak_edilen_cek_tl ?? 0;
            const katlanmisCek = item.katlanmis_cek_tutari_tl ?? item.katlanmis_cek_tl ?? 0;
            const uygunAdet = item.aktif_barem_adet ?? item.uygun_adet ?? 0;
            const uygunMf = item.aktif_barem_mal_fazlasi ?? item.uygun_mal_fazlasi ?? 0;
            const baremler: BaremSatiri[] = Array.isArray(item.barem_tablosu)
              ? item.barem_tablosu
              : [];
            const isSerbest = item.satis_sarti_tipi === "serbest_siparis";
            const katlamaOrani = item.gizli_sart_katlama_orani ?? 20;
            const yeterliPuanVarMi = toplananPuan >= (item.aktif_barem_min_puan ?? 200);

            return (
              <article
                key={item.yayin_id}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Sol: Ürün & Firma & Şart Rozeti */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {item.firma_adi || "Firma"}
                      </span>
                      {isSerbest ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-800">
                          <Sparkles size={13} /> Serbest Sipariş (+%{katlamaOrani} Çek Bonusu)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                          <Package size={13} /> Satış Şartlı (Sipariş Zorunlu)
                        </span>
                      )}
                    </div>

                    <h2 className="mt-1.5 text-lg font-extrabold tracking-tight text-slate-900">
                      {item.urun_adi}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Eczaneniz: <strong>{item.eczane_adi}</strong>
                    </p>

                    {/* Barem Tablosu Mini Görünüm */}
                    {baremler.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Sipariş Baremleri:
                        </span>
                        {baremler.map((b, idx) => {
                          const aktifMi =
                            toplananPuan >= b.min_puan &&
                            toplananPuan <= b.max_puan;
                          return (
                            <span
                              key={idx}
                              className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                                aktifMi
                                  ? "border-emerald-300 bg-emerald-50 font-bold text-emerald-900 shadow-sm"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                              }`}
                            >
                              {b.min_puan}–{b.max_puan} p:{" "}
                              <strong>
                                {b.adet} Kutu + {b.mal_fazlasi} MF
                              </strong>
                              {aktifMi && " ✓ (Mevcut Bareminiz)"}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Sağ: Puan & Çek Tutarı & Aksiyon */}
                  <div className="flex flex-col items-start gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between lg:min-w-[420px]">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Eczane Havuzu
                      </span>
                      <strong className="text-xl font-black text-slate-800">
                        {toplananPuan.toLocaleString("tr-TR")} Puan
                      </strong>
                      <span className="mt-0.5 block text-xs font-semibold text-emerald-700">
                        Hediye Çeki: {bazCek.toLocaleString("tr-TR")} TL
                      </span>
                      {isSerbest && (
                        <span className="block text-[11px] font-bold text-purple-700">
                          Siparişli Tutar: {katlanmisCek.toLocaleString("tr-TR")} TL
                        </span>
                      )}
                    </div>

                    {/* Talep Durumu Varsa Göster */}
                    {item.talep_durumu ? (
                      <div className="flex flex-col items-end gap-1">
                        {item.talep_durumu === "cek_kodlari_gonderildi" ? (
                          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-right">
                            <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-800">
                              <CheckCircle2 size={15} /> Çek Kodunuz Teslim Edildi
                            </span>
                            <span className="font-mono text-sm font-black text-emerald-950">
                              {item.cek_kodu || "KOD HAZIR"}
                            </span>
                            <span className="block text-[10px] text-emerald-700">
                              Tutar: {item.cek_tutari_tl ?? bazCek} TL
                            </span>
                          </div>
                        ) : item.talep_durumu === "bm_onayladi" ? (
                          <span className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800">
                            ⏳ BM Onayladı — Kod Bekleniyor
                          </span>
                        ) : item.talep_durumu === "utt_onayladi" ? (
                          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
                            ⌛ UTT Onayladı — BM Onayı Bekleniyor
                          </span>
                        ) : (
                          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                            🕒 Talep Alındı — UTT Onayı Bekleniyor
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Henüz Talep Verilmemişse Aksiyon Butonları */
                      <div className="flex flex-col gap-2 sm:items-end">
                        {!yeterliPuanVarMi ? (
                          <div className="rounded-lg bg-amber-50 p-2 text-right text-[11px] font-bold text-amber-800">
                            Minimum barem için 200 puan gerekir. (Kalan puanlar devredilir).
                          </div>
                        ) : !isSerbest ? (
                          /* Satış Şartlı */
                          <button
                            type="button"
                            onClick={() =>
                              handleTalepVer(item.yayin_id, true, item.urun_adi)
                            }
                            disabled={Boolean(islemLoading) || !storeAcik}
                            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {islemId === item.yayin_id
                              ? "İşleniyor..."
                              : `${uygunAdet} Kutu + ${uygunMf} MF Sipariş Ver & ${bazCek} TL Çeki Al`}
                          </button>
                        ) : (
                          /* Serbest Sipariş */
                          <div className="flex flex-col gap-1.5 sm:flex-row">
                            <button
                              type="button"
                              onClick={() =>
                                handleTalepVer(item.yayin_id, false, item.urun_adi)
                              }
                              disabled={Boolean(islemLoading) || !storeAcik}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Siparişsiz {bazCek} TL Çekimi Al
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleTalepVer(item.yayin_id, true, item.urun_adi)
                              }
                              disabled={Boolean(islemLoading) || !storeAcik}
                              className="rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-md hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {uygunAdet} Kutu + {uygunMf} MF Sipariş Ver & %{katlamaOrani} Katla ({katlanmisCek} TL Çek)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </EclubKisiSayfa>
  );
}
