import type { SupabaseClient } from '@supabase/supabase-js';
import { URETICI_ROLLER, YONETICI_ROLLER, ADMIN_ROLLER } from '@/lib/utils/roller';
import {
  TALEP_TURU_SIRA,
  isTalepTuru,
  talepTuruAdi,
  type TalepTuru,
} from '@/lib/uretici/yetenekler';

const sayi = (deger: unknown) => Number(deger ?? 0);

export const uretimRaporunuGorebilir = (rol: string) =>
  URETICI_ROLLER.includes(rol) || YONETICI_ROLLER.includes(rol) || ADMIN_ROLLER.includes(rol);

// Yalnız sunucuda doğrulanmış kullanıcı bağlamıyla çağrılır. Bu, mevcut Üretim
// Raporları ekranının firma portföyü kapsamıdır; kişisel talep raporu değildir.
export async function getUretimData(
  db: SupabaseClient,
  kullanici: { kullanici_id: string; firma_id: string | null; rol: string },
  baslangic: string,
  bitis: string,
) {
  if (!uretimRaporunuGorebilir(kullanici.rol) || !kullanici.firma_id) {
    throw new Error('Üretim raporu kapsamı doğrulanamadı.');
  }
  // Mevcut RPC yalnız yönetici kimliğinden firma çözer. Temsilci sadece bu
  // firmanın aktif yöneticilerinden seçilir; istemci/model kimlik seçemez.
  let yoneticiId = kullanici.kullanici_id;
  if (!YONETICI_ROLLER.includes(kullanici.rol)) {
    const { data, error } = await db.from('kullanicilar').select('kullanici_id')
      .eq('firma_id', kullanici.firma_id).eq('aktif_mi', true)
      .in('rol', YONETICI_ROLLER).limit(1).maybeSingle();
    if (error || !data?.kullanici_id) throw new Error('Üretim raporu firma kapsamı okunamadı.');
    yoneticiId = data.kullanici_id;
  }
  const args = { p_yonetici_id: yoneticiId, p_baslangic: baslangic, p_bitis: bitis };
  const [ozetRes, egitimTuruRes] = await Promise.all([
    db.rpc('get_yonetici_rapor_ana_ozet_v2', args),
    db.rpc('get_yonetici_egitim_turu_etkisi_v3', args),
  ]);
  if (ozetRes.error || egitimTuruRes.error || !ozetRes.data?.length) {
    throw new Error('Üretim raporu okunamadı.');
  }
  const o = ozetRes.data?.[0] ?? {};
  const egitimHaritasi = new Map<TalepTuru, Record<string, unknown>>();
  for (const ham of (egitimTuruRes.data ?? []) as Record<string, unknown>[]) {
    if (isTalepTuru(ham.egitim_turu)) egitimHaritasi.set(ham.egitim_turu, ham);
  }

  const egitimTurleri = TALEP_TURU_SIRA.map((tur) => {
    const ham = egitimHaritasi.get(tur) ?? {};
    return {
      egitim_turu: tur,
      egitim_adi: talepTuruAdi(tur),
      donemde_yayina_alinan: sayi(ham.donemde_yayina_alinan),
      tamamlanan_izleme: sayi(ham.tamamlanan_izleme),
      izleme_puani: sayi(ham.izleme_puani),
      cevaplama_puani: sayi(ham.cevaplama_puani),
      oneri_puani: sayi(ham.oneri_puani),
      extra_puani: sayi(ham.extra_puani),
      ileri_sarma_kaybi: sayi(ham.ileri_sarma_kaybi),
      yanlis_cevap_kaybi: sayi(ham.yanlis_cevap_kaybi),
      oneri_kaybi: sayi(ham.oneri_kaybi),
      challenge_kaybi: sayi(ham.challenge_kaybi),
      kazanilan_toplam: sayi(ham.kazanilan_toplam),
      kaybedilen_toplam: sayi(ham.kaybedilen_toplam),
      net_puan: sayi(ham.net_puan),
      begeni_sayisi: sayi(ham.begeni_sayisi),
      favori_sayisi: sayi(ham.favori_sayisi),
      extra_izleme_sayisi: sayi(ham.extra_izleme_sayisi),
      urun_dagilimi: Array.isArray(ham.urun_dagilimi) ? ham.urun_dagilimi : [],
    };
  });

  return {
    uretim: {
      toplam_yayina_alma: sayi(o.toplam_yayina_alma),
      donemde_yayina_alinan: sayi(o.donemde_yayina_alinan),
      su_an_yayinda: sayi(o.su_an_yayinda),
      turler: egitimTurleri.map((tur) => ({
        kod: tur.egitim_turu,
        ad: tur.egitim_adi,
        adet: tur.donemde_yayina_alinan,
      })),
      varyantlar: [
        { kod: 'normal', ad: 'Tam Üretim', adet: sayi(o.donem_normal_uretim) },
        { kod: 'hazir_video', ad: 'Hazır Video', adet: sayi(o.donem_hazir_video) },
        { kod: 'hazir_set', ad: 'Hazır Soru Seti', adet: sayi(o.donem_hazir_soru_seti) },
        { kod: 'hazir_ikisi', ad: 'Hazır Video + Set', adet: sayi(o.donem_hazir_video_ve_soru_seti) },
      ],
    },
    egitim_turu_etkisi: egitimTurleri,
  };
}
