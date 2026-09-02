// Test dell'autenticazione Fru Pass, eseguibili con `npm test`.
// Airtable e l'endpoint dell'ecosistema sono stubbati: i test non toccano la
// rete e non richiedono credenziali.
// Verifica la logica di verifyFruPass stubbando fetch (l'endpoint vero non è
// raggiungibile da questa sandbox).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fp = require(new URL('../netlify/functions/lib/frupass.js', import.meta.url).pathname);
let ok=0, ko=0;
const t=(n,c)=>{ c?(ok++,console.log("  ok  "+n)):(ko++,console.log("  FAIL "+n)); };

// canonicalCode
t("canonical: minuscole e spazi", fp.canonicalCode("  fru-ab12 -cd34 ")==="FRU-AB12-CD34");
t("canonical: mantiene i trattini", fp.canonicalCode("FRU-AB12-CD34").includes("-"));

let visto=null;
global.fetch = async (url, opts) => { visto={url,body:JSON.parse(opts.body)}; return {
  status:200, ok:true, json:async()=>({profile:{code:"FRU-AB12-CD34",name:"Ricky",username:"ricky"},apps:[],medals:[]})};};
const p = await fp.verifyFruPass("fru-ab12-cd34");
t("login: chiama l'endpoint condiviso", visto.url===fp.FRUPASS_ENDPOINT);
t("login: manda action+payload nel formato dell'ecosistema", visto.body.action==="login" && visto.body.payload.code==="FRU-AB12-CD34");
t("login: restituisce solo il profilo", JSON.stringify(p)==='{"code":"FRU-AB12-CD34","name":"Ricky","username":"ricky"}');

await fp.verifyFruPass("FRU-AB12-CD34","refresh");
t("refresh: action=refresh", visto.body.action==="refresh");

global.fetch = async () => ({status:401, ok:false});
t("codice non valido -> null (non un'eccezione)", (await fp.verifyFruPass("FRU-0000-0000"))===null);

global.fetch = async () => ({status:500, ok:false});
let lanciato=false; try { await fp.verifyFruPass("FRU-AB12-CD34"); } catch { lanciato=true; }
t("ecosistema guasto -> eccezione (diverso da codice invalido)", lanciato);

global.fetch = async () => ({status:200, ok:true, json:async()=>({apps:[]})});
t("risposta senza profile -> null", (await fp.verifyFruPass("FRU-AB12-CD34"))===null);

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko?1:0);
