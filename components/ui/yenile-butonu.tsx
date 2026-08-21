"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface YenileButonuProps {
  yenileniyor: boolean;
  onYenile: () => void | Promise<void>;
  disabled?: boolean;
  etiket?: string;
  className?: string;
}

/** Sayfa state'ini koruyarak yalnız uzak veriyi yenileyen ortak panel aksiyonu. */
export function YenileButonu({
  yenileniyor,
  onYenile,
  disabled = false,
  etiket = "Yenile",
  className,
}: YenileButonuProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || yenileniyor}
      aria-busy={yenileniyor}
      onClick={() => void onYenile()}
      className={cn("border-[#d8e3ee] bg-white font-bold text-[#58708b] hover:bg-[#f4f8fb]", className)}
    >
      <RefreshCw className={yenileniyor ? "animate-spin" : ""} />
      {yenileniyor ? "Yenileniyor…" : etiket}
    </Button>
  );
}
