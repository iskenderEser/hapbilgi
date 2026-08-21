"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, House, LogOut, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  ad: string;
  onCikis: () => void | Promise<void>;
  onYenile?: () => void | Promise<void>;
  yenileniyor?: boolean;
}

const baglantilar = [
  { href: "/eczanem", etiket: "Ana Sayfa", ikon: House },
  { href: "/eczanem/puanlarim", etiket: "Puanlarım", ikon: Coins },
];

export default function EczanemMusteriNavbar({ ad, onCikis, onYenile, yenileniyor = false }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[#dfe7ef] bg-white/95 shadow-[0_2px_12px_rgba(30,55,85,0.04)] backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1240px] items-center gap-3 px-4 md:px-6">
        <Link href="/eczanem" aria-label="HapBilgi Eczanem ana sayfası" className="shrink-0">
          <Image src="/logo-acik-zemin.png" alt="HapBilgi" width={132} height={38} priority className="h-auto w-[108px] md:w-[126px]" />
        </Link>

        <nav aria-label="Müşteri menüsü" className="ml-1 flex min-w-0 flex-1 items-center gap-1 sm:ml-4">
          {baglantilar.map(({ href, etiket, ikon: Icon }) => {
            const aktif = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-extrabold transition sm:px-3 sm:text-xs ${aktif ? "bg-[#edf6fd] text-[#237ac8]" : "text-[#667b91] hover:bg-[#f4f7fa] hover:text-[#29425f]"}`}
              >
                <Icon className="size-3.5" />
                {etiket}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {onYenile && (
            <Button type="button" variant="ghost" size="icon" onClick={() => void onYenile()} disabled={yenileniyor} aria-label="Sayfayı yenile" title="Sayfayı yenile" className="size-9 text-[#667b91] hover:bg-[#f1f5f9] hover:text-[#237ac8]">
              <RefreshCw className={`size-4 ${yenileniyor ? "animate-spin" : ""}`} />
            </Button>
          )}
          <div className="hidden text-right md:block"><p className="max-w-36 truncate text-xs font-extrabold text-[#29425f]">{ad}</p><p className="text-[10px] font-semibold text-[#8a99aa]">Müşteri hesabı</p></div>
          <span className="hidden size-9 items-center justify-center rounded-xl bg-[#edf5fb] text-[#397fbf] sm:flex"><UserRound className="size-4" /></span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void onCikis()} className="h-9 px-2 text-xs font-extrabold text-[#667b91] hover:bg-[#f1f5f9] hover:text-[#29425f]"><LogOut className="size-4" /><span className="hidden lg:inline">Çıkış</span></Button>
        </div>
      </div>
    </header>
  );
}
