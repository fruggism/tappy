#!/usr/bin/env node
// Genera i PNG dell'icona (manifest e schermata Home) da client/public/icona.svg.
// Si rilancia solo se l'icona cambia: i PNG stanno nel repository, così la
// build non dipende da un browser.
//
// Uso: node scripts/genera-icone.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(radice, "client/public/icona.svg"), "utf8");
const destinazione = join(radice, "client/public/icons");
mkdirSync(destinazione, { recursive: true });

const MISURE = [
  { file: "icon-192.png", lato: 192 },
  { file: "icon-512.png", lato: 512 },
  { file: "icon-180.png", lato: 180 }, // schermata Home di iOS
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

for (const { file, lato } of MISURE) {
  const pagina = await browser.newPage({ viewport: { width: lato, height: lato } });
  await pagina.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${lato}px;height:${lato}px}</style>${svg}`
  );
  await pagina.locator("svg").screenshot({ path: join(destinazione, file), omitBackground: false });
  await pagina.close();
  console.log(`  ${file} (${lato}×${lato})`);
}

await browser.close();
console.log("\nIcone generate in client/public/icons/");
