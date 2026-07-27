// app/soru-setleri/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import DurumAnahtari from "@/components/DurumAnahtari";
import { durumMesaji, kayitDurumKodu, type DurumKodu } from "@/lib/utils/durum/mesaj";
import type { TalepBilgisi } from "@/lib/utils/talepZinciri";
import UretimVaryantiRozet from "@/components/UretimVaryantiRozet";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useOkunmamisIdler } from "@/hooks/useOkunmamisIdler";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { useListe, ListeArama, DahaFazlaGoster } from "@/components/liste";
import { talepIdGoster } from "@/lib/utils/talepId";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";

interface SoruSetiSatir {
  talep_id: string;
  talep_no: number;
  firma_adi: string;
  video_durum_id: string;
  soru_seti_id: string;
  urun_adi: string;
  teknik_adi: string;
  turu_adi: string | null;
  soru_sayisi: number;
  // Ham durum taşınmaz: ekrana çıkan her metin tek sözlükten okunur.
  durum_kodu: DurumKodu;
  uretici_rol_adi: string | null;
  son_tarih: string;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
}

export default function SoruSetleriListePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [satirlar, setSatirlar] = useState<SoruSetiSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [aktifDurum, setAktifDurum] = useState<DurumKodu>("onay_bekleniyor");
  const { mesajlar, hata } = useHataMesaji();

  const okunmamisIdler = useOkunmamisIdler("soru_seti");

  useEffect(() => {
  if (authYukleniyor) return;
  if (!kullanici) {
    router.push("/login");
    return;
  }
  if (!URETIM_HATTI_GORENLER.includes(kullanici.rol)) {
    router.push("/ana-sayfa");
    return;
  }
 }, [kullanici, authYukleniyor, router]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  const veriCek = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // 1) Soru setlerini talep_id ile çek — zincir yürümek yok, hazır ürünler de gelir.
    //    Görünürlüğü RLS belirler (İU hepsini, üretici yalnız kendi talebini).
    const { data: soruSetleri, error: ssError } = await supabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, talep_id, iu_id, sorular, created_at")
      .order("created_at", { ascending: false });

    if (ssError || !soruSetleri) {
      hata("Soru setleri yüklenemedi.", "soru_setleri tablosu SELECT", ssError?.message);
      setLoading(false);
      return;
    }

    // 2) Talep bazlı tekilleştir — her talep için sadece en yeni soru seti
    const talepMap = new Map<string, any>();
    for (const ss of soruSetleri) {
      const talep_id = (ss as any).talep_id;
      if (!talep_id) continue;
      if (!talepMap.has(talep_id)) talepMap.set(talep_id, ss);
    }
    const tekilSoruSetleri = Array.from(talepMap.values());
    const talepIdler = Array.from(talepMap.keys());

    // 3) Talep künyeleri TEK KAPIDAN, toplu (25.07, Aşama 3): alan listesi ve ad
    // kuralı ekranda değil, sunucuda. Tür adı künyedeki egitim_turu'ndan türetilir.
    const talepBilgiMap = new Map<string, TalepBilgisi & { turu_adi: string | null }>();
    if (talepIdler.length > 0) {
      const res = await fetch(`/talepler/api/kunye?talep_idler=${talepIdler.join(",")}`);
      const veri = await res.json();

      if (!res.ok) {
        hata(veri.hata ?? "Talep bilgileri yüklenemedi.", "talep künyesi", veri.detay);
        setLoading(false);
        return;
      }

      for (const k of veri.kunyeler as TalepBilgisi[]) {
        // Künye olduğu gibi taşınır; ekrana özel tek türetme tür adıdır.
        talepBilgiMap.set(k.talep_id, {
          ...k,
          turu_adi: k.egitim_turu ? (TALEP_TURU_KURALLARI[k.egitim_turu]?.ad ?? null) : null,
        });
      }
    }


    // Talebi açanın unvanı künyeden gelir (25.07): ayrı kullanicilar sorgusu kalktı.

    // 4) Son durumları view'dan toplu çek
    const soruSetiIds = tekilSoruSetleri.map((ss: any) => ss.soru_seti_id);
    const sonDurumMap = new Map<string, { durum: string; created_at: string }>();

    if (soruSetiIds.length > 0) {
      const { data: sonDurumlar, error: sdError } = await supabase
        .from("v_soru_seti_son_durum")
        .select("soru_seti_id, durum, created_at")
        .in("soru_seti_id", soruSetiIds);

      if (sdError) {
        hata("Soru seti son durumları yüklenemedi.", "v_soru_seti_son_durum SELECT", sdError.message);
        setLoading(false);
        return;
      }

      sonDurumlar?.forEach((sd: any) => {
        sonDurumMap.set(sd.soru_seti_id, { durum: sd.durum, created_at: sd.created_at });
      });
    }

    // 5) Satırları kur — talep bazlı tek satır
    const sonuc: SoruSetiSatir[] = tekilSoruSetleri.map((ss: any) => {
      const bilgi = talepBilgiMap.get(ss.talep_id);
      const sonDurum = sonDurumMap.get(ss.soru_seti_id);

      return {
        talep_id: ss.talep_id,
        talep_no: bilgi?.talep_no ?? 0,
        firma_adi: bilgi?.firma_adi ?? "",
        video_durum_id: ss.video_durum_id,
        soru_seti_id: ss.soru_seti_id,
        urun_adi: bilgi?.urun_adi ?? "-",
        teknik_adi: bilgi?.teknik_adi ?? "-",
        turu_adi: bilgi?.turu_adi ?? null,
        hazir_video: bilgi?.hazir_video ?? false,
        hazir_soru_seti: bilgi?.hazir_soru_seti ?? false,
        soru_sayisi: Array.isArray(ss.sorular) ? ss.sorular.length : 0,
        durum_kodu: kayitDurumKodu(sonDurum?.durum, !!ss.iu_id),
        uretici_rol_adi: bilgi?.uretici_rol_adi ?? null,
        son_tarih: sonDurum?.created_at ?? ss.created_at,
      };
    });

    setSatirlar(sonuc);
    setLoading(false);
  }, [hata]);

  useEffect(() => { if (kullanici) veriCek(); }, [kullanici, veriCek]);

  const sayim = useMemo(() => {
    const s: Partial<Record<DurumKodu, number>> = {};
    for (const r of satirlar) s[r.durum_kodu] = (s[r.durum_kodu] ?? 0) + 1;
    return s;
  }, [satirlar]);

  // G-4: durumu henüz olmayan (yazım bekleyen) satırlar "takip" bölgesinde
  // "Yazım bekleniyor" pill'iyle erişilir — gizlenmez.
  // Sıra önemli: önce durum sekmesi (DurumAnahtari), sonra arama, sonra dilimleme.
  // Arama ve "daha fazla göster" merkezden (components/liste) — 9 liste ekranı
  // aynı davranışı paylaşsın diye; sayfa yalnız aranabilir alanları tanımlar.
  const durumSuzulmus = satirlar.filter(s => s.durum_kodu === aktifDurum);
  const liste = useListe({
    veri: durumSuzulmus,
    aramaAlanlari: [
      { anahtar: "no", etiket: "Talep No", deger: (s: typeof durumSuzulmus[number]) => s.talep_no },
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (s: typeof durumSuzulmus[number]) => s.urun_adi },
    ],
  });
  const filtreliSatirlar = liste.gorunen;

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  // durumRenk kaldırıldı (25.07): metin ve renk tek sözlükten — lib/utils/durum/mesaj.ts.

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[#56aeff] rounded-full animate-spin" />
          <div className="h-2 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />

      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          <DurumAnahtari baslik="Soru Setleri" rol={kullanici.rol} asama="Soru Seti" aktif={aktifDurum} onSec={setAktifDurum} sayim={sayim} />

          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-gray-500">{liste.toplam} kayıt</span>
            <ListeArama arama={liste.arama} />
          </div>

          {liste.toplam === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              {satirlar.length === 0 ? "Henüz soru seti bulunmuyor."
                : liste.hamToplam === 0 ? "Bu durumda soru seti yok."
                : "Aramanıza uyan kayıt bulunamadı."}
            </div>
          ) : (
            <>
              <div className="md:hidden">
                {filtreliSatirlar.map((ss) => {
                  const durum = durumMesaji(ss.durum_kodu, kullanici.rol, { asama: "Soru Seti", rolAdi: ss.uretici_rol_adi, tarih: ss.son_tarih });
                  const okunmamis = okunmamisIdler.has(ss.soru_seti_id);
                  return (
                    <div key={ss.talep_id} onClick={() => router.push(`/soru-setleri/${ss.video_durum_id}`)}
                      className="px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                      <div className="text-xs text-gray-500 mb-1">{talepIdGoster(ss.firma_adi, ss.talep_no)}</div>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {okunmamis && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                          )}
                          <span className="text-sm text-gray-900" style={{ fontWeight: okunmamis ? 700 : 600 }}>{ss.urun_adi}</span>
                          <UretimVaryantiRozet hazirVideo={ss.hazir_video} hazirSoruSeti={ss.hazir_soru_seti} />
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full leading-tight"
                          style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}`, fontSize: 11 }}>
                          {durum.metin}
                        </span>
                      </div>
                      {ss.turu_adi && <div className="text-xs text-gray-400">{ss.turu_adi}</div>}
                      <div className="text-xs text-gray-500">{ss.teknik_adi}</div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{ss.soru_sayisi} soru</span>
                        <span className="text-xs text-gray-400">{formatTarih(ss.son_tarih)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">ID</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün / Eğitim</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Teknik</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Soru</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase w-56">Son Durum</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliSatirlar.map((ss) => {
                      const durum = durumMesaji(ss.durum_kodu, kullanici.rol, { asama: "Soru Seti", rolAdi: ss.uretici_rol_adi, tarih: ss.son_tarih });
                      const okunmamis = okunmamisIdler.has(ss.soru_seti_id);
                      return (
                        <tr key={ss.talep_id} onClick={() => router.push(`/soru-setleri/${ss.video_durum_id}`)}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100"
                          style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                          <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{talepIdGoster(ss.firma_adi, ss.talep_no)}</td>
                          <td className="px-3 py-3 text-gray-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {okunmamis && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                              )}
                              <span style={{ fontWeight: okunmamis ? 700 : 500 }}>{ss.urun_adi}</span>
                              <UretimVaryantiRozet hazirVideo={ss.hazir_video} hazirSoruSeti={ss.hazir_soru_seti} />
                            </div>
                            {ss.turu_adi && <div className="text-xs text-gray-400 mt-0.5">{ss.turu_adi}</div>}
                          </td>
                          <td className="px-3 py-3 text-gray-500">{ss.teknik_adi}</td>
                          <td className="px-3 py-3 text-gray-500">{ss.soru_sayisi} soru</td>
                          <td className="px-3 py-3">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full inline-block max-w-full break-words text-center leading-snug"
                              style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}` }}>
                              {durum.metin}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(ss.son_tarih)}</td>
                          <td className="px-5 py-3">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="16" height="16"><path d="M9 5l7 7-7 7"/></svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <DahaFazlaGoster
                dahaVar={liste.dahaVar}
                gorunenSayi={liste.gorunen.length}
                toplam={liste.toplam}
                onGoster={liste.dahaFazlaGoster}
              />
            </>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}