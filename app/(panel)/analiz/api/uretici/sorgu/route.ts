import { NextRequest } from "next/server";
import { analizSorguYanit } from "@/lib/analiz/paylasilan/sorguYanit";

export async function POST(request: NextRequest) {
  return analizSorguYanit(request, "uretici");
}
