"use client";


import { cn } from "@/lib/utils";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";
import { Check } from "lucide-react";
import { Popover, Tabs } from "radix-ui";
import { Children, isValidElement, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import styles from "./sade-kontroller.module.css";

export interface KontrolSecenegi<T extends string = string> {
  deger: T;
  etiket: string;
  altBilgi?: string;
  disabled?: boolean;
}

export function SadeAsagiOk({ className, ...props }: ComponentProps<"span">) {
  return <span {...props} aria-hidden="true" className={cn(styles.arrow, className)} />;
}

function filtrele<T extends string>(secenekler: readonly KontrolSecenegi<T>[], arama: string) {
  const sorgu = arama.trim().toLocaleLowerCase("tr-TR");
  return secenekler.filter((s) => `${s.etiket} ${s.altBilgi ?? ""}`.toLocaleLowerCase("tr-TR").includes(sorgu));
}

interface SecimProps<T extends string> {
  secenekler: readonly KontrolSecenegi<T>[];
  deger: T;
  onDegistir: (deger: T) => void;
  etiket: string;
  placeholder?: string;
  aramaEtiketi?: string;
  aranabilir?: boolean;
  disabled?: boolean;
  className?: string;
  varyant?: "kisi" | "tablo";
  triggerProps?: Omit<ComponentProps<"button">, "children" | "className" | "style" | "disabled">;
  gorunenEtiket?: string;
  altBilgiTetikleyicide?: boolean;
}

/** Kişi/kapsam ve tablo seçiminin ortak görünümü ve etkileşimi. */
export function SadeSecim<T extends string>({
  secenekler, deger, onDegistir, etiket, placeholder = "Seçiniz",
  aramaEtiketi = `${etiket} adıyla ara`, aranabilir = true, disabled = false,
  className, varyant = "kisi", triggerProps, gorunenEtiket, altBilgiTetikleyicide = true,
}: SecimProps<T>) {
  const [acik, setAcik] = useState(false);
  const [arama, setArama] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const secili = secenekler.find((s) => s.deger === deger);
  return <Popover.Root open={acik && !disabled} onOpenChange={(open) => { setAcik(open); setArama(""); }}>
    <Popover.Trigger asChild>
      <button {...triggerProps} type="button" aria-label={etiket} disabled={disabled} className={cn(styles.trigger, className)} data-variant={varyant === "tablo" ? "table" : "person"}>
        <span className={styles.value}><span className={styles.name}>{gorunenEtiket ?? secili?.etiket ?? placeholder}</span>{altBilgiTetikleyicide && secili?.altBilgi && <span className={styles.sub}>{secili.altBilgi}</span>}</span>
        <SadeAsagiOk />
      </button>
    </Popover.Trigger>
    <Popover.Portal><Popover.Content align="start" sideOffset={7} collisionPadding={12} aria-label={`${etiket} seçimi`} className={styles.menu}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        if (aranabilir) input.current?.focus();
        else liste.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled), button:not(:disabled)')?.focus();
      }}>
      {aranabilir && <input ref={input} type="search" className={styles.search} aria-label={aramaEtiketi} placeholder={aramaEtiketi} value={arama} onChange={(e) => setArama(e.target.value)} onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); liste.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); }
      }} />}
      <div ref={liste} className={styles.options} onKeyDown={(e) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        const buttons = Array.from(liste.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        if (!buttons.length) return;
        e.preventDefault();
        const index = buttons.indexOf(e.target as HTMLButtonElement);
        const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}>
        {filtrele(secenekler, arama).map((s) => <button type="button" key={s.deger} disabled={s.disabled} aria-pressed={s.deger === deger} className={styles.option} onClick={() => { setAcik(false); setArama(""); onDegistir(s.deger); }}>
          <span className={styles.value}><span className={styles.name}>{s.etiket}</span>{s.altBilgi && <span className={styles.sub}>{s.altBilgi}</span>}</span>
          {s.deger === deger && <Check size={16} aria-hidden="true" />}
        </button>)}
        {!filtrele(secenekler, arama).length && <p role="status" className={styles.empty}>Sonuç bulunamadı.</p>}
      </div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}

