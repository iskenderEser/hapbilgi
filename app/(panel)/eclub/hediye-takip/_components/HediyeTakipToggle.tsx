import { SadeKontrolButonu, SadeKontrolGrubu } from "@/components/kontrol/SadeKontroller";
export type HediyeTakipTuru = "cek" | "siparis";

const TAKIP_SECENEKLERI = [
  { key: "cek", label: "Çek Takibi" },
  { key: "siparis", label: "Sipariş Takibi" },
] as const;

export default function HediyeTakipToggle({
  deger,
  onDegistir,
}: {
  deger: HediyeTakipTuru;
  onDegistir: (deger: HediyeTakipTuru) => void;
}) {
  const klavyeSecimi = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let hedefIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") hedefIndex = (index + 1) % TAKIP_SECENEKLERI.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") hedefIndex = (index - 1 + TAKIP_SECENEKLERI.length) % TAKIP_SECENEKLERI.length;
    else if (event.key === "Home") hedefIndex = 0;
    else if (event.key === "End") hedefIndex = TAKIP_SECENEKLERI.length - 1;
    else return;

    event.preventDefault();
    const hedef = TAKIP_SECENEKLERI[hedefIndex];
    onDegistir(hedef.key);
    const butonlar = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    butonlar?.[hedefIndex]?.focus();
  };

  return (
    <SadeKontrolGrubu role="tablist" aria-label="Hediye takip türü" tur="sekme">
      {TAKIP_SECENEKLERI.map((secenek, index) => {
        const aktif = deger === secenek.key;
        return (
          <SadeKontrolButonu key={secenek.key} id={`hediye-takip-${secenek.key}-sekmesi`} type="button" role="tab" aria-selected={aktif} aria-controls={`hediye-takip-${secenek.key}-paneli`} tabIndex={aktif ? 0 : -1} onClick={() => onDegistir(secenek.key)} onKeyDown={(event) => klavyeSecimi(event, index)}>
            {secenek.label}
          </SadeKontrolButonu>
        );
      })}
    </SadeKontrolGrubu>
  );
}
