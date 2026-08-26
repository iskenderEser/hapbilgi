import BilgiSayfaCercevesi from "@/components/panel/bilgi/BilgiSayfaCercevesi";
import OgrenmeDongusu from "@/components/panel/bilgi/OgrenmeDongusu";

export default function NasilCalisirSayfasi() {
  return (
    <BilgiSayfaCercevesi tur="isleyis">
      <OgrenmeDongusu />
    </BilgiSayfaCercevesi>
  );
}
