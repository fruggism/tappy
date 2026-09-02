#!/usr/bin/env node
// Crea un nuovo utente tappy su Airtable con le 4 categorie di default,
// e stampa la sua chiave personale (API key) da incollare nell'app.
//
// Uso:
//   AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... node scripts/seed-user.js "Nome"

const Airtable = require("airtable");
const crypto = require("crypto");

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const name = process.argv[2];

if (!apiKey || !baseId) {
  console.error("Imposta AIRTABLE_API_KEY e AIRTABLE_BASE_ID nell'ambiente.");
  process.exit(1);
}
if (!name) {
  console.error('Uso: node scripts/seed-user.js "Nome utente"');
  process.exit(1);
}

const base = new Airtable({ apiKey }).base(baseId);

const DEFAULT_CATEGORIES = [
  { name: "Spesa", color: "#39ff88", icon: "cart" },
  { name: "Macchina", color: "#00e5ff", icon: "car" },
  { name: "Leisure", color: "#ff2ecb", icon: "sparkles" },
  { name: "Altro", color: "#a3a3ff", icon: "dots" },
];

async function main() {
  const userApiKey = crypto.randomBytes(16).toString("hex");

  const userRecord = await base("Users").create({
    Name: name,
    ApiKey: userApiKey,
    Theme: "system",
    MonthlyBudget: 800,
    CreatedAt: new Date().toISOString(),
  });

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const c = DEFAULT_CATEGORIES[i];
    await base("Categories").create({
      UserId: userRecord.id,
      Name: c.name,
      Color: c.color,
      Icon: c.icon,
      IsDefault: true,
      SortOrder: i,
    });
  }

  await base("Cards").create({ UserId: userRecord.id, Name: "Carta principale" });

  console.log(`Utente "${name}" creato.`);
  console.log("Chiave personale (incollala nell'app su ogni dispositivo):");
  console.log(userApiKey);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
