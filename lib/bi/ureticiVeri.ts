import type { SupabaseClient } from '@supabase/supabase-js';
import { asamaCoz, zincirHaritasi } from '@/lib/utils/uretimZinciri';
import { gorevDurumKodu, type DurumKodu } from '@/lib/utils/durum/mesaj';
import { ureticiYetenegi } from '@/lib/uretici/yetenekler';
import { ureticiBaglaminiOku, ureticiDonemi, type UreticiSorgusu } from '@/lib/bi/ureticiSozlesmesi';

type Talep = { ogrenme_araci_turu: string; talep_id: string; created_at: string; hazir_video: boolean;
  yayin_oncesi_silme_durumu: 'isleniyor' | 'tamamlandi' | 'hata' | null; yayin_oncesi_silme_tarihi: string | null };
type SayfaSonucu = PromiseLike<{ data: unknown; error: unknown }>;
async function sayfalariOku<T>(sorgu: (bas: number, son: number) => SayfaSonucu): Promise<T[]> {
  const sonuc: T[] = [];
  for (let bas = 0; ; bas += 500) {
    const { data, error } = await sorgu(bas, bas + 499);
    if (error || !Array.isArray(data)) throw new Error('VERI_OKUNAMADI');
    sonuc.push(...data as T[]);
    if (data.length < 500) return sonuc;
  }
}
export function durumSayimaUyar(kod: DurumKodu, olcut: UreticiSorgusu['olcut']) {
  if (kod === 'sistem_hatasi') throw new Error('VERI_EKSIK');
  if (olcut === 'uretimde') return ['iu_iletildi','iu_hazirliyor','iu_duzeltiyor','onay_bekleniyor','video_bekleniyor'].includes(kod);
  return kod === ({ inceleme: 'onay_bekleniyor', revizyon: 'iu_duzeltiyor', yayin_bekleyen: 'yayin_bekleniyor' } as Partial<Record<UreticiSorgusu['olcut'], DurumKodu>>)[olcut];
}
export async function ureticiSayisiniOku(db: SupabaseClient, id: string, rol: string, s: UreticiSorgusu, simdi = new Date(), yoneticiFiltresi?: { firmaId: string; urunId?: string | null }) {
  if (!ureticiBaglaminiOku(s, rol)) throw new Error('ROL_DESTEKLENMIYOR');
  const { data: kisi, error } = await db.from('kullanicilar').select('firma_id,rol,aktif_mi')
    .eq('kullanici_id', id).maybeSingle();
  if (error || !kisi?.firma_id || kisi.rol !== rol || (yoneticiFiltresi ? kisi.firma_id !== yoneticiFiltresi.firmaId : kisi.aktif_mi !== true)) throw new Error('KAPSAM_YOK');
  const donem = ureticiDonemi(s, simdi);
  if (donem.bitis < donem.baslangic) throw new Error('KAYIT_YOK');
  let adet = 0;
  const aracDagilimi: Record<string, number> = { video: 0, podcast: 0, gorsel: 0, flip_pdf: 0 };
  const dagilimIstendi = ['yayinda_arac_turu','yayin_arac_dagilimi'].includes(s.olcut);
  const sayilanYayinlar = new Set<string>();
  // Her sayfa yalnız oturumdaki üreticinin ve firmasının taleplerini içerir.
  for (let bas = 0; ; bas += 50) {
    let q = db.from('talepler').select('ogrenme_araci_turu,talep_id,created_at,hazir_video,yayin_oncesi_silme_durumu,yayin_oncesi_silme_tarihi')
      .eq('uretici_id', id).eq('firma_id', kisi.firma_id)
      .in('egitim_turu', s.egitim === 'tumu' ? ureticiYetenegi(rol)!.acabilecegiTalepTurleri : [s.egitim]);
    if (yoneticiFiltresi?.urunId !== undefined) q = yoneticiFiltresi.urunId === null ? q.is('urun_id', null) : q.eq('urun_id', yoneticiFiltresi.urunId);
    if (s.arac !== 'tumu') q = q.eq('ogrenme_araci_turu', s.arac);
    if (s.olcut === 'talep_acilan') q = q.gte('created_at', donem.baslangic).lte('created_at', donem.bitis);
    const { data, error: talepHata } = await q.order('talep_id').range(bas, bas + 49);
    if (talepHata || !Array.isArray(data)) throw new Error('VERI_OKUNAMADI');
    const talepler = data as Talep[];
    if (!talepler.length) break;
    const ids = talepler.map(t => t.talep_id);
    if (s.olcut === 'talep_toplam' || s.olcut === 'talep_acilan') {
      adet += talepler.length;
    } else if (['yayinda','yayinda_arac_turu','yayin_arac_dagilimi','planlanan','durdurulan','yayina_alinan'].includes(s.olcut)) {
      const kunyeler = await sayfalariOku<{ yayin_id: string; talep_id: string }>((b, e) =>
        db.from('v_yayin_kunye').select('yayin_id,talep_id').eq('uretici_id', id).eq('firma_id', kisi.firma_id)
          .in('talep_id', ids).order('yayin_id').range(b, e));
      const yayinIds = [...new Set(kunyeler.map(y => y.yayin_id))];
      // Bir yayın/öğrenme aracı yalnız bir kez sayılır; plan oluşturma veya yeniden açma ilk yayın değildir.
      for (let i = 0; i < yayinIds.length; i += 50) {
        const parca = yayinIds.slice(i, i + 50);
        if (s.olcut === 'yayina_alinan') {
          const turlar = await sayfalariOku<{ yayin_id: string }>((b, e) =>
            db.from('yayin_tekrar_kayitlari').select('yayin_id').in('yayin_id', parca).eq('tur_no', 1)
              .gte('baslangic_tarihi', donem.baslangic).lte('baslangic_tarihi', donem.bitis)
              .order('yayin_id').range(b, e));
          adet += new Set(turlar.map(t => t.yayin_id)).size;
        } else {
          const durum: string = (s.olcut === 'yayinda' || dagilimIstendi) ? 'yayinda' : s.olcut === 'planlanan' ? 'planlandi' : 'Durduruldu';
          const yayinlar: { yayin_id: string }[] = await sayfalariOku<{ yayin_id: string }>((b, e) =>
            db.from('yayin_yonetimi').select('yayin_id').eq('uretici_id', id)
              .in('yayin_id', parca).eq('durum', durum).order('yayin_id').range(b, e));
          if (dagilimIstendi) {
            for (const y of yayinlar) {
              if (sayilanYayinlar.has(y.yayin_id)) continue;
              const turler: Set<string | undefined> = new Set(kunyeler.filter(k => k.yayin_id === y.yayin_id)
                .map(k => talepler.find(t => t.talep_id === k.talep_id)?.ogrenme_araci_turu));
              const tur = [...turler][0];
              if (turler.size !== 1 || !tur || !Object.hasOwn(aracDagilimi, tur)) throw new Error('VERI_EKSIK');
              sayilanYayinlar.add(y.yayin_id);
              aracDagilimi[tur]++;
            }
          } else {
            adet += new Set(yayinlar.map(y => y.yayin_id)).size;
          }
        }
      }
    } else {
      const [zincirler, gorevler] = await Promise.all([
        zincirHaritasi(db, { talepIdler: ids }),
        sayfalariOku<{ talep_id: string; durum: string }>((b, e) => db.from('uretim_gorevleri').select('talep_id,durum')
          .in('talep_id', ids).in('durum', ['atama_bekliyor','hazirlaniyor','inceleme_bekliyor','revizyon_bekliyor'])
          .order('gorev_id').range(b, e)),
      ]);
      const gorevMap = new Map(gorevler.map(g => [g.talep_id, g]));
      if (gorevMap.size !== gorevler.length) throw new Error('VERI_EKSIK');
      for (const t of talepler) {
        const z = zincirler.get(t.talep_id);
        if (!z) throw new Error('VERI_EKSIK');
        const g = gorevMap.get(t.talep_id);
        const kod = g && !t.yayin_oncesi_silme_durumu ? gorevDurumKodu(g.durum) : asamaCoz(t, z).durum_kodu;
        if (durumSayimaUyar(kod, s.olcut)) adet++;
      }
    }
    if (talepler.length < 50) break;
  }
  if (dagilimIstendi) adet = s.olcut === 'yayinda_arac_turu'
    ? Object.values(aracDagilimi).filter(n => n > 0).length : sayilanYayinlar.size;
  return { adet, donem, aracDagilimi };
}
