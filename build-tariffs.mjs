// Onward laaddata: zet de laadpaaltarieven van NDW om naar één klein bestand voor de app.
// Draait elke nacht via GitHub Actions. Geen extra pakketten nodig (Node 20+).
//
// Bronnen (gratis open data van NDW):
//   https://opendata.ndw.nu/charging_point_tariffs_ocpi.json.gz   alle tarieven (OCPI 2.2.1)
//   https://opendata.ndw.nu/charging_point_locations.geojson.gz   alle openbare laadpalen
// Alleen tarieven die echt aan een openbare laadpaal hangen komen erin; dat scheelt 90%.
//
// Uitvoer: tariffs.json  →  { u: bijgewerkt, n: aantal, t: { tariefId: [kWh, start, perUur, vlaggen] } }
//   kWh     prijs per kWh incl. btw (EUR)
//   start   vast starttarief per laadsessie incl. btw (EUR)
//   perUur  tijdtarief per uur incl. btw (EUR), 0 als er geen tijdtarief is
//   vlaggen 1 = btw geschat (21%, niet in de bron),  2 = prijs verschilt per tijdstip, dag of vermogen
import { writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const TARIFFS = 'https://opendata.ndw.nu/charging_point_tariffs_ocpi.json.gz';
const LOCATIONS = 'https://opendata.ndw.nu/charging_point_locations.geojson.gz';
const NL_VAT = 21;
const r4 = (n)=> Math.round(n * 10000) / 10000;
// Beperkingen die de prijs echt laten wisselen. Een begin- of einddatum hoort daar niet bij:
// dat is alleen wanneer het tarief geldt.
const REAL = ['start_time','end_time','min_kwh','max_kwh','min_current','max_current','min_power','max_power','min_duration','max_duration','day_of_week','reservation'];

async function download(url){
  const res = await fetch(url, { headers: { 'User-Agent': 'onward-laaddata (github actions)' } });
  if(!res.ok) throw new Error(`Download mislukt (${url}): ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let text;
  try{ text = gunzipSync(buf).toString('utf8'); }
  catch{ text = buf.toString('utf8'); } // voor het geval de server het al uitgepakt aanlevert
  return JSON.parse(text);
}

const [tariffData, locations] = await Promise.all([download(TARIFFS), download(LOCATIONS)]);
const list = Array.isArray(tariffData) ? tariffData : (tariffData.data || tariffData.tariffs || []);
if(!Array.isArray(list) || !list.length) throw new Error('Geen tarieven gevonden in het bronbestand');
const features = (locations && locations.features) || [];
if(!features.length) throw new Error('Geen laadpalen gevonden in het locatiebestand');

// Welke tarieven gebruiken de openbare laadpalen?
const used = new Set();
for(const f of features){
  for(const a of ((f.properties || {}).availabilities || [])){
    for(const id of (a.tariff_ids || [])) used.add(id);
  }
}

const today = new Date().toISOString().slice(0, 10);
const realRestriction = (e)=> !!e.restrictions && REAL.some(k=>{ const v = e.restrictions[k]; return v != null && !(Array.isArray(v) && !v.length); });
const validToday = (e)=>{ const r = e.restrictions || {}; return (!r.start_date || r.start_date <= today) && (!r.end_date || r.end_date > today); };
const incl = (pc)=> Number(pc.price || 0) * (1 + ((pc.vat == null) ? NL_VAT : Number(pc.vat)) / 100);

const out = {};
let skipped = 0;
for(const t of list){
  if(!t || !t.id || !used.has(t.id)) continue;
  if(!Array.isArray(t.elements) || !t.elements.length || (t.currency || 'EUR') !== 'EUR'){ skipped++; continue; }
  if(t.end_date_time && Date.parse(t.end_date_time) < Date.now()){ skipped++; continue; }
  const els = t.elements.filter(validToday);
  if(!els.length){ skipped++; continue; }
  // Basistarief: het element zonder echte beperkingen, anders het eerste dat vandaag geldt
  const el = els.find(e=> !realRestriction(e)) || els[0];
  let kwh = 0, flat = 0, perHour = 0, flags = 0;
  for(const pc of (el.price_components || [])){
    if(pc.vat == null) flags |= 1;
    if(pc.type === 'ENERGY') kwh = incl(pc);
    else if(pc.type === 'FLAT') flat = incl(pc);
    else if(pc.type === 'TIME') perHour = incl(pc);         // OCPI: prijs per uur laden
  }
  // Een starttarief staat soms in een apart element
  if(!flat){ for(const e of els){ for(const pc of (e.price_components || [])){ if(pc.type === 'FLAT' && !flat) flat = incl(pc); } } }
  if(els.some(realRestriction)) flags |= 2;
  if(!kwh && !flat && !perHour){ skipped++; continue; }
  out[t.id] = [r4(kwh), r4(flat), r4(perHour), flags];
}

const result = { u: new Date().toISOString(), n: Object.keys(out).length, t: out };
const json = JSON.stringify(result);
if(result.n < 1000) throw new Error(`Verdacht weinig tarieven (${result.n}), bestand niet overschreven`);
writeFileSync('tariffs.json', json);
console.log(`Klaar: ${features.length} laadpalen, ${list.length} tarieven gelezen, ${result.n} bewaard (${(json.length/1e6).toFixed(2)} MB), ${skipped} overgeslagen.`);
