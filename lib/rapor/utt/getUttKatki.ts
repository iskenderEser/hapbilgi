import type { SupabaseClient } from '@supabase/supabase-js';
import { netPuanToplami } from '@/lib/rapor/paylasilan/netPuanToplami';
import { katkiYuzdesi } from '@/lib/rapor/paylasilan/oran';

interface UttKapsami {
  kullanici_id: string;
  bolge_id: string | null;
  takim_id: string | null;
  firma_id: string | null;
}
export interface UttKatki {
  netPuan: number;
  bolge: { toplam: number; yuzde: number | null } | null;
  takim: { toplam: number; yuzde: number | null } | null;
  firma: { toplam: number; yuzde: number | null } | null;
}

/** Ligle ortak net puan kaynağı; yalnızca kullanıcının kapsam toplamları döner. */
export async function getUttKatki(db: SupabaseClient, kullanici: UttKapsami, baslangic: string, bitis: string): Promise<UttKatki> {
  const toplam = (kapsam: Record<string, string>) => netPuanToplami(db, kapsam, baslangic, bitis);
  const firmaSiniri: Record<string, string> = kullanici.firma_id ? { p_firma_id: kullanici.firma_id } : {};
  const [netPuan, bolge, takim, firma] = await Promise.all([
    toplam({ p_kullanici_id: kullanici.kullanici_id }),
    kullanici.bolge_id ? toplam({ ...firmaSiniri, p_bolge_id: kullanici.bolge_id }) : null,
    kullanici.takim_id ? toplam({ ...firmaSiniri, p_takim_id: kullanici.takim_id }) : null,
    kullanici.firma_id ? toplam({ p_firma_id: kullanici.firma_id }) : null,
  ]);
  const katki = (puan: number | null) => puan === null ? null : {
    toplam: puan, yuzde: puan > 0 ? katkiYuzdesi(netPuan, puan) : null,
  };
  return { netPuan, bolge: katki(bolge), takim: katki(takim), firma: katki(firma) };
}
