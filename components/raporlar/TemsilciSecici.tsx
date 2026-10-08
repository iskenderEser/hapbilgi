'use client';

import { useState } from 'react';
import { Popover } from 'radix-ui';
import { ChevronDown, Check } from 'lucide-react';

export default function TemsilciSecici({ temsilciler, deger, onDegistir, genelAdi = 'Bölge Geneli', etiket = 'Rapor kapsamı', aramaEtiketi = 'Temsilci adıyla ara', disabled = false, adOneki = '' }: {
  temsilciler: Array<{ kullanici_id: string; ad: string; soyad: string; altBilgi?: string }>;
  genelAdi?: string; etiket?: string; aramaEtiketi?: string; disabled?: boolean; adOneki?: string;
  deger: string;
  onDegistir: (id: string) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [arama, setArama] = useState('');
  const secili = temsilciler.find(k => k.kullanici_id === deger);
  const sec = (id: string) => { onDegistir(id); setAcik(false); setArama(''); };
  const filtreli = temsilciler.filter(k => `${k.ad} ${k.soyad}`.toLocaleLowerCase('tr').includes(arama.toLocaleLowerCase('tr').trim()));
  return <Popover.Root open={acik} onOpenChange={setAcik}>
    <Popover.Trigger asChild>
      <button type="button" aria-label={etiket} disabled={disabled} className="inline-flex h-10 max-w-full items-center gap-2 rounded-[14px] border border-[rgba(148,163,184,.18)] bg-white/85 px-3 text-[13px] font-extrabold text-[#237ac8] shadow-[0_6px_22px_rgba(36,64,98,.05)] disabled:cursor-default disabled:opacity-50">
        <span className="min-w-0 text-left"><span className="block truncate leading-4">{secili ? `${adOneki}${secili.ad} ${secili.soyad}` : genelAdi}</span>{secili?.altBilgi && <span className="block truncate text-[11px] font-semibold leading-3 text-[#7b8da3]">{secili.altBilgi}</span>}</span><ChevronDown size={14} className="shrink-0" />
      </button>
    </Popover.Trigger>
    <Popover.Portal><Popover.Content align="start" sideOffset={6} aria-label={`${etiket} seçimi`} className="z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-[#dbe5ef] bg-white p-2 shadow-lg" onEscapeKeyDown={() => setArama('')}>
      <input aria-label={aramaEtiketi} placeholder={aramaEtiketi} value={arama} onChange={e => setArama(e.target.value)} className="mb-2 w-full rounded-lg border border-[#dbe5ef] px-3 py-2 text-sm outline-none focus:border-[#237ac8]" />
      <div className="max-h-64 overflow-y-auto">
        {[{ kullanici_id: '', ad: genelAdi, soyad: '', altBilgi: undefined }, ...filtreli].map(k => <button key={k.kullanici_id} type="button" aria-pressed={deger === k.kullanici_id} onClick={() => sec(k.kullanici_id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#203653] hover:bg-[#edf6ff] focus:bg-[#edf6ff]">
          <span className="min-w-0"><span className="block">{k.kullanici_id ? adOneki : ''}{k.ad} {k.soyad}</span>{k.altBilgi && <span className="block text-xs text-[#7b8da3]">{k.altBilgi}</span>}</span>{deger === k.kullanici_id && <Check size={16} className="text-[#237ac8]" />}
        </button>)}
        {!filtreli.length && <p className="px-3 py-2 text-xs text-gray-500">Sonuç bulunamadı.</p>}
      </div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
