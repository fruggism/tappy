# G4 — Vista mappa "Dove ho speso"

Spec e note di implementazione della heatmap dei pagamenti. Il codice è già
in `client/src/views/Mappa.tsx` e `client/src/components/HeatLayer.ts`:
questo documento spiega **perché è fatto così**, per chi ci tornerà sopra.

## Come ci si entra

Un'icona a mappa accanto a "Registra spesa", in Movimenti. La vista si apre a
tutto schermo e si chiude con la freccia in alto a sinistra.

Sta in una vista propria e non dentro Movimenti perché quel file è in corso
di riscrittura dal pacchetto grafico: da lì arriva **una riga sola**, il
pulsante. È l'unica scelta che tiene i due lavori separati.

## Periodo

Selettore a tre posizioni — **Giorno / Mese / Anno** — più due frecce per
spostarsi indietro. Non si va nel futuro: la freccia avanti è disabilitata sul
periodo corrente. Cambiando periodo si torna a "oggi", perché "tre mesi fa"
non ha un equivalente ovvio quando si passa da mese ad anno.

L'inquadratura si adatta ai punti del periodo (`fitBounds`, zoom massimo 15):
si guarda sempre l'area giusta senza cercarla a mano.

## Cosa entra nella heatmap

Solo le **uscite con posizione**. Le entrate non sono "dove ho speso"; le
spese senza coordinate non compaiono — ed è il motivo della riga in fondo:

> *3 spese di questo periodo non sono sulla mappa: non hanno una posizione.*

Senza quella riga la heatmap si leggerebbe come il quadro completo, mentre
può esserne una parte. È informazione, non una scusa.

Il **peso** di ogni punto è `my_share`, non `amount`: sulla mappa deve pesare
quello che è uscito dalle tue tasche, come in tutto il resto dell'app.

## La palette

Dal freddo al caldo nel linguaggio di tappy: ciano dove si è passati poco,
verde, ambra, **rosa** dove si è speso di più — lo stesso rosa che altrove
segnala lo sforamento. Le fermate stanno sull'**intensità cumulata**, non
sull'importo: due caffè presi nello stesso posto scaldano quanto una spesa
media, che è esattamente ciò che una heatmap deve dire.

I punti freddi restano semitrasparenti: sotto c'è una mappa, e coprirla
significherebbe perdere il senso della vista.

## Perché il livello heat è scritto a mano

Di Leaflet serve la mappa — tessere, pan, zoom, proiezione — che non ha senso
riscrivere. La heatmap invece è una manciata di gradienti radiali: scriverla
costa poco e ci lascia **la palette di tappy** invece del blu-rosso generico
che portano gli strati heat già pronti, che qui stonerebbe.

Il canvas copre la finestra, non il mondo, e si ridisegna a movimento finito.
Durante il trascinamento si nasconde: una heatmap sfasata rispetto alle
tessere è peggio di nessuna heatmap.

## Tema scuro

Le tessere di OpenStreetMap esistono solo chiare, quindi sul tema scuro si
invertono. Il filtro va **sulle sole tessere** (`.mappa-scura
.leaflet-tile-pane`): applicato al contenitore invertirebbe anche i colori
della heatmap, cioè la cosa che deve restare riconoscibile. Attribuzione e
controlli restano fuori dal filtro e sono vestiti a mano.

## Attribuzione

`© OpenStreetMap` è sempre visibile sulla mappa. Non è un dettaglio grafico:
è la condizione a cui si usano le tessere pubbliche, che sono gratuite per usi
personali e non vanno martellate.

## Peso

Leaflet è caricato **solo quando si apre la mappa** (`lazy` + `Suspense`).
L'app resta a ~75 KB gzip; la mappa aggiunge un blocco separato da ~46 KB che
chi non la apre non scarica mai.

## Cosa manca ancora

- **I dati veri.** Finché l'automazione non manda le coordinate (G3), la
  mappa è alimentata solo dai dati finti, che generano poli plausibili con
  una spesa su cinque senza posizione.
- **Cancellare una posizione** dal dettaglio di un movimento: il backend lo
  supporta già (`updateTransaction` accetta `null`), l'interfaccia no.
  Va fatto prima di considerare chiusa la Fase 5 — è la contropartita di
  registrare dove si è stati.
- **Toccare un punto caldo** per vedere le spese di quel luogo: non c'è, e
  con Leaflet costa poco. Da valutare quando ci saranno dati veri.
