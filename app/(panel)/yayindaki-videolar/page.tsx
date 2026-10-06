import { redirect } from "next/navigation";

// Öneri Takibi'ndeki bağlantı ilk eğitim kategorisini açar.
export default function EgitimYayinlariPage() {
  redirect("/yayindaki-videolar/urun");
}