export function SadeTabloSecimi<T extends string>(props: Omit<SecimProps<T>, "varyant">) {
  return <SadeSecim {...props} varyant="tablo" />;
}

export function SadeKapsulFiltre<T extends string>({ secenekler, deger, onDegistir, etiket, className }: {
  secenekler: readonly KontrolSecenegi<T>[]; deger: T; onDegistir: (deger: T) => void; etiket: string; className?: string;
}) {
  return <div role="group" aria-label={etiket} className={cn(styles.capsule, className)}>
    {secenekler.map((s) => <button key={s.deger} type="button" aria-pressed={s.deger === deger} disabled={s.disabled} onClick={() => onDegistir(s.deger)}>{s.etiket}</button>)}
  </div>;
}

export function SadeZamanToggle({ deger, onDegistir, etiket = "Ölçüm zamanı", className }: {
  deger: Periyot; onDegistir: (deger: Periyot) => void; etiket?: string; className?: string;
}) {
  return <SadeKapsulFiltre secenekler={PERIYOTLAR.map((s) => ({ deger: s.key, etiket: s.label }))} deger={deger} onDegistir={onDegistir} etiket={etiket} className={className} />;
}

/** Sekme ve panel ilişkisi, odak ve ok tuşları Radix Tabs tarafından yönetilir. */
export function SadeSekmeler<T extends string>({ secenekler, deger, onDegistir, etiket, className }: {
  secenekler: readonly (KontrolSecenegi<T> & { icerik: ReactNode })[];
  deger: T; onDegistir: (deger: T) => void; etiket: string; className?: string;
}) {
  return <Tabs.Root value={deger} onValueChange={(value) => {
    const secenek = secenekler.find((s) => s.deger === value);
    if (secenek) onDegistir(secenek.deger);
  }}>
    <Tabs.List aria-label={etiket} className={cn(styles.tabs, className)}>
      {secenekler.map((s) => <Tabs.Trigger key={s.deger} value={s.deger} disabled={s.disabled}>{s.etiket}</Tabs.Trigger>)}
    </Tabs.List>
    {secenekler.map((s) => <Tabs.Content key={s.deger} value={s.deger}>{s.icerik}</Tabs.Content>)}
  </Tabs.Root>;
}

