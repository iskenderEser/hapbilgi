import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import React, { act } from 'react';

const window = new Window({ url: 'http://localhost' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'NodeFilter', 'HTMLInputElement', 'HTMLButtonElement', 'MutationObserver', 'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: typeof window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? window[key].bind(window) : window[key] });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const { SadeSecim, SadeCokluAliciSecimi, SadeSekmeler, SadeFormSecimi } = await import('../components/kontrol/SadeKontroller');
const { default: TemsilciSecici } = await import('../components/raporlar/TemsilciSecici');
const { default: HbLigiPeriyotSecici } = await import('../components/hbligi/HbLigiPeriyotSecici');

async function mount(element) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  return { container, async close() { await act(async () => root.unmount()); container.remove(); } };
}
async function click(element) { assert.ok(element); await act(async () => element.click()); await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); }
async function key(element, key) { await act(async () => element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }))); }

test('Tekli seçim: arama, klavye, seçim, kapanma ve odağın geri dönmesi', async () => {
  let value = '';
  const view = await mount(React.createElement(SadeSecim, { secenekler: [{ deger: '1', etiket: 'Işıl' }, { deger: '2', etiket: 'İlker' }], deger: '', onDegistir: (v) => value = v, etiket: 'Kişi' }));
  const trigger = view.container.querySelector('button');
  await click(trigger);
  const input = document.querySelector('input[type=search]'); assert.ok(input);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(input, 'ışıl'); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
  assert.equal(document.querySelectorAll('button.option').length, 1);
  await key(input, 'ArrowDown'); assert.equal(document.activeElement.textContent, 'Işıl');
  await click(document.activeElement);
  assert.equal(value, '1'); assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.ok(document.activeElement === trigger, "Odak seçim butonuna dönmeli.");
  await view.close();
});

test('Çoklu alıcı: seçim menüyü kapatmaz; seçili sayı güncellenir; Escape kapatır', async () => {
  function Controlled() { const [values, setValues] = React.useState([]); return React.createElement(SadeCokluAliciSecimi, { secenekler: [{ deger: '1', etiket: 'Berk' }, { deger: '2', etiket: 'Can' }], degerler: values, onDegistir: setValues }); }
  const view = await mount(React.createElement(Controlled)); const trigger = view.container.querySelector('button');
  await click(trigger); await click(document.querySelector('input[type=checkbox]'));
  assert.equal(trigger.textContent, '1 alıcı seçildi'); assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  await key(document.querySelector('input[type=search]'), 'Escape');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false'); await view.close();
});

test('Sekme ok tuşuyla değişir ve doğru panel açılır', async () => {
  function Controlled() { const [value, setValue] = React.useState('a'); return React.createElement(SadeSekmeler, { secenekler: [{ deger: 'a', etiket: 'Bir', icerik: 'İlk içerik' }, { deger: 'b', etiket: 'İki', icerik: 'İkinci içerik' }], deger: value, onDegistir: setValue, etiket: 'Görünüm' }); }
  const view = await mount(React.createElement(Controlled)); const first = view.container.querySelector('[role=tab]');
  await act(async () => first.focus()); await key(first, 'ArrowRight'); await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  assert.equal(view.container.querySelector('[role=tab][aria-selected=true]').textContent, 'İki');
  assert.equal(view.container.querySelector('[role=tabpanel][data-state=active]').textContent, 'İkinci içerik'); await view.close();
});

test('Form alanı etiketi ve kayıt değeri korunur; BM bölge satırı kaldırılır; lig değerleri değişmez', async () => {
  let period = '';
  const view = await mount(React.createElement(React.Fragment, null,
    React.createElement('form', null, React.createElement(SadeFormSecimi, { etiket: 'Unvan', name: 'unvan', defaultValue: 'eczaci' }, React.createElement('option', {value: 'eczaci'}, 'Eczacı'))),
    React.createElement(TemsilciSecici, { temsilciler: [{kullanici_id:'1', ad:'Selin', soyad:'Yılmaz', altBilgi:'İzmir'}], deger:'1', onDegistir:()=>{}, adOneki:'BM ' }),
    React.createElement(HbLigiPeriyotSecici, { periyot:'ay', onPeriyotChange: (v)=>period=v })
  ));
  const select = view.container.querySelector('select'); assert.equal(view.container.querySelector('label').htmlFor, select.id);
  assert.equal(new window.FormData(view.container.querySelector('form')).get('unvan'), 'eczaci');
  assert.ok(!view.container.textContent.includes('İzmir'));
  const weekly = Array.from(view.container.querySelectorAll('button')).find(b=>b.textContent==='Haftalık'); await click(weekly); assert.equal(period, 'hafta');
  await view.close();
});

