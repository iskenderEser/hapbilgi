import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";

export type HediyeTakipTuru = "cek" | "siparis";

const TAKIP_SECENEKLERI = [
  { key: "cek", label: "Çek Takip" },
  { key: "siparis", label: "Sipariş Takip" },
] as const;

export default function HediyeTakipToggle({
  deger,
  onDegistir,
}: {
  deger: HediyeTakipTuru;
  onDegistir: (deger: HediyeTakipTuru) => void;
}) {
  return (
    <PeriyotButonlari<HediyeTakipTuru>
      secenekler={TAKIP_SECENEKLERI}
      deger={deger}
      onDegistir={onDegistir}
      ariaLabel="Hediye takip türü"
      className="h-11 [&>button]:h-[34px] [&>button]:min-w-[116px] [&>button]:py-0"
    />
  );
}
