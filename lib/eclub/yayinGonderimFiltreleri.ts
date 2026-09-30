import { eclubKisiHedefRolu } from "@/lib/utils/roller";
import type { OneriKisi, OneriYayin } from "@/app/(panel)/eclub/oneriler/_types";

export type GonderimFiltresi = "tumu" | "gonderilebilir" | "gonderilen";

export function yayinAlicisiUygun(kisi: OneriKisi, yayin: OneriYayin): boolean {
  const hedef = eclubKisiHedefRolu(kisi.rol);
  return kisi.aktif_mi && !!kisi.auth_user_id && !!hedef && yayin.hedef_roller.includes(hedef);
}

export function yayinAlicisiBekliyor(kisi: OneriKisi, yayin: OneriYayin,
  gonderilenKisiler: Readonly<Record<string, readonly string[]>>): boolean {
  return yayinAlicisiUygun(kisi, yayin) && !gonderilenKisiler[yayin.yayin_id]?.includes(kisi.kisi_id);
}

export function yayinGonderimListeleri(yayinlar: readonly OneriYayin[], kisiler: readonly OneriKisi[],
  gonderilenKisiler: Readonly<Record<string, readonly string[]>>) {
  const gonderilebilir = yayinlar.filter((yayin) => kisiler.some((kisi) =>
    yayinAlicisiBekliyor(kisi, yayin, gonderilenKisiler)));

  return {
    tumu: [...yayinlar],
    gonderilebilir,
    gonderilen: yayinlar.filter((yayin) => (gonderilenKisiler[yayin.yayin_id]?.length ?? 0) > 0),
  };
}
