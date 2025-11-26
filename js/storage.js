/* ===========================
   Gestione Dati (Storage)
   =========================== */

const STORAGE = {
  forniture: 'cm_forniture_v1',
  contatori: 'cm_contatori_v1',
  consumi: 'cm_consumi_v1',
  sharepointPath: 'cm_sharepoint_path_v1',
  supabaseUrl: 'cm_supabase_url_v1',
  supabaseKey: 'cm_supabase_key_v1'
};

let forniture = {};
let contatori = [];
let consumi = { energia: [], gas: [], acqua: [] };
let supabase = null; // Client Supabase

/* Carica dati */
function caricaDati() {
  const f = localStorage.getItem(STORAGE.forniture);
  const c = localStorage.getItem(STORAGE.contatori);
  const cs = localStorage.getItem(STORAGE.consumi);

  if (f) forniture = JSON.parse(f);
  else {
    forniture = { energia: { nome: 'Energia Elettrica', attiva: true }, gas: { nome: 'Gas', attiva: true }, acqua: { nome: 'Acqua', attiva: true } };
    localStorage.setItem(STORAGE.forniture, JSON.stringify(forniture));
  }

  contatori = c ? JSON.parse(c) : [
    { id: 1, nome: 'Casa principale', codice: 'EN001', fornitura: 'energia', ubicazione: 'Abitazione', stato: 'attivo' },
    { id: 2, nome: 'Riscaldamento', codice: 'GS001', fornitura: 'gas', ubicazione: 'Caldaia', stato: 'attivo' },
    { id: 3, nome: 'Contatore acqua', codice: 'AQ001', fornitura: 'acqua', ubicazione: 'Generale', stato: 'attivo' }
  ];
  if (!c) localStorage.setItem(STORAGE.contatori, JSON.stringify(contatori));

  consumi = cs ? JSON.parse(cs) : { energia: [], gas: [], acqua: [] };
  // Aggiunge la proprietà `allegati` se non esiste per retrocompatibilità
  Object.keys(consumi).forEach(tipo => {
    consumi[tipo].forEach(cons => {
      if (!cons.allegati) {
        cons.allegati = [];
      }
    });
  });
  if (!cs) localStorage.setItem(STORAGE.consumi, JSON.stringify(consumi));

  initSupabase();
}

function initSupabase() {
  const url = localStorage.getItem(STORAGE.supabaseUrl);
  const key = localStorage.getItem(STORAGE.supabaseKey);
  if (url && key && window.supabase) {
    try {
      supabase = window.supabase.createClient(url, key);
      console.log("Supabase client initialized");
    } catch (e) {
      console.error("Errore inizializzazione Supabase:", e);
    }
  }
}

function salvaConfigSupabase(url, key) {
  localStorage.setItem(STORAGE.supabaseUrl, url);
  localStorage.setItem(STORAGE.supabaseKey, key);
  initSupabase();
}

async function testSupabaseConnection() {
  if (!supabase) return { success: false, message: "Client Supabase non inizializzato. Salva prima la configurazione." };

  try {
    // Tenta una query leggera. Se la tabella non esiste, darà errore ma diverso da "Network Error" o 401
    const { count, error } = await supabase.from('cm_forniture').select('*', { count: 'exact', head: true });

    if (error) {
      // Se l'errore è "relation does not exist", siamo comunque connessi!
      if (error.code === '42P01') {
        return { success: true, message: "Connessione riuscita! (Tabelle non ancora create)" };
      }
      // Altri errori (es. 401 Unauthorized, Network Error)
      return { success: false, message: "Errore connessione: " + error.message };
    }

    return { success: true, message: "Connessione riuscita! Tabelle trovate." };
  } catch (e) {
    return { success: false, message: "Eccezione: " + e.message };
  }
}

/* --- SUPABASE SYNC LOGIC --- */

