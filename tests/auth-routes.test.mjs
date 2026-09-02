// Test dell'autenticazione Fru Pass, eseguibili con `npm test`.
// Airtable e l'endpoint dell'ecosistema sono stubbati: i test non toccano la
// rete e non richiedono credenziali.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Module = require("module");

// --- stub del layer Airtable (nessuna rete, nessuna credenziale) ---
const utenti = [];
const stubDb = {
  getUserByFrupasCode: async (c) => utenti.find(u=>u.code===c) || null,
  getUserByApiKey: async (k) => utenti.find(u=>u.api_key===k) || null,
  provisionUser: async (p) => { let u=utenti.find(x=>x.code===p.code);
    if(!u){u={id:"rec"+utenti.length,code:p.code,name:p.name,api_key:"KEY-"+p.code,theme:"system",monthly_budget:800};utenti.push(u);} return u; },
  listCategories: async () => ([{id:"c1",name:"Altro",is_default:1}]),
  listCards: async () => [], findCardByName: async()=>null, createCard: async(u,n)=>({id:"cd1",name:n}),
  findOrCreateCategory: async()=>({id:"c1",name:"Altro"}),
  createTransaction: async (userId,d)=>({id:"tx1",user_id:userId,...d}),
  listTransactions: async()=>[],
};
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "./lib/airtable") return stubDb;
  return origLoad.call(this, req, ...rest);
};

const realFetch = global.fetch;
// --- stub dell'ecosistema Fru Pass ---
global.fetch = async (u, o) => {
  const { payload } = JSON.parse(o.body);
  if (payload.code !== "FRU-AB12-CD34") return { status:401, ok:false };
  return { status:200, ok:true, json: async()=>({profile:{code:payload.code,name:"Ricky",username:"ricky"}}) };
};

const { app } = require(new URL('../netlify/functions/api.js', import.meta.url).pathname);
const http = require("http");
const srv = http.createServer(app);
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const call = async (method, path, { body, headers } = {}) => {
  const res = await realFetch(`http://127.0.0.1:${port}/api${path}`, {
    method, headers: { "content-type": "application/json", ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await res.json(); } catch {}
  return { status: res.status, body: j };
};

let ok=0,ko=0; const t=(n,c,extra)=>{c?(ok++,console.log("  ok  "+n)):(ko++,console.log("  FAIL "+n+(extra?" -> "+JSON.stringify(extra):"")));};

let r = await call("POST","/auth/login",{ body:{ code:"fru-ab12-cd34" }});
t("login con codice valido -> 200 + profilo + utente creato", r.status===200 && r.body.profile.code==="FRU-AB12-CD34" && r.body.user.api_key, r);
const apiKey = r.body?.user?.api_key;

r = await call("POST","/auth/login",{ body:{ code:"FRU-9999-9999" }});
t("codice non riconosciuto -> 401", r.status===401 && r.body.error==="Codice non riconosciuto", r);

r = await call("POST","/auth/login",{ body:{} });
t("codice mancante -> 400", r.status===400, r);

r = await call("POST","/auth/refresh",{ body:{ code:"FRU-AB12-CD34" }});
t("refresh di un codice valido -> 200", r.status===200, r);

r = await call("GET","/me",{ headers:{ "x-frupas-code":"FRU-AB12-CD34" }});
t("rotta dati con header valido -> 200", r.status===200 && r.body.code==="FRU-AB12-CD34", r);

r = await call("GET","/me?code=FRU-AB12-CD34");
t("codice in query string NON accettato (niente credenziali negli URL)", r.status===401, r);

r = await call("GET","/me",{ headers:{ "x-api-key": apiKey }});
t("api key non vale come login alle rotte dati", r.status===401, r);

r = await call("POST","/webhook/applepay",{ headers:{ "x-api-key": apiKey }, body:{ amount:12.5, name:"Bar Roma" }});
t("webhook con api key -> 201 e spesa applepay", r.status===201 && r.body.source==="applepay", r);

r = await call("POST","/webhook/applepay",{ headers:{ "x-frupas-code":"FRU-AB12-CD34" }, body:{ amount:1, name:"x" }});
t("webhook NON accetta il codice Fru Pass", r.status===401, r);

r = await call("POST","/webhook/applepay",{ headers:{ "x-api-key":"sbagliata" }, body:{ amount:1, name:"x" }});
t("webhook con api key errata -> 401", r.status===401, r);

// ecosistema irraggiungibile
global.fetch = async () => { throw new Error("rete giù"); };
r = await call("POST","/auth/refresh",{ body:{ code:"FRU-AB12-CD34" }});
t("ecosistema irraggiungibile -> 503, non 401 (non butta fuori l'utente)", r.status===503, r);

srv.close();
console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko?1:0);