export function SadeCokluAliciSecimi<T extends string>({ secenekler, degerler, onDegistir, etiket = "Alıcı", disabled = false, className, aliciAdi = "alıcı", placeholder = "Alıcıları seçin", onAcikDegistir, yukleniyor = false }: {
  secenekler: readonly KontrolSecenegi<T>[]; degerler: readonly T[];
  onDegistir: (degerler: T[]) => void; etiket?: string; disabled?: boolean; className?: string;
  aliciAdi?: string; placeholder?: string; onAcikDegistir?: (acik: boolean) => void; yukleniyor?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [arama, setArama] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const uygunlar = secenekler.filter((s) => !s.disabled);
  const tumuSecili = uygunlar.length > 0 && uygunlar.every((s) => degerler.includes(s.deger));
  return <Popover.Root open={acik && !disabled} onOpenChange={(open) => { setAcik(open); setArama(""); onAcikDegistir?.(open); }}>
    <Popover.Trigger asChild><button type="button" disabled={disabled} aria-label={etiket} className={cn(styles.trigger, className)}>
      <span className={styles.name} aria-live="polite">{degerler.length ? `${degerler.length} ${aliciAdi} seçildi` : placeholder}</span><SadeAsagiOk />
    </button></Popover.Trigger>
    <Popover.Portal><Popover.Content align="start" sideOffset={7} collisionPadding={12} className={styles.menu} aria-label={`${etiket} seçimi`} onOpenAutoFocus={(e) => { e.preventDefault(); input.current?.focus(); }}>
      <input ref={input} type="search" aria-label={`${etiket} adıyla ara`} placeholder={`${etiket} adıyla ara`} className={styles.search} value={arama} onChange={(e) => setArama(e.target.value)} />
      {yukleniyor ? <p role="status" className={styles.empty}>Yükleniyor…</p> : <button type="button" className={styles.option} disabled={uygunlar.length === 0} onClick={() => onDegistir(tumuSecili ? [] : uygunlar.map((s) => s.deger))}>{tumuSecili ? "Seçimleri Kaldır" : `Tümünü Seç (${uygunlar.length})`}</button>}
      <div className={styles.options}>
        {!yukleniyor && filtrele(secenekler, arama).map((s) => <label key={s.deger} aria-disabled={s.disabled || undefined} className={cn(styles.option, styles.check)}>
          <input type="checkbox" disabled={s.disabled} checked={degerler.includes(s.deger)} onChange={(e) => onDegistir(e.target.checked ? [...degerler, s.deger] : degerler.filter((d) => d !== s.deger))} />
          <span>{s.etiket}{s.altBilgi && <span className={styles.sub}>{s.altBilgi}</span>}</span>
        </label>)}
        {!yukleniyor && !filtrele(secenekler, arama).length && <p role="status" className={styles.empty}>Sonuç bulunamadı.</p>}
      </div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}

/** İşlem ayı, ölçüm zamanı değildir; mevcut 2000–2199 aralığı korunur. */
export function SadeAySecimi({ deger, onDegistir, disabled = false, etiket = "Mutabakat Zamanı" }: {
  deger: string; onDegistir: (deger: string) => void; disabled?: boolean; etiket?: string;
}) {
  const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const [acik, setAcik] = useState(false);
  const [yil, setYil] = useState(Number(deger.slice(0, 4)));
  const seciliYil = Number(deger.slice(0, 4));
  const seciliAy = Number(deger.slice(5, 7));
  return <Popover.Root open={acik && !disabled} onOpenChange={(open) => { setAcik(open); if (open) setYil(seciliYil); }}>
    <Popover.Trigger asChild><button type="button" disabled={disabled} className={styles.trigger} aria-label={`${etiket}: ${aylar[seciliAy - 1]} ${seciliYil}`}>
      <span className={styles.name}>{etiket}: {aylar[seciliAy - 1]} {seciliYil}</span><SadeAsagiOk />
    </button></Popover.Trigger>
    <Popover.Portal><Popover.Content align="start" sideOffset={7} collisionPadding={12} className={styles.menu} aria-label={etiket}>
      <div className={styles.year}><button type="button" aria-label="Önceki yıl" disabled={yil <= 2000} onClick={() => setYil(yil - 1)}>‹</button><span>{yil}</span><button type="button" aria-label="Sonraki yıl" disabled={yil >= 2199} onClick={() => setYil(yil + 1)}>›</button></div>
      <div className={styles.months}>
        {aylar.map((ay, i) => <button type="button" key={ay} className={styles.option} aria-pressed={yil === seciliYil && seciliAy === i + 1} onClick={() => { onDegistir(`${yil}-${String(i + 1).padStart(2, "0")}`); setAcik(false); }}>{ay}</button>)}
      </div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}

/** Native form davranışını (required, name, FormData, klavye) korur. */
export function SadeFormSecimi({ etiket, className, id, ...props }: Omit<ComponentProps<"select">, "style"> & { etiket?: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <div className={cn(styles.field, className)}>
    {etiket && <label htmlFor={fieldId} className={styles.label}>{etiket}</label>}
    <div className={styles.fieldControl}><select {...props} id={fieldId} className={styles.native} /><SadeAsagiOk /></div>
  </div>;
}

/** Tarih aralığı, ölçüm zamanı seçeneklerinden bağımsızdır. */
export function SadeTarihAlani({ className, ...props }: Omit<ComponentProps<"input">, "style" | "type">) {
  return <input {...props} type="date" className={cn(styles.date, className)} />;
}

/** Mevcut option/optgroup verilerini ve select change sözleşmesini koruyan aramalı seçim. */
export function SadeListeSecimi({ children, value, defaultValue, onChange, className, varyant = "kisi", etiket, onClick, id, disabled, ...props }: Omit<ComponentProps<"select">, "style" | "multiple"> & {
  varyant?: "kisi" | "tablo"; etiket?: string;
}) {
  const native = useRef<HTMLSelectElement>(null);
  const [localValue, setLocalValue] = useState(String(defaultValue ?? ""));
  const secenekler: KontrolSecenegi[] = [];
  function metin(node: ReactNode): string {
    return Children.toArray(node).map((child) => isValidElement<{ children?: ReactNode }>(child) ? metin(child.props.children) : String(child)).join("");
  }
  function options(node: ReactNode, groupDisabled = false, groupLabel?: string) {
    Children.forEach(node, (child) => {
      if (!isValidElement<ComponentProps<"option"> & { children?: ReactNode }>(child)) return;
      if (child.type === "option") secenekler.push({ deger: String(child.props.value ?? metin(child.props.children)), etiket: child.props.label ?? metin(child.props.children), altBilgi: groupLabel, disabled: groupDisabled || child.props.disabled });
      else options(child.props.children, groupDisabled || child.props.disabled === true, child.props.label ?? groupLabel);
    });
  }
  options(children);
  const selected = value === undefined ? localValue || secenekler[0]?.deger || "" : String(value);
  const label = etiket ?? props["aria-label"] ?? secenekler[0]?.etiket ?? "Seçim";
  return <>
    <select {...props} ref={native} disabled={disabled} value={selected} onChange={onChange} aria-hidden="true" tabIndex={-1} className={styles.hiddenSelect}>{children}</select>
    <SadeSecim secenekler={secenekler} deger={selected} etiket={label} disabled={disabled} varyant={varyant} className={className}
      triggerProps={{ id, onClick: onClick ? (event) => { event.stopPropagation(); } : undefined }}
      onDegistir={(next) => {
        if (!native.current) return;
        native.current.value = next;
        native.current.dispatchEvent(new Event("change", { bubbles: true }));
        setLocalValue(next);
      }} />
  </>;
}

/** Sayfanın mevcut içerik ve kayıt akışını koruyan ortak kontrol grubu. */
export function SadeKontrolGrubu({ tur = "kapsul", className, onKeyDown, ...props }: Omit<ComponentProps<"div">, "style"> & { tur?: "kapsul" | "sekme" }) {
  return <div {...props} role={props.role ?? "group"} data-sade-grup={tur} className={cn(tur === "sekme" ? styles.tabs : styles.capsule, className)} onKeyDown={(event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-sade-kontrol]:not(:disabled)"));
    if (!buttons.length) return;
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus(); buttons[next]?.click();
  }} />;
}

export function SadeKontrolButonu({ className, ...props }: Omit<ComponentProps<"button">, "style">) {
  return <button {...props} type="button" data-sade-kontrol="true" className={cn(styles.controlButton, className)} />;
}

export function SadeIslemButonu({ className, type = "button", ...props }: Omit<ComponentProps<"button">, "style">) {
  return <button {...props} type={type} data-sade-kontrol="true" className={cn(styles.trigger, styles.controlButton, className)} />;
}

/** Özel veri yükleme/kayıt akışları da aynı seçim görünümünü kullanır. */
export function SadeSecimButonu({ children, className, ...props }: Omit<ComponentProps<"button">, "style">) {
  return <button {...props} type="button" className={cn(styles.trigger, className)}><span className={styles.value}>{children}</span><SadeAsagiOk /></button>;
}

export function SadeSecimMenusu({ className, ...props }: ComponentProps<typeof Popover.Content>) {
  return <Popover.Content {...props} sideOffset={7} collisionPadding={12} className={cn(styles.menu, className)} />;
}

export function SadeAramaAlani({ className, ...props }: Omit<ComponentProps<"input">, "style">) {
  return <input {...props} className={cn(styles.search, className)} />;
}

export function SadeSecimSecenegi({ className, ...props }: Omit<ComponentProps<"button">, "style">) {
  return <button {...props} type="button" className={cn(styles.option, className)} />;
}
