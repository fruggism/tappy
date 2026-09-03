import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const b64 = readFileSync("/root/.claude/uploads/7960e0c8-0870-541c-b80a-c102942e946a/6b03269e-image.png").toString("base64");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
console.log(await p.evaluate(async (b64) => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const x = Math.round(img.width * 0.5); // colonna centrale, passa per "Movimenti"
  const col = [];
  for (let y = img.height - 1; y >= 0; y--) {
    const [r, gg, bb] = g.getImageData(x, y, 1, 1).data;
    col.push({ y, r, g: gg, b: bb });
  }
  // dal fondo verso l'alto: quanto dura il colore di sfondo prima di cambiare
  // dal fondo verso l'alto: il primo pixel quasi bianco è il bordo della card
  let i = 0;
  while (i < col.length && !(col[i].r > 250 && col[i].g > 250 && col[i].b > 250)) i++;
  const dpr = 3;
  return JSON.stringify({
    dimensioni: [img.width, img.height],
    fondoCard_y_device: col[i] && col[i].y,
    spazioSottoLaCard_device: i,
    spazioSottoLaCard_css: +(i / dpr).toFixed(1),
    altezzaSchermo_css: +(img.height / dpr).toFixed(1),
  }, null, 1);
}, b64));
await b.close();
