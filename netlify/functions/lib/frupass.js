// Verifica dei codici Fru Pass tramite l'endpoint condiviso dell'ecosistema.
//
// Il codice Fru Pass (formato FRU-XXXX-XXXX) NON è nostro da validare: è
// l'identità condivisa da tutte le app dell'hub. L'unico modo legittimo di
// verificarlo è chiamare l'endpoint qui sotto. In particolare non abbiamo (e
// non ci servono) le credenziali Airtable dell'ecosistema: il nostro Airtable
// è un'altra base, con i soli dati di tappy.
const FRUPASS_ENDPOINT = "https://frupass-user.netlify.app/.netlify/functions/api";

// Forma canonica: maiuscolo, senza spazi. I trattini fanno parte del formato
// e vanno mantenuti — è la forma che l'endpoint condiviso si aspetta.
function canonicalCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Verifica un codice presso l'ecosistema Fru Pass.
 * @param {string} code   il codice inserito dall'utente
 * @param {"login"|"refresh"} action  "login" al primo accesso, "refresh" per
 *   ri-validare un codice già salvato (es. per accorgersi che è stato revocato)
 * @returns {Promise<{code,name,username}|null>} il profilo, o null se il
 *   codice non è riconosciuto
 * @throws se l'ecosistema è irraggiungibile o risponde in modo inatteso —
 *   caso diverso da "codice non valido", e va trattato diversamente.
 */
async function verifyFruPass(code, action = "login") {
  const normalized = canonicalCode(code);
  if (!normalized) return null;

  const res = await fetch(FRUPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload: { code: normalized } }),
  });

  // 401 = codice non riconosciuto: esito legittimo, non un guasto.
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Fru Pass ha risposto ${res.status}`);

  const data = await res.json();
  // Di tutta la risposta ci serve solo "profile": apps/categories/messages/
  // medals sono roba dell'hub e non ci riguardano.
  const profile = data && data.profile;
  if (!profile || !profile.code) return null;

  return {
    code: canonicalCode(profile.code),
    name: profile.name || profile.username || "",
    username: profile.username || "",
  };
}

module.exports = { verifyFruPass, canonicalCode, FRUPASS_ENDPOINT };