test('Mevcut option listesi aramalı seçimde value, optgroup ve change hedefini korur', async () => {
  const { SadeListeSecimi } = await import('../components/kontrol/SadeKontroller');
  let target;
  function Controlled() {
    const [value, setValue] = React.useState('');
    return React.createElement('form', null, React.createElement(SadeListeSecimi, {value, name:'kisi', etiket:'Kişi', onChange:(e)=>{ target=e.target; setValue(e.target.value); }},
      React.createElement('option', {value:''}, 'Tümü'),
      React.createElement('optgroup', {label:'Bölge'}, React.createElement('option', {value:'a'}, 'İlker'), React.createElement('option', {value:'b',disabled:true}, 'Pasif'))));
  }
  const view=await mount(React.createElement(Controlled));
  await click(view.container.querySelector('button'));
  await click(Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent.startsWith('İlker')));
  assert.equal(target.tagName,'SELECT'); assert.equal(target.value,'a');
  assert.equal(new window.FormData(view.container.querySelector('form')).get('kisi'),'a');
  assert.ok(view.container.querySelector('button').textContent.startsWith('İlker'));
  await view.close();
});

test('Ortak filtre grubunda ok tuşu devre dışı seçeneği atlayarak aynı kayıt işlevini çalıştırır', async () => {
  const { SadeKontrolGrubu, SadeKontrolButonu } = await import('../components/kontrol/SadeKontroller');
  let selected='a';
  const view=await mount(React.createElement(SadeKontrolGrubu, {tur:'sekme'},
    React.createElement(SadeKontrolButonu, {'aria-pressed':true,onClick:()=>selected='a'},'Bir'),
    React.createElement(SadeKontrolButonu, {disabled:true},'Pasif'),
    React.createElement(SadeKontrolButonu, {onClick:()=>selected='c'},'Üç')));
  await key(view.container.querySelector('button'),'ArrowRight');
  assert.equal(selected,'c'); assert.equal(document.activeElement.textContent,'Üç');
  await view.close();
});

test('İşlem ayı seçimi mevcut yıl aralığını ve YYYY-MM kayıt biçimini korur', async () => {
  const { SadeAySecimi } = await import('../components/kontrol/SadeKontroller');
  let month='';
  const view=await mount(React.createElement(SadeAySecimi,{deger:'2000-01',onDegistir:v=>month=v}));
  await click(view.container.querySelector('button'));
  assert.equal(document.querySelector('[aria-label="Önceki yıl"]').disabled,true);
  await click(document.querySelector('[aria-label="Sonraki yıl"]'));
  await click(Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent==='Şubat'));
  assert.equal(month,'2001-02');assert.equal(view.container.querySelector('button').getAttribute('aria-expanded'),'false');
  await view.close();
});

test('Çoklu alıcıda tümünü seç yalnız izinli alıcıları seçer ve liste açık kalır', async () => {
  let selected=[];
  const view=await mount(React.createElement(SadeCokluAliciSecimi,{secenekler:[{deger:'a',etiket:'İzinli'},{deger:'b',etiket:'Engelli',disabled:true}],degerler:[],onDegistir:v=>selected=v}));
  await click(view.container.querySelector('button'));
  await click(Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent.startsWith('Tümünü Seç')));
  assert.deepEqual(selected,['a']);assert.equal(view.container.querySelector('button').getAttribute('aria-expanded'),'true');
  assert.equal(document.querySelectorAll('input[type=checkbox]')[1].disabled,true);
  await view.close();
});

test('Tekli seçim dışarı tıklama ve Escape ile kapanır; devre dışı seçenek seçilemez', async () => {
  let changes=0;
  const view=await mount(React.createElement(SadeSecim,{secenekler:[{deger:'a',etiket:'İzinli'},{deger:'b',etiket:'Engelli',disabled:true}],deger:'a',etiket:'Kişi',onDegistir:()=>changes++}));
  const trigger=view.container.querySelector('button');
  try {
    await click(trigger);
    await click(Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent==='Engelli'));
    assert.equal(changes,0);
    await key(document.querySelector('input[type=search]'),'Escape');
    assert.equal(trigger.getAttribute('aria-expanded'),'false');
    // Radix, panel kaldırıldıktan sonra odağı bir sonraki zamanlayıcıda geri verir.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.ok(document.activeElement === trigger, "Odak seçim butonuna dönmeli.");
    await click(trigger);
    const outside=document.createElement('button');outside.textContent='Dış alan';document.body.append(outside);
    try {
      await act(async()=>{
        outside.dispatchEvent(new window.PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse'}));
        outside.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true}));
        outside.click();
      });
      assert.equal(trigger.getAttribute('aria-expanded'),'false');
      assert.equal(changes,0);
    } finally {outside.remove();}
  } finally {await view.close();}
});

