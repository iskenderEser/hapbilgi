"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DurumAnahtari from "@/components/DurumAnahtari";
import UretimVaryantiRozet from "@/components/UretimVaryantiRozet";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { DahaFazlaGoster, ListeArama, useListe } from "@/components/liste";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { useAuth } from "@/app/providers/AuthProvider";
import { useOkunmamisIdler } from "@/hooks/useOkunmamisIdler";
import { useUretimDurumFiltresi } from "@/hooks/useUretimDurumFiltresi";
import { URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { durumMesaji, gorevDurumKodu, type Asama, type DurumKodu } from "@/lib/utils/durum/mesaj";
import { talepIdGoster } from "@/lib/utils/talepId";
import type { UretimGorevAsamasi, UretimGorevi } from "@/lib/uretim/gorevTipleri";

interface Props {
  asama: UretimGorevAsamasi;
  baslik: string;
  asamaEtiketi: Asama;
  bosMesaj: string;
}

const KAYIT_TURU: Record<UretimGorevAsamasi, "senaryo" | "video" | "soru_seti"> = {
  senaryo: "senaryo", video: "video", soru_seti: "soru_seti",
};

export default function UretimGorevListesi({ asama, baslik, asamaEtiketi, bosMesaj }: Props) {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata } = useHataMesaji();
  const [gorevler, setGorevler] = useState<UretimGorevi[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const okunmamisIdler = useOkunmamisIdler(KAYIT_TURU[asama]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) return router.push("/login");
    if (!URETIM_HATTI_GORENLER.includes(kullanici.rol)) router.push("/ana-sayfa");
  }, [authYukleniyor, kullanici, router]);

  const veriCek = useCallback(async (ilkYukleme = false) => {
    if (ilkYukleme) setLoading(true);
    else setYenileniyor(true);
    try {
      const res = await fetch(`/uretim/api/gorevler?asama=${asama}`);
      const veri = await res.json();
      if (!res.ok) {
        hata(veri.hata ?? `${baslik} yüklenemedi.`, veri.adim, veri.detay);
        if (ilkYukleme) setGorevler([]);
      } else setGorevler(veri.gorevler ?? []);
    } catch (err) {
      hata(`${baslik} yüklenemedi.`, "üretim görevleri API", err instanceof Error ? err.message : undefined);
      if (ilkYukleme) setGorevler([]);
    } finally {
      if (ilkYukleme) setLoading(false);
      else setYenileniyor(false);
    }
  }, [asama, baslik, hata]);

  useEffect(() => { if (kullanici) void veriCek(true); }, [kullanici, veriCek]);

  const sayim = useMemo(() => {
    const sonuc: Partial<Record<DurumKodu, number>> = {};
    for (const gorev of gorevler) {
      const kod = gorevDurumKodu(gorev.durum);
      sonuc[kod] = (sonuc[kod] ?? 0) + 1;
    }
    return sonuc;
  }, [gorevler]);
  const { aktifDurum, durumSec } = useUretimDurumFiltresi({ rol: kullanici?.rol, sayim, hazir: !!kullanici && !loading });
  const durumSuzulmus = aktifDurum ? gorevler.filter((g) => gorevDurumKodu(g.durum) === aktifDurum) : [];
  const liste = useListe({
    veri: durumSuzulmus,
    aramaAlanlari: [
      { anahtar: "no", etiket: "Talep No", deger: (g: UretimGorevi) => g.talep?.talep_no ?? 0 },
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (g: UretimGorevi) => g.talep?.urun_adi ?? "-" },
    ],
  });
  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  if (!kullanici || loading || !aktifDurum) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#56aeff]" /></div>;

  const SatirBasligi = ({ gorev }: { gorev: UretimGorevi }) => {
    const okunmamis = okunmamisIdler.has(gorev.gorev_id);
    return <div className="flex items-center gap-1.5 flex-wrap">{okunmamis && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#bc2d0d]" />}<span style={{ fontWeight: okunmamis ? 700 : 500 }}>{gorev.talep?.urun_adi ?? "-"}</span><UretimVaryantiRozet hazirVideo={gorev.talep?.hazir_video ?? false} hazirSoruSeti={gorev.talep?.hazir_soru_seti ?? false} /></div>;
  };

  return (
    <>
      <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <DurumAnahtari baslik={baslik} rol={kullanici.rol} asama={asamaEtiketi} aktif={aktifDurum} onSec={durumSec} sayim={sayim} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3"><span className="text-xs text-gray-500">{liste.toplam} kayıt</span><div className="flex flex-wrap items-center justify-end gap-2"><ListeArama arama={liste.arama} /><YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek()} /></div></div>
          {liste.toplam === 0 ? <div className="p-10 text-center text-sm text-gray-400">{gorevler.length === 0 ? bosMesaj : liste.hamToplam === 0 ? "Bu durumda görev yok." : "Aramanıza uyan kayıt bulunamadı."}</div> : (
            <>
              <div className="md:hidden">{liste.gorunen.map((gorev) => {
                const kod = gorevDurumKodu(gorev.durum);
                const durum = durumMesaji(kod, kullanici.rol, { asama: asamaEtiketi, rolAdi: gorev.talep?.uretici_rol_adi, tarih: gorev.updated_at });
                const okunmamis = okunmamisIdler.has(gorev.gorev_id);
                return <button key={gorev.gorev_id} type="button" onClick={() => router.push(`/uretim/gorevler/${gorev.gorev_id}`)} className="block w-full border-0 border-b border-gray-50 bg-white px-4 py-3 text-left hover:bg-gray-50" style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}><div className="mb-1 text-xs text-gray-500">{talepIdGoster(gorev.talep?.firma_adi ?? "", gorev.talep?.talep_no ?? 0)}</div><div className="mb-1 flex items-start justify-between gap-2"><SatirBasligi gorev={gorev} /><span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}` }}>{durum.metin}</span></div><div className="text-xs text-gray-500">{gorev.talep?.teknik_adi ?? "-"}</div><div className="mt-0.5 flex gap-3 text-xs text-gray-400">{asama === "soru_seti" && <span>{gorev.soru_sayisi} soru</span>}<span>{formatTarih(gorev.updated_at)}</span></div></button>;
              })}</div>
              <div className="hidden md:block"><table className="w-full border-collapse text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50"><th className="px-5 py-2.5 text-left text-xs font-medium uppercase text-gray-400">ID</th><th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-gray-400">Ürün / Eğitim</th><th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-gray-400">Teknik</th>{asama === "soru_seti" && <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-gray-400">Soru</th>}<th className="w-56 px-3 py-2.5 text-left text-xs font-medium uppercase text-gray-400">Son Durum</th><th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-gray-400">Tarih</th><th className="px-5 py-2.5" /></tr></thead><tbody>{liste.gorunen.map((gorev) => {
                const kod = gorevDurumKodu(gorev.durum);
                const durum = durumMesaji(kod, kullanici.rol, { asama: asamaEtiketi, rolAdi: gorev.talep?.uretici_rol_adi, tarih: gorev.updated_at });
                const okunmamis = okunmamisIdler.has(gorev.gorev_id);
                return <tr key={gorev.gorev_id} onClick={() => router.push(`/uretim/gorevler/${gorev.gorev_id}`)} className="cursor-pointer border-b border-gray-50 hover:bg-gray-50" style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}><td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500">{talepIdGoster(gorev.talep?.firma_adi ?? "", gorev.talep?.talep_no ?? 0)}</td><td className="px-3 py-3 text-gray-900"><SatirBasligi gorev={gorev} /></td><td className="px-3 py-3 text-gray-500">{gorev.talep?.teknik_adi ?? "-"}</td>{asama === "soru_seti" && <td className="px-3 py-3 text-gray-500">{gorev.soru_sayisi} soru</td>}<td className="px-3 py-3"><span className="inline-block max-w-full rounded-full px-2.5 py-0.5 text-center text-[10px] leading-snug" style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}` }}>{durum.metin}</span></td><td className="px-3 py-3 text-xs text-gray-500">{formatTarih(gorev.updated_at)}</td><td className="px-5 py-3 text-gray-400">›</td></tr>;
              })}</tbody></table></div>
              <DahaFazlaGoster dahaVar={liste.dahaVar} gorunenSayi={liste.gorunen.length} toplam={liste.toplam} onGoster={liste.dahaFazlaGoster} />
            </>
          )}
        </div>
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}
