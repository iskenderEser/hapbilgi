// components/SenaryoDuzeltmeEditoru.tsx
//
// IU'nun revizyon editörü (İskender talebi, 20.07): IU düzeltme yaparken
// silme OLMAZ — sildiği yer anında üstü çizili kalır, yazdığı yer anında
// kırmızı bantla görünür. Tüm girişler modele yönlendirilir (native DOM
// düzenlemesi engellenir); gönderilecek temiz metin onDegisti ile dışarı
// verilir. Taslak (model) localStorage'da tutulur, temel metin değişirse düşer.

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DuzeltmeKarakter, modelOlustur, yaziEkle, geriSil, ileriSil, aralikSil,
  temizMetin, runlar, seriyeAl, seridenModel,
} from "@/lib/utils/senaryo/duzeltmeModeli";

interface Props {
  temelMetin: string;
  taslakAnahtari: string;
  onDegisti: (temiz: string) => void;
}

export function SenaryoDuzeltmeEditoru({ temelMetin, taslakAnahtari, onDegisti }: Props) {
  const [model, setModel] = useState<DuzeltmeKarakter[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(taslakAnahtari);
        if (raw) {
          const kayitli = seridenModel(raw, temelMetin);
          if (kayitli) return kayitli;
        }
      } catch { /* taslak okunamazsa temelden başlanır */ }
    }
    return modelOlustur(temelMetin);
  });
  const divRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef(model);
  const caretRef = useRef<number | null>(null);

  const caretHesapla = (): { start: number; end: number } | null => {
    const div = divRef.current;
    const sel = window.getSelection();
    if (!div || !sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!div.contains(range.startContainer) || !div.contains(range.endContainer)) return null;
    // div başından (node, offset) noktasına kadar olan metnin uzunluğu =
    // karakter indeksi. Range.toString tüm düğüm türlerini doğru ölçer.
    const offsetOf = (node: Node, offset: number): number => {
      const olcum = document.createRange();
      olcum.selectNodeContents(div);
      try { olcum.setEnd(node, offset); } catch { return 0; }
      return olcum.toString().length;
    };
    const a = offsetOf(range.startContainer, range.startOffset);
    const b = offsetOf(range.endContainer, range.endOffset);
    return a <= b ? { start: a, end: b } : { start: b, end: a };
  };

  const caretYerlestir = (pos: number) => {
    const div = divRef.current;
    const sel = window.getSelection();
    if (!div || !sel) return;
    let kalan = pos;
    let hedef: Node | null = null;
    let off = 0;
    const w = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const len = n.textContent?.length ?? 0;
      if (kalan <= len) { hedef = n; off = kalan; break; }
      kalan -= len;
    }
    const r = document.createRange();
    if (hedef) { r.setStart(hedef, off); r.collapse(true); }
    else { r.selectNodeContents(div); r.collapse(false); }
    sel.removeAllRanges();
    sel.addRange(r);
  };

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    const guncelle = (yeni: DuzeltmeKarakter[], caret: number) => {
      caretRef.current = caret;
      modelRef.current = yeni;
      setModel(yeni);
    };
    const handler = (e: Event) => {
      const ev = e as InputEvent;
      ev.preventDefault(); // native DOM asla değişmez — tek gerçek: model
      const sec = caretHesapla();
      if (!sec) return;
      const m = modelRef.current;
      const t = ev.inputType;
      if (t === "insertText" || t === "insertParagraph" || t === "insertLineBreak" || t === "insertFromPaste") {
        let ara = { model: m, caret: sec.start };
        if (sec.start !== sec.end) ara = aralikSil(m, sec.start, sec.end);
        const metin =
          t === "insertText" ? (ev.data ?? "") :
          t === "insertFromPaste" ? (ev.dataTransfer?.getData("text/plain") ?? "") : "\n";
        if (!metin) { guncelle(ara.model, ara.caret); return; }
        const son = yaziEkle(ara.model, ara.caret, metin);
        guncelle(son.model, son.caret);
      } else if (t.startsWith("delete")) {
        if (sec.start !== sec.end) {
          const x = aralikSil(m, sec.start, sec.end);
          guncelle(x.model, x.caret);
        } else if (t.includes("Forward")) {
          const x = ileriSil(m, sec.start);
          guncelle(x.model, x.caret);
        } else {
          const x = geriSil(m, sec.start);
          guncelle(x.model, x.caret);
        }
      }
      // diğer girişler (undo/redo, biçimlendirme) yok sayılır
    };
    div.addEventListener("beforeinput", handler);
    return () => div.removeEventListener("beforeinput", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (caretRef.current !== null) {
      caretYerlestir(caretRef.current);
      caretRef.current = null;
    }
  }, [model]);

  useEffect(() => {
    modelRef.current = model;
    onDegisti(temizMetin(model));
    const z = setTimeout(() => {
      try { localStorage.setItem(taslakAnahtari, seriyeAl(model, temelMetin)); } catch { /* dolu/kapalı depolama */ }
    }, 1000);
    return () => clearTimeout(z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const parcalar = runlar(model);

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white mb-2.5"
      style={{
        fontFamily: "'Nunito', sans-serif",
        whiteSpace: "pre-wrap",
        minHeight: 144,
        maxHeight: 480,
        overflowY: "auto",
        outline: "none",
        cursor: "text",
        lineHeight: 1.6,
      }}
    >
      {parcalar.map((r, i) =>
        r.tur === "ekle" ? (
          <span key={i} style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 3 }}>{r.metin}</span>
        ) : r.tur === "cikar" ? (
          <span key={i} style={{ textDecoration: "line-through", color: "#9ca3af" }}>{r.metin}</span>
        ) : (
          <span key={i}>{r.metin}</span>
        )
      )}
    </div>
  );
}
