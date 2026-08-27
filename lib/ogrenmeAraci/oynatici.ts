import type { OgrenmeAraciMetadata, OgrenmeAraciTuru, TamamlamaKaniti } from "@/lib/ogrenmeAraci/tipler";

/** UI bileşenlerinin araçtan bağımsız bağlandığı istemci sözleşmesi. */
export interface OgrenmeAraciOynaticisi<TIlerleme extends Record<string, unknown>> {
  readonly aracTuru: OgrenmeAraciTuru;
  yukle(girdi: { erisimUrl: string; metadata: OgrenmeAraciMetadata; oncekiIlerleme: TIlerleme | null }): Promise<void>;
  baslat(): Promise<void>;
  ilerleme(): TIlerleme;
  tamamlanmaIstegi(): Promise<TamamlamaKaniti>;
  durdur(): Promise<void>;
  yokEt(): void;
}
