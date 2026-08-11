'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Periyot } from '@/lib/utils/raporUtils';
import styles from '../yonetici-report.module.css';

export interface HiyerarsiSatiri {
  birim_id: string;
  birim_adi: string;
  toplam_utt: number;
  aktif_utt: number;
  tamamlanan_izleme: number;
  benzersiz_yayin: number;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  challenge_kaybi: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

interface Props {
  takimlar: HiyerarsiSatiri[];
  periyot: Periyot;
}

const format = (deger: number) => Number(deger ?? 0).toLocaleString('tr-TR');

export default function TakimBolgeUttAkordeon({ takimlar, periyot }: Props) {
  const [acikTakim, setAcikTakim] = useState<string | null>(null);
  const [acikBolge, setAcikBolge] = useState<string | null>(null);
  const [bolgeler, setBolgeler] = useState<Record<string, HiyerarsiSatiri[] | 'loading'>>({});
  const [uttler, setUttler] = useState<Record<string, HiyerarsiSatiri[] | 'loading'>>({});

  const veriGetir = async (scope: 'bolge' | 'utt', ustBirimId: string) => {
    const params = new URLSearchParams({ scope, ust_birim_id: ustBirimId, periyot });
    const response = await fetch(`/raporlar/api/yonetici/akordeon?${params.toString()}`);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.mesaj ?? 'Veri alınamadı.');
    return (json.data ?? []) as HiyerarsiSatiri[];
  };

  const takimAc = async (takimId: string) => {
    if (acikTakim === takimId) {
      setAcikTakim(null);
      setAcikBolge(null);
      return;
    }
    setAcikTakim(takimId);
    setAcikBolge(null);
    if (!bolgeler[takimId]) {
      setBolgeler(mevcut => ({ ...mevcut, [takimId]: 'loading' }));
      try {
        const data = await veriGetir('bolge', takimId);
        setBolgeler(mevcut => ({ ...mevcut, [takimId]: data }));
      } catch {
        setBolgeler(mevcut => ({ ...mevcut, [takimId]: [] }));
      }
    }
  };

  const bolgeAc = async (bolgeId: string) => {
    if (acikBolge === bolgeId) {
      setAcikBolge(null);
      return;
    }
    setAcikBolge(bolgeId);
    if (!uttler[bolgeId]) {
      setUttler(mevcut => ({ ...mevcut, [bolgeId]: 'loading' }));
      try {
        const data = await veriGetir('utt', bolgeId);
        setUttler(mevcut => ({ ...mevcut, [bolgeId]: data }));
      } catch {
        setUttler(mevcut => ({ ...mevcut, [bolgeId]: [] }));
      }
    }
  };

  const satir = (
    item: HiyerarsiSatiri,
    seviye: 'takim' | 'bolge' | 'utt',
    acik: boolean,
    onClick?: () => void,
  ) => (
    <button
      type="button"
      key={item.birim_id}
      className={`${styles.hierarchyRow} ${styles[seviye]}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className={styles.hierarchyIdentity}>
        {onClick && (acik ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
        {!onClick && <span className={styles.rowDot} />}
        <span><strong>{item.birim_adi}</strong><small>{item.aktif_utt}/{item.toplam_utt} aktif UTT</small></span>
      </span>
      <span><strong>{format(item.tamamlanan_izleme)}</strong><small>oturum</small></span>
      <span className={styles.positive}><strong>+{format(item.kazanilan_toplam)}</strong><small>kazanım</small></span>
      <span className={styles.negative}><strong>−{format(item.kaybedilen_toplam)}</strong><small>kayıp</small></span>
      <span className={styles.netCell}><strong>{format(item.net_puan)}</strong><small>net puan</small></span>
    </button>
  );

  if (takimlar.length === 0) {
    return <div className={styles.empty}>Bu firma kapsamında takım bulunmuyor.</div>;
  }

  return <div className={styles.hierarchyList}>
    <div className={styles.hierarchyHead}><span>Takım / Bölge / UTT</span><span>Tamamlanan</span><span>Kazanım</span><span>Kayıp</span><span>Net</span></div>
    {takimlar.map(takim => {
      const takimAcik = acikTakim === takim.birim_id;
      const takimBolgeleri = bolgeler[takim.birim_id];
      return <div key={takim.birim_id}>
        {satir(takim, 'takim', takimAcik, () => takimAc(takim.birim_id))}
        {takimAcik && takimBolgeleri === 'loading' && <div className={styles.loadingRow}>Bölgeler hazırlanıyor…</div>}
        {takimAcik && Array.isArray(takimBolgeleri) && takimBolgeleri.map(bolge => {
          const bolgeAcik = acikBolge === bolge.birim_id;
          const bolgeUttleri = uttler[bolge.birim_id];
          return <div key={bolge.birim_id}>
            {satir(bolge, 'bolge', bolgeAcik, () => bolgeAc(bolge.birim_id))}
            {bolgeAcik && bolgeUttleri === 'loading' && <div className={styles.loadingRow}>UTT sonuçları hazırlanıyor…</div>}
            {bolgeAcik && Array.isArray(bolgeUttleri) && bolgeUttleri.map(utt => satir(utt, 'utt', false))}
          </div>;
        })}
      </div>;
    })}
  </div>;
}
