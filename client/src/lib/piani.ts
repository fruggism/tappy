export type TipoPiano = "subscription" | "installment" | "once";
export type Frequenza = "weekly" | "monthly" | "everyN";

export interface VoceStorico {
  da: string;
  importo: number;
}

export interface Piano {
  id: string;
  user_id: string;
  name: string;
  type: TipoPiano;
  amount: number;
  price_history: VoceStorico[];
  category_id: string | null;
  card_id: string | null;
  frequency: Frequenza;
  interval_months: number | null;
  start_date: string;
  end_date: string | null;
  review_date: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
}

export interface Occorrenza {
  date: string;
  importo: number;
  piano_id: string;
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function importoAl(piano: Piano, date: string): number {
  const storico = [...piano.price_history].sort((a, b) => a.da.localeCompare(b.da));
  let n = piano.amount;
  for (const voce of storico) {
    if (voce.da <= date) n = voce.importo;
  }
  return n;
}

function avanza(d: Date, piano: Piano): Date {
  const n = new Date(d);
  if (piano.frequency === "weekly") n.setDate(n.getDate() + 7);
  else if (piano.frequency === "everyN") n.setMonth(n.getMonth() + Math.max(1, piano.interval_months ?? 1));
  else n.setMonth(n.getMonth() + 1);
  return n;
}

export function occorrenzeConImporto(piano: Piano, from: string, to: string): Occorrenza[] {
  if (!piano.active) return [];
  if (piano.type === "once") {
    if (piano.start_date >= from && piano.start_date <= to) {
      return [{ date: piano.start_date, importo: importoAl(piano, piano.start_date), piano_id: piano.id }];
    }
    return [];
  }
  const out: Occorrenza[] = [];
  let cursore = parseIso(piano.start_date);
  const fine = piano.end_date ? parseIso(piano.end_date) : parseIso(to);
  const limite = parseIso(to);
  const inizio = parseIso(from);
  for (let i = 0; i < 240; i++) {
    if (cursore > fine || cursore > limite) break;
    if (cursore >= inizio) {
      const date = iso(cursore);
      out.push({ date, importo: importoAl(piano, date), piano_id: piano.id });
    }
    cursore = avanza(cursore, piano);
  }
  return out;
}

export function occorrenzePiani(piani: Piano[], from: string, to: string): Occorrenza[] {
  return piani.flatMap((p) => occorrenzeConImporto(p, from, to));
}

export function costoRicorrenteMensile(piani: Piano[]): number {
  return piani
    .filter((p) => p.active && p.type === "subscription")
    .reduce((s, p) => {
      if (p.frequency === "weekly") return s + (p.amount * 52) / 12;
      if (p.frequency === "everyN") return s + p.amount / Math.max(1, p.interval_months ?? 1);
      return s + p.amount;
    }, 0);
}

export function impegnoResiduo(piano: Piano, oggi: string): {
  rate: number;
  euro: number;
  fatte: number;
  totali: number;
  euroTotale: number;
  prossimo: string | null;
} {
  const vuoto = { rate: 0, euro: 0, fatte: 0, totali: 0, euroTotale: 0, prossimo: null as string | null };
  if (piano.type === "once") {
    const dovuto = piano.start_date >= oggi;
    return {
      rate: dovuto ? 1 : 0,
      euro: dovuto ? piano.amount : 0,
      fatte: dovuto ? 0 : 1,
      totali: 1,
      euroTotale: piano.amount,
      prossimo: dovuto ? piano.start_date : null,
    };
  }
  if (piano.type !== "installment" || !piano.end_date) return vuoto;
  const tutte = occorrenzeConImporto({ ...piano, active: true }, piano.start_date, piano.end_date);
  const future = tutte.filter((o) => o.date >= oggi);
  return {
    rate: future.length,
    euro: future.reduce((s, o) => s + o.importo, 0),
    fatte: tutte.length - future.length,
    totali: tutte.length,
    euroTotale: tutte.reduce((s, o) => s + o.importo, 0),
    prossimo: future[0]?.date ?? null,
  };
}

export function impegnoResiduoTotale(piani: Piano[], oggi: string): { rate: number; euro: number } {
  return piani
    .filter((p) => p.active && (p.type === "installment" || p.type === "once"))
    .map((p) => impegnoResiduo(p, oggi))
    .reduce((s, x) => ({ rate: s.rate + x.rate, euro: s.euro + x.euro }), { rate: 0, euro: 0 });
}

export function mappaGiorno(piani: Piano[], from: string, to: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of occorrenzePiani(piani, from, to)) {
    m.set(o.date, (m.get(o.date) ?? 0) + o.importo);
  }
  return m;
}

export function caricoPerMese(
  piani: Piano[],
  partenza: Date,
  quanti: number
): { chiave: string; etichetta: string; euro: number }[] {
  const mesi = ["G","F","M","A","M","G","L","A","S","O","N","D"];
  const out = [];
  for (let i = 0; i < quanti; i++) {
    const d = new Date(partenza.getFullYear(), partenza.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`;
    out.push({
      chiave: from,
      etichetta: mesi[m],
      euro: occorrenzePiani(piani, from, to).reduce((s, o) => s + o.importo, 0),
    });
  }
  return out;
}

export function congelarePrezzo(piano: Piano, importo: number, da: string): Piano {
  if (piano.amount === importo) return piano;
  const storico = [...piano.price_history].filter((v) => v.da !== da);
  storico.push({ da, importo });
  storico.sort((a, b) => a.da.localeCompare(b.da));
  return { ...piano, amount: importo, price_history: storico };
}

export function disdire(piano: Piano): Piano {
  return { ...piano, active: false };
}

export function riattivare(piano: Piano): Piano {
  return { ...piano, active: true };
}

export function formattaGiorno(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  const mesi = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  return `${Number(d)} ${mesi[Number(m) - 1]} ${y}`;
}

/** Quanti giorni interi da `from` a `date` (0 = lo stesso giorno). */
export function indiceNelPeriodo(from: string, date: string): number {
  return Math.round((parseIso(date).getTime() - parseIso(from).getTime()) / 86400000);
}

export function giorniConProgrammati(piani: Piano[], from: string, to: string): string[] {
  return [...new Set(occorrenzePiani(piani, from, to).map((o) => o.date))].sort();
}