test('Çoklu alıcı araması boş sonuç gösterir; arama temizlenince seçim korunur', async () => {
  function Controlled(){const [values,setValues]=React.useState(['a']);return React.createElement(SadeCokluAliciSecimi,{secenekler:[{deger:'a',etiket:'Işıl'},{deger:'b',etiket:'İlker'}],degerler:values,onDegistir:setValues});}
  const view=await mount(React.createElement(Controlled));
  try {
    await click(view.container.querySelector('button'));
    const input=document.querySelector('input[type=search]');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    const search=async(value)=>act(async()=>{setter.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});
    await search('ışıl');
    assert.equal(document.querySelectorAll('input[type=checkbox]').length,1);
    assert.equal(document.querySelector('input[type=checkbox]').checked,true);
    await search('bulunmayan kişi');
    assert.equal(document.querySelectorAll('input[type=checkbox]').length,0);
    assert.match(document.querySelector('[role=status]').textContent,/Sonuç bulunamadı/);
    await search('');
    assert.equal(document.querySelectorAll('input[type=checkbox]').length,2);
    assert.equal(document.querySelector('input[type=checkbox]').checked,true);
    await click(Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent.startsWith('Tümünü Seç')));
    assert.equal(view.container.querySelector('button').textContent,'2 alıcı seçildi');
    await click(Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent==='Seçimleri Kaldır'));
    assert.equal(view.container.querySelector('button').textContent,'Alıcıları seçin');
    assert.equal(view.container.querySelector('button').getAttribute('aria-expanded'),'true');
  } finally {await view.close();}
});

test('Yerel seçim callback’i yalnız bir kez çalışır; dış kapsam sıfırlanınca görünen değer ve form kaydı güncellenir', async()=>{
  const {SadeListeSecimi}=await import('../components/kontrol/SadeKontroller');
  let changes=0;
  function Controlled(){const [value,setValue]=React.useState('a');return React.createElement('form',null,
    React.createElement('button',{type:'button',onClick:()=>setValue('')},'Sıfırla'),
    React.createElement(SadeListeSecimi,{name:'utt',etiket:'UTT',value,onChange:e=>{changes++;setValue(e.target.value);}},
      React.createElement('option',{value:''},'Tüm UTT’ler'),React.createElement('option',{value:'a'},'Selin'),React.createElement('option',{value:'b'},'Deniz')));}
  const view=await mount(React.createElement(Controlled));
  try{
    await click(view.container.querySelector('[aria-label=UTT]'));
    await click(Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent==='Deniz'));
    assert.equal(changes,1);
    assert.equal(new window.FormData(view.container.querySelector('form')).get('utt'),'b');
    await click(view.container.querySelector('button'));
    assert.equal(view.container.querySelector('[aria-label=UTT]').textContent,'Tüm UTT’ler');
    assert.equal(new window.FormData(view.container.querySelector('form')).get('utt'),'');
    assert.equal(changes,1);
  }finally{await view.close();}
});

