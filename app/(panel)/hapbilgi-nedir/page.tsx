import BilgiSayfaCercevesi from "@/components/panel/bilgi/BilgiSayfaCercevesi";
import OgrenmeZinciri from "@/components/panel/bilgi/OgrenmeZinciri";

export default function HapBilgiNedirSayfasi() {
  return (
    <BilgiSayfaCercevesi tur="hakkinda">
      <OgrenmeZinciri />
    </BilgiSayfaCercevesi>
  );
}