// Genera SQL per creare le tabelle
function getSupabaseSetupSQL() {
  return `
-- Esegui questo script nell'SQL Editor di Supabase per creare le tabelle necessarie

CREATE TABLE IF NOT EXISTS cm_forniture (
    codice TEXT PRIMARY KEY,
    nome TEXT,
    attiva BOOLEAN,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cm_contatori (
    id BIGINT PRIMARY KEY,
    nome TEXT,
    codice TEXT,
    fornitura TEXT,
    ubicazione TEXT,
    stato TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cm_consumi (
    id TEXT PRIMARY KEY, -- ID univoco generato dal client
    tipo TEXT, -- 'energia', 'gas', 'acqua'
    contatore_id BIGINT,
    mese TEXT,
    importo NUMERIC,
    consumo NUMERIC,
    consumo_originale NUMERIC,
    tipo_origine TEXT,
    allegati JSONB, -- Salviamo i metadati degli allegati (non i file binari per ora)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;
}

async function uploadDataToSupabase() {
  if (!supabase) throw new Error("Supabase non inizializzato");

  // 1. Upload Forniture
  const fornitureRows = Object.keys(forniture).map(k => ({
    codice: k,
    ...forniture[k],
    updated_at: new Date().toISOString()
  }));
  const { error: errF } = await supabase.from('cm_forniture').upsert(fornitureRows);
  if (errF) throw errF;

  // 2. Upload Contatori
  const contatoriRows = contatori.map(c => ({
    ...c,
    updated_at: new Date().toISOString()
  }));
  const { error: errC } = await supabase.from('cm_contatori').upsert(contatoriRows);
  if (errC) throw errC;

  // 3. Upload Consumi
  let consumiRows = [];
  ['energia', 'gas', 'acqua'].forEach(tipo => {
    consumi[tipo].forEach(c => {
      // Rimuoviamo i dati binari degli allegati per non appesantire il DB (o li gestiamo a parte)
      // Per ora salviamo solo i metadati degli allegati se presenti
      const allegatiMeta = c.allegati ? c.allegati.map(a => ({ name: a.name, type: a.type })) : [];

      consumiRows.push({
        id: String(c.id), // Assicuriamoci che sia stringa
        tipo: tipo,
        contatore_id: c.contatoreId,
        mese: c.mese,
        importo: c.importo,
        consumo: c.consumo,
        consumo_originale: c.consumoOriginale || null,
        tipo_origine: c.tipoOrigine || null,
        allegati: allegatiMeta,
        updated_at: new Date().toISOString()
      });
    });
  });

  // Upsert in batch (Supabase gestisce batch, ma meglio non esagerare se sono migliaia)
  if (consumiRows.length > 0) {
    const { error: errCs } = await supabase.from('cm_consumi').upsert(consumiRows);
    if (errCs) throw errCs;
  }
}

async function downloadDataFromSupabase() {
  if (!supabase) throw new Error("Supabase non inizializzato");

  // 1. Download Forniture
  const { data: dataF, error: errF } = await supabase.from('cm_forniture').select('*');
  if (errF) throw errF;

  const nuoveForniture = {};
  dataF.forEach(row => {
    nuoveForniture[row.codice] = { nome: row.nome, attiva: row.attiva };
  });

  // 2. Download Contatori
  const { data: dataC, error: errC } = await supabase.from('cm_contatori').select('*');
  if (errC) throw errC;

  const nuoviContatori = dataC.map(row => ({
    id: row.id,
    nome: row.nome,
    codice: row.codice,
    fornitura: row.fornitura,
    ubicazione: row.ubicazione,
    stato: row.stato
  }));

  // 3. Download Consumi
  const { data: dataCs, error: errCs } = await supabase.from('cm_consumi').select('*');
  if (errCs) throw errCs;

  const nuoviConsumi = { energia: [], gas: [], acqua: [] };
  dataCs.forEach(row => {
    if (nuoviConsumi[row.tipo]) {
      nuoviConsumi[row.tipo].push({
        id: parseFloat(row.id), // Ripristina numero se era numero
        contatoreId: row.contatore_id,
        mese: row.mese,
        importo: row.importo,
        consumo: row.consumo,
        consumoOriginale: row.consumo_originale,
        tipoOrigine: row.tipo_origine,
        allegati: [] // Nota: gli allegati binari non vengono scaricati dal DB per ora
      });
    }
  });

  // Aggiorna stato locale
  forniture = nuoveForniture;
  contatori = nuoviContatori;
  consumi = nuoviConsumi;

  salvaForniture();
  salvaContatori();
  salvaConsumi();

  return true;
}

async function syncDataWithSupabase() {
  if (!supabase) throw new Error("Supabase non inizializzato");

  // Strategia Sync Semplice:
  // 1. Scarica tutto dal Cloud
  // 2. Unisci con Locale (ID match)
  // 3. Ricarica tutto su Cloud

  // Nota: Questa è una strategia "Merge Union". Se un record esiste in entrambi,
  // vince quello Cloud (o Locale? Facciamo vincere il Cloud per ora come 'source of truth' condivisa, 
  // oppure potremmo usare updated_at se lo avessimo salvato localmente).
  // Per semplicità, qui facciamo: Unione degli ID. Se ID non esiste in locale, aggiungi. Se esiste, aggiorna da Cloud.
  // Poi fai Upload di tutto (così se ho aggiunto roba in locale che non c'era in cloud, va su).

  // 1. Fetch Cloud Data
  const { data: cloudF } = await supabase.from('cm_forniture').select('*');
  const { data: cloudC } = await supabase.from('cm_contatori').select('*');
  const { data: cloudCs } = await supabase.from('cm_consumi').select('*');

  // 2. Merge Forniture
  if (cloudF) {
    cloudF.forEach(row => {
      // Sovrascrivi/Aggiungi locale
      forniture[row.codice] = { nome: row.nome, attiva: row.attiva };
    });
  }

  // 3. Merge Contatori
  if (cloudC) {
    const localMap = new Map(contatori.map(c => [c.id, c]));
    cloudC.forEach(row => {
      localMap.set(row.id, {
        id: row.id,
        nome: row.nome,
        codice: row.codice,
        fornitura: row.fornitura,
        ubicazione: row.ubicazione,
        stato: row.stato
      });
    });
    contatori = Array.from(localMap.values());
  }

  // 4. Merge Consumi
  if (cloudCs) {
    // Mappa locale per tipo
    ['energia', 'gas', 'acqua'].forEach(tipo => {
      const localMap = new Map(consumi[tipo].map(c => [String(c.id), c]));

      // Filtra quelli del cloud di questo tipo
      const cloudType = cloudCs.filter(r => r.tipo === tipo);

      cloudType.forEach(row => {
        const existing = localMap.get(String(row.id));
        // Se esiste, preserviamo gli allegati locali che non sono nel DB
        const allegati = existing ? existing.allegati : [];

        localMap.set(String(row.id), {
          id: parseFloat(row.id),
          contatoreId: row.contatore_id,
          mese: row.mese,
          importo: row.importo,
          consumo: row.consumo,
          consumoOriginale: row.consumo_originale,
          tipoOrigine: row.tipo_origine,
          allegati: allegati
        });
      });
      consumi[tipo] = Array.from(localMap.values());
    });
  }

  // 5. Salva tutto localmente
  salvaForniture();
  salvaContatori();
  salvaConsumi();

  // 6. Upload del risultato unificato su Cloud (per aggiornare il cloud con i nuovi dati locali)
  await uploadDataToSupabase();

  return true;
}

function salvaForniture() { localStorage.setItem(STORAGE.forniture, JSON.stringify(forniture)); }
function salvaContatori() { localStorage.setItem(STORAGE.contatori, JSON.stringify(contatori)); }
function salvaConsumi() {
  try {
    localStorage.setItem(STORAGE.consumi, JSON.stringify(consumi));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Errore: Spazio di archiviazione locale esaurito. Non è possibile salvare nuovi dati o allegati. Prova a eliminare alcuni file allegati di grandi dimensioni.');
    } else {
      alert('Si è verificato un errore imprevisto durante il salvataggio dei dati.');
    }
  }
}