test('Ortak tarih alanı tarih sınırlarını ve filtre değişikliğini korur', async () => {
  const { SadeTarihAlani } = await import('../components/kontrol/SadeKontroller');
  let selected='';
  const view=await mount(React.createElement('form',null,React.createElement(SadeTarihAlani,{name:'baslangic',defaultValue:'2026-10-01',min:'2026-09-01',max:'2026-10-31',onChange:e=>selected=e.target.value})));
  try {
    const input=view.container.querySelector('input');
    assert.equal(input.type,'date');assert.equal(input.min,'2026-09-01');assert.equal(input.max,'2026-10-31');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    await act(async()=>{setter.call(input,'2026-10-08');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
    assert.equal(selected,'2026-10-08');assert.equal(new window.FormData(view.container.querySelector('form')).get('baslangic'),'2026-10-08');
  } finally {await view.close();}
});

test('Hediye Takibi sekme seçimi klavyeyle değişir ve panel ilişkisi korunur', async () => {
  const { default: HediyeTakipToggle } = await import('../app/(panel)/eclub/hediye-takip/_components/HediyeTakipToggle');
  function Controlled(){const [value,setValue]=React.useState('cek');return React.createElement(HediyeTakipToggle,{deger:value,onDegistir:setValue});}
  const view=await mount(React.createElement(Controlled));
  try {
    const tabs=view.container.querySelectorAll('[role=tab]');
    assert.equal(tabs[0].getAttribute('aria-selected'),'true');
    await key(tabs[0],'ArrowRight');
    assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.equal(tabs[0].getAttribute('aria-selected'),'false');
    assert.equal(tabs[1].getAttribute('aria-controls'),'hediye-takip-siparis-paneli');assert.ok(document.activeElement===tabs[1]);
  } finally {await view.close();}
});

test('Kişi isimlerinde şirket rolleri kaldırılır; yalnız Ecz. ve Ecz.Tekn. önekleri korunur', async () => {
  const { kisiGorunenAdi } = await import('../components/kontrol/KisiKontroller');
  for (const rol of ['bm','pm','tm','utt','kd_utt','iu','gm',undefined]) assert.equal(kisiGorunenAdi('  Selin   Yılmaz ',rol),'Selin Yılmaz');
  for (const rol of ['eczaci','ikinci_eczaci','yardimci_eczaci']) assert.equal(kisiGorunenAdi('Selin Yılmaz',rol),'Ecz. Selin Yılmaz');
  assert.equal(kisiGorunenAdi('Selin Yılmaz','eczane_teknisyeni'),'Ecz.Tekn. Selin Yılmaz');
});

test('Kişi filtresi başlık, tümünü seçme ve kayıt kimliğini korur; ek bilgi yalnız menüde görünür', async () => {
  const { SadeKisiSecimi } = await import('../components/kontrol/KisiKontroller');
  let changed='';
  function Controlled(){const [deger,setDeger]=React.useState('');return React.createElement(SadeKisiSecimi,{baslik:'Kullanıcılar',bosSecenekEtiketi:'Tüm Kullanıcılar',kisiler:[{deger:'id-1',adSoyad:'Selin Yılmaz',rol:'bm',altBilgi:'Pasif'}],deger,onDegistir:id=>{changed=id;setDeger(id);}});}
  const view=await mount(React.createElement(Controlled));
  try {
    const trigger=view.container.querySelector('button');assert.equal(trigger.textContent,'Kullanıcılar');
    await click(trigger);
    assert.ok(Array.from(document.querySelectorAll('button.option')).some(b=>b.textContent==='Tüm Kullanıcılar'));
    const person=Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent==='Selin YılmazPasif');assert.ok(person);
    await click(person);assert.equal(changed,'id-1');assert.equal(trigger.textContent,'Selin Yılmaz');
    await click(trigger);await click(Array.from(document.querySelectorAll('button.option')).find(b=>b.textContent==='Tüm Kullanıcılar'));
    assert.equal(changed,'');assert.equal(trigger.textContent,'Kullanıcılar');
  } finally {await view.close();}
});

test('Otomatik temsilci seçimi ilk başlıkta gizlenir; kullanıcı seçimi veri kapsamını değiştirmeden adı gösterir', async () => {
  const { SadeKisiSecimi } = await import('../components/kontrol/KisiKontroller');
  let changed=null;
  function Controlled(){const [secildi,setSecildi]=React.useState(false);return React.createElement(SadeKisiSecimi,{baslik:'Temsilciler',bosSecenekEtiketi:false,baslikGoster:!secildi,kisiler:[{deger:'utt-1',adSoyad:'Berk Kılıç'}],deger:'utt-1',onDegistir:id=>{changed=id;setSecildi(true);}});}
  const view=await mount(React.createElement(Controlled));
  try {
    const trigger=view.container.querySelector('button');assert.equal(trigger.textContent,'Temsilciler');assert.equal(changed,null);
    await click(trigger);const options=document.querySelectorAll('button.option');assert.equal(options.length,1);assert.equal(options[0].getAttribute('aria-pressed'),'true');
    await click(options[0]);assert.equal(changed,'utt-1');assert.equal(trigger.textContent,'Berk Kılıç');
  } finally {await view.close();}
});

test('Çoklu kişi seçimi unvansız ad, eczane önekleri ve seçili kişi sayısını ortak kuralla gösterir', async () => {
  const { SadeKisiCokluSecimi } = await import('../components/kontrol/KisiKontroller');
  function Controlled(){const [values,setValues]=React.useState([]);return React.createElement(SadeKisiCokluSecimi,{baslik:'Alıcılar',kisiler:[{deger:'bm',adSoyad:'Deniz Çetin',rol:'bm'},{deger:'ecz',adSoyad:'Selin Yılmaz',rol:'eczaci'},{deger:'tekn',adSoyad:'Berk Kılıç',rol:'eczane_teknisyeni',disabled:true}],degerler:values,onDegistir:setValues});}
  const view=await mount(React.createElement(Controlled));
  try {
    const trigger=view.container.querySelector('button');assert.equal(trigger.textContent,'Alıcılar');await click(trigger);
    const labels=Array.from(document.querySelectorAll('label.check')).map(e=>e.textContent);
    assert.deepEqual(labels,['Deniz Çetin','Ecz. Selin Yılmaz','Ecz.Tekn. Berk Kılıç']);
    await click(document.querySelector('input[type=checkbox]'));assert.equal(trigger.textContent,'1 kişi seçildi');assert.equal(document.querySelectorAll('input[type=checkbox]')[2].disabled,true);
  } finally {await view.close();}
});
