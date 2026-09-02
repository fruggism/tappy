#!/usr/bin/env node
// Crea un nuovo utente tappy su Airtable con le 4 categorie di default,
// identificato dal suo codice frupas.
//
// Uso:
//   AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... node scripts/seed-user.js "Nome"
//   AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... node scripts/seed-user.js "Nome" 7K4P9Q2R
//
// Se non passi un codice, ne viene generato uno nuovo (8 caratteri,
// leggibile, senza caratteri ambigui come 0/O/1/I/L) — utile finché frupas
// non è ancora un servizio di identità centralizzato condiviso dalle app.
// Se invece l'utente ha già un codice frupas assegnato altrove
// nell'ecosistema, passalo come secondo argomento: tappy lo userà così com'è.

const Airtable = require("airtable");
const crypto = require("crypto");

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const name = process.argv[2];
const requestedCode = process.argv[3];

if (!apiKey || !baseId) {
  console.error("Imposta AIRTABLE_API_KEY e AIRTABLE_BASE_ID nell'ambiente.");
  process.exit(1);
}
if (!name) {
  console.error('Uso: node scripts/seed-user.js "Nome utente" [codice-frupas]');
  process.exit(1);
}

const base = new Airtable({ apiKey }).base(baseId);

const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateFrupasCode() {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  }
  return code;
}

function normalizeFrupasCode(code) {
  return String(code).toUpperCase().replace(/[\s-]/g, "");
}

function formatForDisplay(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

const DEFAULT_CATEGORIES = [
  { name: "Spesa", color: "#39ff88", icon: "cart" },
  { name: "Macchina", color: "#00e5ff", icon: "car" },
  { name: "Leisure", color: "#ff2ecb", icon: "sparkles" },
  { name: "Altro", color: "#a3a3ff", icon: "dots" },
];

async function main() {
  const frupasCode = normalizeFrupasCode(requestedCode || generateFrupasCode());

  const existing = await base("Users")
    .select({ filterByFormula: `{FrupasCode} = '${frupasCode}'`, maxRecords: 1 })
    .firstPage();
  if (existing.length > 0) {
    console.error(`Esiste già un utente con il codice frupas ${formatForDisplay(frupasCode)}.`);
    process.exit(1);
  }

  const userRecord = await base("Users").create({
    Name: name,
    FrupasCode: frupasCode,
    Theme: "system",
    MonthlyBudget: 800,
    CreatedAt: new Date().toISOString(),
  });

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const c = DEFAULT_CATEGORIES[i];
    await base("Categories").create({
      UserId: frupasCode,
      Name: c.name,
      Color: c.color,
      Icon: c.icon,
      IsDefault: true,
      SortOrder: i,
    });
  }

  await base("Cards").create({ UserId: frupasCode, Name: "Carta principale" });

  console.log(`Utente "${name}" creato (record ${userRecord.id}).`);
  console.log("Codice frupas (da inserire nell'app su ogni dispositivo):");
  console.log(formatForDisplay(frupasCode));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
