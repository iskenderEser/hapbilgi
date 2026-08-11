import { analizKapsamYanit } from "@/lib/analiz/paylasilan/kapsamYanit";

export async function GET() {
  return analizKapsamYanit("tm");
}
