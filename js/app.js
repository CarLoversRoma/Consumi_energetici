/* ===========================
   Main Application Logic
   =========================== */

let contatoreInModifica = null;
let allegatoCorrente = { tipo: null, id: null };
let selectedStatCounters = new Set();

/* ===========================
   Inizializzazione UI
   =========================== */
document.addEventListener('DOMContentLoaded', () => {
    caricaDati();
    inizializzaTabs();
    popolaFornitureSelects();
    popolaContatoriSelects();
    popolaConfigLists();
    popolaFiltriContatoriSchede();
    inizializzaPickers();
    caricaTabelleTutti();

    // AGGIUNTO: Inizializza i contatori checkbox delle statistiche prima del grafico
    popolaStatContatoriCheckboxes();
    inizializzaGrafico(); // Questa funzione chiama aggiornaGrafico()
    initDashboard(); // Inizializza dashboard
    loadTheme(); // Carica tema salvato
    attachEventHandlers();
});

/* Tabs */
function inizializzaTabs() {
    document.querySelectorAll('#mainTabs li').forEach(li => {
        li.addEventListener('click', () => {
            document.querySelectorAll('#mainTabs li').forEach(x => x.classList.remove('is-active'));
            li.classList.add('is-active');
            const tab = li.getAttribute('data-tab');
            document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
            const el = document.getElementById(tab);
            if (el) el.style.display = 'block';
            if (tab === 'statistiche') {
                // AGGIORNATO: Ricarica i checkbox e il grafico quando si seleziona la tab statistiche
                popolaStatContatoriCheckboxes();
                aggiornaGrafico();
            } else if (tab === 'dashboard') {
                renderDashboard();
            }
        });
    });

    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    document.getElementById('dashboard').style.display = 'block';
}

/* Theme Toggle */
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
        const isDark = document.body.classList.contains('dark-mode');
        btn.textContent = isDark ? '☀️' : '🌙';
        btn.className = isDark ? 'button is-small is-warning' : 'button is-small is-dark';
    }
}

function loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    updateThemeIcon();
}

/* Pickers mese-anno */
function inizializzaPickers() {
    const opts = {
        plugins: [new monthSelectPlugin({ shorthand: false, dateFormat: "Y-m", altFormat: "F Y", theme: "light" })],
        allowInput: true
    };
    flatpickr("#mese-energia", opts);
    flatpickr("#mese-gas", opts);
    flatpickr("#mese-acqua", opts);
    flatpickr("#filtro-inizio-energia", opts);
    flatpickr("#filtro-fine-energia", opts);
    flatpickr("#filtro-inizio-gas", opts);
    flatpickr("#filtro-fine-gas", opts);
    flatpickr("#filtro-inizio-acqua", opts);
    flatpickr("#filtro-fine-acqua", opts);
    flatpickr("#filtro-inizio-stat", opts);
    flatpickr("#filtro-fine-stat", opts);
}

/* Forniture / Contatori UI */
function popolaFornitureSelects() {
    const selE = document.getElementById('fornitura-select-energia');
    const selG = document.getElementById('fornitura-select-gas');
    const selA = document.getElementById('fornitura-select-acqua');
    [selE, selG, selA].forEach(sel => {
        sel.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleziona fornitura...';
        sel.appendChild(defaultOption);
        Object.keys(forniture).forEach(cod => {
            if (!forniture[cod].attiva) return;
            const opt = document.createElement('option'); opt.value = cod; opt.textContent = forniture[cod].nome || cod; sel.appendChild(opt);
        });
    });

    const contF = document.getElementById('contatore-fornitura');
    if (contF) {
        contF.innerHTML = '';
        Object.keys(forniture).forEach(cod => {
            const opt = document.createElement('option'); opt.value = cod; opt.textContent = `${cod} — ${forniture[cod].nome || cod}${forniture[cod].attiva ? '' : ' (disabilitata)'}`; contF.appendChild(opt);
        });
    }
}

document.getElementById('btn-aggiungi-fornitura')?.addEventListener('click', () => {
    const nome = document.getElementById('nuova-fornitura-nome').value.trim();
    const codice = document.getElementById('nuova-fornitura-codice').value.trim().toLowerCase();
    if (!nome || !codice) { alert('Inserisci nome e codice per la fornitura'); return; }
    if (forniture[codice]) { alert('Codice fornitura già presente'); return; }
    forniture[codice] = { nome, attiva: true };
    salvaForniture(); popolaFornitureSelects(); popolaConfigLists();
    document.getElementById('nuova-fornitura-nome').value = '';
    document.getElementById('nuova-fornitura-codice').value = '';
});

// Utility per convertire hex in RGB
function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    hex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    return { r, g, b };
}

// Utility per determinare il colore del testo a contrasto
function getContrastTextColor(bgColor) {
    let r, g, b;
    if (bgColor.startsWith('#')) {
        const rgb = hexToRgb(bgColor);
        r = rgb.r; g = rgb.g; b = rgb.b;
    } else if (bgColor.startsWith('rgb')) {
        const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            r = parseInt(match[1], 10);
            g = parseInt(match[2], 10);
            b = parseInt(match[3], 10);
        } else {
            return 'black';
        }
    } else {
        return 'black';
    }

    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5 ? '#363636' : 'white'; // Colori più scuri per il testo nero, bianco per colori chiari
}

function popolaConfigLists() {
    const tbody = document.getElementById('lista-forniture'); if (tbody) {
        tbody.innerHTML = '';
        Object.keys(forniture).forEach(cod => {
            const f = forniture[cod];
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${cod}</strong></td><td>${f.nome}</td><td><label class="checkbox"><input type="checkbox" data-codice="${cod}" ${f.attiva ? 'checked' : ''} onchange="toggleFornitura(this)"></label></td><td><button class="button is-small is-light" onclick="modificaFornitura('${cod}')">Modifica</button> <button class="button is-small is-danger" onclick="eliminaFornitura('${cod}')">Elimina</button></td>`;
            tbody.appendChild(tr);
        });
    }

    const lcont = document.getElementById('lista-contatori-config'); if (lcont) {
        lcont.innerHTML = '';
        contatori.forEach(c => {
            const div = document.createElement('div');
            div.className = 'box';
            div.style.padding = '8px';
            div.style.marginBottom = '8px';
            div.style.border = 'none';

            const bgColor = getCounterColor(c.id);
            const textColor = getContrastTextColor(bgColor);

            div.style.backgroundColor = bgColor;
            div.style.color = textColor;

            div.innerHTML = `
        <strong>${c.nome}</strong> <span style="color: ${textColor}; opacity: 0.8;">(${c.codice})</span>
        <div style="color: ${textColor}; opacity: 0.8;">Fornitura: ${forniture[c.fornitura]?.nome || c.fornitura} — ${c.ubicazione || '-'}</div>
        <div style="margin-top:6px;">
          <button class="button is-small" onclick="modificaContatoreConfig(${c.id})" style="color: ${textColor}; background-color: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3);">Modifica</button>
          <button class="button is-small" onclick="eliminaContatoreConfig(${c.id})" style="color: ${textColor}; background-color: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3);">Elimina</button>
        </div>
      `;
            lcont.appendChild(div);
        });
    }
}

function toggleFornitura(el) {
    const codice = el.dataset.codice;
    forniture[codice].attiva = el.checked;
    salvaForniture(); popolaFornitureSelects(); popolaConfigLists();
}
function modificaFornitura(cod) {
    const nuovo = prompt('Nuovo nome per ' + cod, forniture[cod].nome);
    if (nuovo !== null) { forniture[cod].nome = nuovo.trim() || forniture[cod].nome; salvaForniture(); popolaFornitureSelects(); popolaConfigLists(); }
}
function eliminaFornitura(cod) {
    const associati = contatori.filter(c => c.fornitura === cod);
    if (associati.length > 0) { alert('Impossibile eliminare: esistono contatori associati. Disabilita la fornitura oppure sposta i contatori.'); return; }
    if (confirm('Eliminare la fornitura ' + cod + ' ?')) { delete forniture[cod]; salvaForniture(); popolaFornitureSelects(); popolaConfigLists(); }
}

/* Contatori CRUD */
document.getElementById('btn-salva-contatore')?.addEventListener('click', () => {
    const nome = document.getElementById('contatore-nome').value.trim();
    const codice = document.getElementById('contatore-codice').value.trim();
    const fornitura = document.getElementById('contatore-fornitura').value;
    const ubicazione = document.getElementById('contatore-ubicazione').value.trim();
    const stato = document.getElementById('contatore-stato').value;
    if (!nome || !codice || !fornitura) { alert('Compila i campi obbligatori'); return; }
    const existe = contatori.find(c => c.codice === codice && (contatoreInModifica === null || c.id !== contatoreInModifica));
    if (existe) { alert('Codice contatore già esistente'); return; }
    if (contatoreInModifica) {
        const idx = contatori.findIndex(c => c.id === contatoreInModifica);
        contatori[idx] = { id: contatoreInModifica, nome, codice, fornitura, ubicazione, stato };
        contatoreInModifica = null;
        document.getElementById('btn-annu-modifica-contatore').style.display = 'none';
    } else {
        const nuovoId = Math.max(0, ...contatori.map(c => c.id)) + 1;
        contatori.push({ id: nuovoId, nome, codice, fornitura, ubicazione, stato });
    }
    salvaContatori();
    popolaContatoriSelects();
    popolaConfigLists();
    popolaStatContatoriCheckboxes(); // AGGIUNTO: Aggiorna i checkbox delle statistiche
    resetFormContatore();
});
document.getElementById('btn-annu-modifica-contatore')?.addEventListener('click', () => { contatoreInModifica = null; resetFormContatore(); });

function modificaContatoreConfig(id) {
    const c = contatori.find(x => x.id === id); if (!c) return;
    contatoreInModifica = id;
    document.getElementById('contatore-nome').value = c.nome;
    document.getElementById('contatore-codice').value = c.codice;
    document.getElementById('contatore-fornitura').value = c.fornitura;
    document.getElementById('contatore-ubicazione').value = c.ubicazione || '';
    document.getElementById('contatore-stato').value = c.stato || 'attivo';
    document.getElementById('btn-annu-modifica-contatore').style.display = '';
}
function eliminaContatoreConfig(id) {
    if (!confirm('Eliminare contatore? I consumi resteranno in archivio ma il contatore non sarà più selezionabile.')) return;
    contatori = contatori.filter(c => c.id !== id);
    salvaContatori();
    popolaContatoriSelects();
    popolaConfigLists();
    popolaStatContatoriCheckboxes(); // AGGIUNTO: Aggiorna i checkbox delle statistiche
}
function resetFormContatore() {
    document.getElementById('contatore-nome').value = '';
    document.getElementById('contatore-codice').value = '';
    document.getElementById('contatore-ubicazione').value = '';
    document.getElementById('contatore-stato').value = 'attivo';
    contatoreInModifica = null;
    document.getElementById('btn-annu-modifica-contatore').style.display = 'none';
}

/* Popola select contatori (inserimento) */
function popolaContatoriSelects() {
    const byType = { energia: [], gas: [], acqua: [] };
    contatori.forEach(c => { if (!byType[c.fornitura]) byType[c.fornitura] = []; byType[c.fornitura].push(c); });
    const setOptions = (selectId, arr) => {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleziona contatore...</option>';
        arr.filter(c => c.stato === 'attivo').forEach(c => {
            const opt = document.createElement('option'); opt.value = c.id; opt.textContent = `${c.nome} (${c.codice})`; sel.appendChild(opt);
        });
    };
    setOptions('contatore-select-energia', byType.energia || []);
    setOptions('contatore-select-gas', byType.gas || []);
    setOptions('contatore-select-acqua', byType.acqua || []);

    popolaFiltriContatoriSchede();
    popolaStatContatoriCheckboxes(); // AGGIUNTO: Per assicurarsi che i contatori delle statistiche si aggiornino
}

function popolaFiltriContatoriSchede() {
    ['energia', 'gas', 'acqua'].forEach(tipo => {
        const select = document.getElementById(`filtro-contatore-${tipo}`);
        if (!select) return;

        const selectedValue = select.value;

        select.innerHTML = '<option value="">Tutti i contatori</option>'; // Opzione di default

        contatori.filter(c => c.fornitura === tipo && c.stato === 'attivo').forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.nome} (${c.codice})`;
            select.appendChild(opt);
        });

        if (selectedValue && Array.from(select.options).some(opt => opt.value === selectedValue)) {
            select.value = selectedValue;
        }
    });
}

// FUNZIONE AGGIORNATA per popolare i checkbox dei contatori nelle statistiche
function popolaStatContatoriCheckboxes() {
    const mainContainer = document.getElementById('filtro-contatori-stat-checkboxes');
    if (!mainContainer) return;

    mainContainer.innerHTML = ''; // Pulisci i checkbox esistenti

    const visibleTypes = {
        energia: document.getElementById('toggle-energia').checked,
        gas: document.getElementById('toggle-gas').checked,
        acqua: document.getElementById('toggle-acqua').checked,
    };

    // Filtra i contatori in base ai toggle Energia/Gas/Acqua
    const availableCounters = contatori.filter(c =>
        c.stato === 'attivo' && visibleTypes[c.fornitura]
    );

    // Raggruppa i contatori per tipo di fornitura
    const groupedCounters = availableCounters.reduce((acc, counter) => {
        if (!acc[counter.fornitura]) {
            acc[counter.fornitura] = [];
        }
        acc[counter.fornitura].push(counter);
        return acc;
    }, {});

    const sortedForneitureKeys = Object.keys(groupedCounters).sort((a, b) => {
        const order = ['energia', 'gas', 'acqua'];
        return order.indexOf(a) - order.indexOf(b);
    });

    sortedForneitureKeys.forEach(fornituraType => {
        const typeName = forniture[fornituraType]?.nome || fornituraType.charAt(0).toUpperCase() + fornituraType.slice(1);
        const countersOfType = groupedCounters[fornituraType].sort((a, b) => a.nome.localeCompare(b.nome));

        if (countersOfType.length > 0) {
            // Crea un div per l'intera sezione di una fornitura (titolo + checkbox)
            const fornituraSectionDiv = document.createElement('div');
            fornituraSectionDiv.style.marginBottom = '15px'; // Spazio tra i gruppi
            fornituraSectionDiv.style.borderBottom = '1px solid #eee'; // Linea separatrice
            fornituraSectionDiv.style.paddingBottom = '10px';


            // Titolo del gruppo di fornitura
            const groupTitle = document.createElement('p');
            groupTitle.className = 'title is-7';
            groupTitle.style.marginBottom = '8px'; // Spazio sotto il titolo
            groupTitle.innerHTML = `<strong>${typeName}:</strong>`;
            fornituraSectionDiv.appendChild(groupTitle);

            // Contenitore per i checkbox di questo gruppo (per Bulma is-grouped)
            const checkboxesGroup = document.createElement('div');
            checkboxesGroup.className = 'field is-grouped is-grouped-multiline';


            // Checkbox "Seleziona tutti" per il gruppo
            const selectAllWrapper = document.createElement('div');
            selectAllWrapper.className = 'control';
            const selectAllLabel = document.createElement('label');
            selectAllLabel.className = 'checkbox';
            const selectAllInput = document.createElement('input');
            selectAllInput.type = 'checkbox';
            selectAllInput.dataset.fornitura = fornituraType;
            selectAllInput.onchange = (e) => {
                const isChecked = e.target.checked;
                countersOfType.forEach(c => {
                    const counterCheckbox = document.getElementById(`stat-counter-${c.id}`);
                    if (counterCheckbox) {
                        counterCheckbox.checked = isChecked;
                        if (isChecked) {
                            selectedStatCounters.add(c.id);
                        } else {
                            selectedStatCounters.delete(c.id);
                        }
                    }
                });
                aggiornaGrafico();
            };
            selectAllLabel.appendChild(selectAllInput);
            selectAllLabel.appendChild(document.createTextNode(' Seleziona tutti'));
            selectAllWrapper.appendChild(selectAllLabel);
            checkboxesGroup.appendChild(selectAllWrapper); // Appendi al gruppo di checkbox


            countersOfType.forEach(c => {
                const wrapper = document.createElement('div');
                wrapper.className = 'control'; // Bulma control for aligning checkboxes
                const label = document.createElement('label');
                label.className = 'checkbox';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `stat-counter-${c.id}`;
                input.value = c.id;
                input.checked = selectedStatCounters.has(c.id); // Mantieni lo stato selezionato
                input.onchange = (e) => {
                    if (e.target.checked) {
                        selectedStatCounters.add(parseInt(e.target.value, 10));
                    } else {
                        selectedStatCounters.delete(parseInt(e.target.value, 10));
                    }
                    aggiornaGrafico();
                    // Aggiorna lo stato del "Seleziona tutti"
                    const allChecked = countersOfType.every(counter => selectedStatCounters.has(counter.id));
                    selectAllInput.checked = allChecked;
                };

                const pillColor = getCounterColor(c.id);
                const pillTextColor = getContrastTextColor(pillColor);

                const pillSpan = document.createElement('span');
                pillSpan.className = 'pill';
                pillSpan.style.backgroundColor = pillColor;
                pillSpan.style.color = pillTextColor;
                pillSpan.style.marginRight = '5px';
                pillSpan.textContent = `${c.nome} (${c.codice})`;

                label.appendChild(input);
                label.appendChild(pillSpan);
                wrapper.appendChild(label);
                checkboxesGroup.appendChild(wrapper); // Appendi al gruppo di checkbox

                // Inizializza lo stato del "Seleziona tutti"
                const allChecked = countersOfType.every(counter => selectedStatCounters.has(counter.id));
                selectAllInput.checked = allChecked;
            });

            fornituraSectionDiv.appendChild(checkboxesGroup); // Appendi il gruppo di checkbox alla sezione fornitura
            mainContainer.appendChild(fornituraSectionDiv); // Appendi la sezione fornitura al container principale
        }
    });

    // Se non ci sono contatori disponibili, assicurati che `selectedStatCounters` sia vuoto
    // e che i contatori precedentemente selezionati (e ora non visibili) vengano rimossi
    const currentlyAvailableCounterIds = new Set(availableCounters.map(c => c.id));
    selectedStatCounters = new Set(Array.from(selectedStatCounters).filter(id => currentlyAvailableCounterIds.has(id)));

    if (availableCounters.length === 0) {
        selectedStatCounters.clear();
    }
}


/* Aggiungi / elimina consumi */
function aggiungiConsumo(tipo) {
    const contatoreId = parseInt(document.getElementById('contatore-select-' + tipo).value || 0);
    const mese = document.getElementById('mese-' + tipo).value;
    const importo = parseFloat(document.getElementById('importo-' + tipo).value || 0);
    if (!contatoreId) { alert('Seleziona un contatore'); return; }
    if (!mese) { alert('Seleziona mese e anno'); return; }
    const baseConsumo = {
        id: Date.now() + Math.random(),
        contatoreId,
        mese,
        importo,
        allegati: []
    };

    if (tipo === 'gas') {
        const tipoGas = document.getElementById('tipo-gas').value;
        const val = parseFloat(document.getElementById('consumo-gas').value || 0);
        if (isNaN(val) || val <= 0) { alert('Inserisci consumo'); return; }
        let consumoKwh = val;
        let consumoOriginale = null;
        if (tipoGas === 'm3') {
            consumoOriginale = val;
            consumoKwh = val * 10.69;
        } else if (tipoGas === 'litri') {
            consumoOriginale = val;
            consumoKwh = val * 6.6;
        }
        const nuovo = { ...baseConsumo, consumo: parseFloat(consumoKwh.toFixed(2)), consumoOriginale: consumoOriginale, tipoOrigine: tipoGas };
        consumi.gas.push(nuovo);
    } else {
        const consumoVal = parseFloat(document.getElementById('consumo-' + tipo).value || 0);
        if (isNaN(consumoVal) || consumoVal <= 0) { alert('Inserisci consumo'); return; }
        consumi[tipo].push({ ...baseConsumo, consumo: consumoVal });
    }
    salvaConsumi();
    caricaTabelleTutti();
    aggiornaGrafico();
    popolaStatContatoriCheckboxes(); // AGGIUNTO: Aggiorna i checkbox delle statistiche (se un nuovo contatore è stato usato)
    document.getElementById('contatore-select-' + tipo).value = '';
    document.getElementById('mese-' + tipo).value = '';
    if (tipo === 'gas') document.getElementById('consumo-gas').value = '';
    else document.getElementById('consumo-' + tipo).value = '';
    document.getElementById('importo-' + tipo).value = '';
}
function eliminaConsumo(tipo, id) {
    if (!confirm('Eliminare il consumo? L\'azione è irreversibile.')) return;
    consumi[tipo] = consumi[tipo].filter(c => c.id !== id);
    salvaConsumi();
    caricaTabelleTutti();
    aggiornaGrafico();
    popolaStatContatoriCheckboxes(); // AGGIUNTO: Aggiorna i checkbox delle statistiche (se un contatore è stato rimosso)
}

// NUOVA FUNZIONE PER ELIMINARE TUTTI I CONSUMI
function deleteAllConsumi() {
    if (confirm('Sei sicuro di voler eliminare TUTTI i consumi (Energia, Gas, Acqua)? Questa azione è irreversibile!')) {
        consumi.energia = [];
        consumi.gas = [];
        consumi.acqua = [];
        salvaConsumi();
        caricaTabelleTutti();
        aggiornaGrafico();
        selectedStatCounters.clear(); // AGGIUNTO: Reset i contatori selezionati per le statistiche
        popolaStatContatoriCheckboxes(); // AGGIUNTO: Ridisegna i checkbox (ora tutti deselezionati)
        alert('Tutti i consumi sono stati eliminati con successo.');
        closeModalConfig();
    }
}

/* Carica tabelle */
function caricaTabelleTutti() { caricaTabella('energia'); caricaTabella('gas'); caricaTabella('acqua'); }
function caricaTabella(tipo) {
    const tbody = document.getElementById('tabella-' + tipo);
    if (!tbody) return;
    tbody.innerHTML = '';
    let rows = consumi[tipo] || [];
    const start = document.getElementById('filtro-inizio-' + tipo)?.value;
    const end = document.getElementById('filtro-fine-' + tipo)?.value;
    if (start || end) {
        rows = rows.filter(r => {
            if (start && r.mese < start) return false;
            if (end && r.mese > end) return false;
            return true;
        });
    }

    const filtroContatoreId = document.getElementById(`filtro-contatore-${tipo}`)?.value;
    if (filtroContatoreId) {
        rows = rows.filter(r => String(r.contatoreId) === filtroContatoreId);
    }

    rows = rows.sort((a, b) => b.mese.localeCompare(a.mese));
    rows.forEach(r => {
        const cont = contatori.find(c => c.id === r.contatoreId) || { nome: '—', codice: '—', id: null };
        const tr = document.createElement('tr');
        const allegatiCount = r.allegati ? r.allegati.length : 0;
        const actionsHtml = `
      <div class="buttons are-small">
          <button class="button is-light" onclick="openAllegatiModal('${tipo}', ${r.id})">
              <span>Allega</span>
              <span class="tag is-dark" style="margin-left: 6px;">${allegatiCount}</span>
          </button>
          <button class="button is-danger is-light" onclick="eliminaConsumo('${tipo}', ${r.id})">Elimina</button>
      </div>`;

        // Applica colore al contatore nella tabella
        const contatoreColor = cont.id ? getCounterColor(cont.id) : 'transparent';
        const contatoreTextColor = cont.id ? getContrastTextColor(contatoreColor) : 'currentColor';
        const contatoreCellContent = `<span class="counter-cell" style="background-color: ${contatoreColor}; color: ${contatoreTextColor};">${cont.nome} (${cont.codice})</span>`;


        if (tipo === 'gas') {
            tr.innerHTML = `<td>${formatMese(r.mese)}</td><td>${contatoreCellContent}</td><td>${(r.consumoOriginale ?? r.consumo).toFixed(2)} ${r.tipoOrigine ?? 'kWh'}</td><td>${(r.consumo).toFixed(2)} kWh</td><td>€${(r.importo || 0).toFixed(2)}</td><td>${actionsHtml}</td>`;
        } else {
            const unita = tipo === 'energia' ? 'kWh' : 'm³';
            tr.innerHTML = `<td>${formatMese(r.mese)}</td><td>${contatoreCellContent}</td><td>${(r.consumo).toFixed(2)} ${unita}</td><td>€${(r.importo || 0).toFixed(2)}</td><td>${actionsHtml}</td>`;
        }
        tbody.appendChild(tr);
    });
}

function formatMese(ym) {
    if (!ym) return '-';
    const [y, m] = String(ym).split('-');
    const date = new Date(y, parseInt(m, 10) - 1, 1);
    return date.toLocaleString('it-IT', { month: 'short', year: 'numeric' });
}

/* Filtri */
function applicaFiltro(tipo) { caricaTabella(tipo); }
function resetFiltro(tipo) {
    document.getElementById('filtro-inizio-' + tipo).value = '';
    document.getElementById('filtro-fine-' + tipo).value = '';
    const filtroContatoreSelect = document.getElementById(`filtro-contatore-${tipo}`);
    if (filtroContatoreSelect) {
        filtroContatoreSelect.value = ''; // Seleziona l'opzione "Tutti i contatori" (value="")
    }
    caricaTabella(tipo);
}
function applicaFiltroStat() {
    // Prima di aggiornare il grafico, assicurati che i checkbox siano correttamente popolati
    popolaStatContatoriCheckboxes();
    aggiornaGrafico();
}
function resetFiltroStat() {
    document.getElementById('filtro-inizio-stat').value = '';
    document.getElementById('filtro-fine-stat').value = '';
    selectedStatCounters.clear(); // NUOVO: Resetta i contatori selezionati
    popolaStatContatoriCheckboxes(); // Ridisegna i checkbox (ora tutti deselezionati)
    aggiornaGrafico();
}

/* Modal Handlers */
function attachEventHandlers() {
    document.getElementById('btn-open-config').addEventListener('click', openModalConfig);
    document.getElementById('close-config').addEventListener('click', closeModalConfig);
    document.getElementById('close-config-2').addEventListener('click', closeModalConfig);
    document.querySelectorAll('[data-config-tab]').forEach(li => {
        li.addEventListener('click', () => {
            const tabName = li.getAttribute('data-config-tab');
            document.querySelectorAll('[data-config-tab]').forEach(x => x.parentElement.classList.remove('is-active'));
            li.parentElement.classList.add('is-active');
            document.querySelectorAll('.config-tab').forEach(p => p.style.display = 'none');
            document.getElementById('config-' + tabName).style.display = '';
        });
    });

    document.getElementById('btn-open-contatori')?.addEventListener('click', openModalConfigContatori);
    document.getElementById('btn-open-contatori-2')?.addEventListener('click', openModalConfigContatori);
    document.getElementById('btn-open-contatori-3')?.addEventListener('click', openModalConfigContatori);

    document.getElementById('btn-export-xlsx').addEventListener('click', esportaDatiXLSX);
    document.getElementById('btn-import-xlsx').addEventListener('click', () => document.getElementById('file-import').click());
    document.getElementById('file-import').addEventListener('change', handleImportFile);

    document.getElementById('btn-export-pdf').addEventListener('click', openModalPdf);
    document.getElementById('close-pdf-modal').addEventListener('click', closeModalPdf);
    document.getElementById('btn-genera-pdf').addEventListener('click', esportaStatistichePDF);

    // Allegati Modal
    document.getElementById('close-allegati-modal').addEventListener('click', closeAllegatiModal);
    document.getElementById('close-allegati-modal-2').addEventListener('click', closeAllegatiModal);
    document.getElementById('file-allegato-input').addEventListener('change', handleFileSelect);

    // SharePoint
    document.getElementById('btn-salva-sharepoint').addEventListener('click', salvaPercorsoSharepoint);

    // Supabase
    document.getElementById('btn-salva-supabase').addEventListener('click', () => {
        const url = document.getElementById('supabase-url').value.trim();
        const key = document.getElementById('supabase-key').value.trim();
        if (!url || !key) { alert('Inserisci URL e Key'); return; }
        salvaConfigSupabase(url, key);
        alert('Configurazione Supabase salvata!');
    });

    document.getElementById('btn-test-supabase').addEventListener('click', async () => {
        const btn = document.getElementById('btn-test-supabase');
        const originalText = btn.textContent;
        btn.textContent = 'Test in corso...';
        btn.disabled = true;

        const result = await testSupabaseConnection();

        btn.textContent = originalText;
        btn.disabled = false;

        if (result.success) {
            alert('✅ ' + result.message);
        } else {
            alert('❌ ' + result.message);
        }
    });

    document.getElementById('btn-sync-upload').addEventListener('click', async () => {
        if (!supabase) { alert('Supabase non configurato o non inizializzato.'); return; }
        if (!confirm('Sovrascrivere i dati nel Cloud con quelli Locali?')) return;
        try {
            await uploadDataToSupabase();
            alert('Upload completato con successo!');
        } catch (e) {
            console.error(e);
            alert('Errore durante l\'upload: ' + e.message);
        }
    });

    document.getElementById('btn-sync-download').addEventListener('click', async () => {
        if (!supabase) { alert('Supabase non configurato o non inizializzato.'); return; }
        if (!confirm('Sovrascrivere i dati Locali con quelli dal Cloud?')) return;
        try {
            await downloadDataFromSupabase();
            caricaTabelleTutti();
            popolaFornitureSelects();
            popolaContatoriSelects();
            popolaConfigLists();
            aggiornaGrafico();
            alert('Download completato con successo!');
        } catch (e) {
            console.error(e);
            alert('Errore durante il download: ' + e.message);
        }
    });

    // Sync Button (Nuovo)
    document.getElementById('btn-sync-smart')?.addEventListener('click', async () => {
        if (!supabase) { alert('Supabase non configurato o non inizializzato.'); return; }
        try {
            const btn = document.getElementById('btn-sync-smart');
            const originalText = btn.textContent;
            btn.textContent = 'Sincronizzazione in corso...';
            btn.disabled = true;

            await syncDataWithSupabase();

            caricaTabelleTutti();
            popolaFornitureSelects();
            popolaContatoriSelects();
            popolaConfigLists();
            aggiornaGrafico();

            alert('Sincronizzazione completata!');
            btn.textContent = originalText;
            btn.disabled = false;
        } catch (e) {
            console.error(e);
            alert('Errore durante la sincronizzazione: ' + e.message + '\nAssicurati di aver creato le tabelle su Supabase (vedi tab "Setup DB").');
            const btn = document.getElementById('btn-sync-smart');
            if (btn) {
                btn.textContent = 'Sincronizza (Smart Merge)';
                btn.disabled = false;
            }
        }
    });

    // Copy SQL Button
    document.getElementById('btn-copy-sql')?.addEventListener('click', () => {
        const sql = getSupabaseSetupSQL();
        navigator.clipboard.writeText(sql).then(() => {
            alert('SQL copiato negli appunti! Incollalo nell\'SQL Editor di Supabase.');
        });
    });

    // AGGIUNTO: Event listener per il pulsante elimina tutti i consumi
    document.getElementById('btn-elimina-tutti-consumi')?.addEventListener('click', deleteAllConsumi);

    // AGGIORNATO: Modifica gli handler onchange per i toggle di energia/gas/acqua
    document.getElementById('toggle-energia').addEventListener('change', () => {
        popolaStatContatoriCheckboxes(); // Aggiorna i contatori disponibili
        aggiornaGrafico();
    });
    document.getElementById('toggle-gas').addEventListener('change', () => {
        popolaStatContatoriCheckboxes(); // Aggiorna i contatori disponibili
        aggiornaGrafico();
    });
    document.getElementById('toggle-acqua').addEventListener('change', () => {
        popolaStatContatoriCheckboxes(); // Aggiorna i contatori disponibili
        aggiornaGrafico();
    });

    const pdfList = document.getElementById('pdf-section-list');
    if (pdfList) {
        let dragSrc = null;
        pdfList.querySelectorAll('li').forEach(li => {
            li.addEventListener('dragstart', e => { dragSrc = li; e.dataTransfer.effectAllowed = 'move'; });
            li.addEventListener('dragover', e => { e.preventDefault(); });
            li.addEventListener('drop', e => { e.preventDefault(); if (dragSrc && dragSrc !== li) { pdfList.insertBefore(dragSrc, li); } dragSrc = null; });
        });
        pdfList.addEventListener('dragover', e => { e.preventDefault(); });
        pdfList.addEventListener('drop', e => { e.preventDefault(); if (dragSrc) { pdfList.appendChild(dragSrc); dragSrc = null; } });
    }
}

function openModalConfig() {
    document.getElementById('modal-config').classList.add('is-active');
    document.getElementById('sharepoint-path').value = localStorage.getItem(STORAGE.sharepointPath) || '';

    // Popola campi Supabase
    document.getElementById('supabase-url').value = localStorage.getItem(STORAGE.supabaseUrl) || '';
    document.getElementById('supabase-key').value = localStorage.getItem(STORAGE.supabaseKey) || '';

    document.querySelectorAll('.config-tab').forEach(p => p.style.display = 'none');
    document.getElementById('config-forniture').style.display = ''; // Mostra di default la tab forniture
    document.querySelectorAll('[data-config-tab]').forEach(x => x.parentElement.classList.remove('is-active'));
    document.querySelector('[data-config-tab="forniture"]').parentElement.classList.add('is-active');

    popolaConfigLists();
    popolaFornitureSelects();
}
function openModalConfigContatori() {
    openModalConfig();
    const tabs = document.querySelectorAll('[data-config-tab]'); tabs.forEach(t => t.parentElement.classList.remove('is-active'));
    tabs[1].parentElement.classList.add('is-active'); // Seleziona la tab "Contatori" (indice 1)
    document.getElementById('config-forniture').style.display = 'none';
    document.getElementById('config-sharepoint').style.display = 'none';
    document.getElementById('config-supabase').style.display = 'none';
    document.getElementById('config-data').style.display = 'none'; // Nascondi la nuova tab "Dati"
    document.getElementById('config-contatori').style.display = '';
    popolaConfigLists();
}
function closeModalConfig() { document.getElementById('modal-config').classList.remove('is-active'); resetFormContatore(); }

/* ===========================
   Gestione Allegati & SharePoint
   =========================== */
function salvaPercorsoSharepoint() {
    const path = document.getElementById('sharepoint-path').value.trim();
    localStorage.setItem(STORAGE.sharepointPath, path);
    alert('Percorso SharePoint salvato con successo.');
}

function openAllegatiModal(tipo, id) {
    allegatoCorrente = { tipo, id };
    const spContainer = document.getElementById('sharepoint-link-container');
    const spLink = document.getElementById('sharepoint-link');
    const savedPath = localStorage.getItem(STORAGE.sharepointPath);

    if (savedPath) {
        spLink.href = savedPath;
        spLink.textContent = savedPath;
        spContainer.style.display = 'block';
    } else {
        spContainer.style.display = 'none';
    }

    document.getElementById('modal-allegati').classList.add('is-active');
    popolaListaAllegati(tipo, id);
}

function closeAllegatiModal() {
    document.getElementById('modal-allegati').classList.remove('is-active');
    allegatoCorrente = { tipo: null, id: null };
    document.getElementById('file-allegato-input').value = ''; // Reset input
    document.getElementById('file-allegato-nome').textContent = 'Nessun file selezionato';
}

function popolaListaAllegati(tipo, id) {
    const lista = document.getElementById('allegati-lista');
    const noAllegatiMsg = document.getElementById('no-allegati');
    lista.innerHTML = '';
    const record = consumi[tipo].find(c => c.id === id);
    if (!record || !record.allegati || record.allegati.length === 0) {
        noAllegatiMsg.style.display = 'block';
        return;
    }

    noAllegatiMsg.style.display = 'none';
    record.allegati.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <a href="${file.data}" target="_blank" download="${file.name}">${file.name}</a>
          <button class="button is-small is-danger is-light" onclick="eliminaAllegato('${tipo}', ${id}, ${index})">Elimina</button>
      `;
        lista.appendChild(li);
    });
}

function handleFileSelect(event) {
    const fileInput = event.target;
    const file = fileInput.files[0];
    const fileNameEl = document.getElementById('file-allegato-nome');
    if (!file) {
        fileNameEl.textContent = 'Nessun file selezionato';
        return;
    }
    fileNameEl.textContent = file.name;

    const { tipo, id } = allegatoCorrente;
    const reader = new FileReader();
    reader.onload = function (e) {
        const nuovoAllegato = {
            name: file.name,
            type: file.type,
            data: e.target.result
        };
        const record = consumi[tipo].find(c => c.id === id);
        if (record) {
            record.allegati.push(nuovoAllegato);
            salvaConsumi();
            popolaListaAllegati(tipo, id);
            caricaTabelleTutti();
        }
        fileInput.value = '';
        fileNameEl.textContent = 'Nessun file selezionato';
    };
    reader.readAsDataURL(file);
}

function eliminaAllegato(tipo, id, index) {
    if (!confirm('Eliminare questo allegato?')) return;
    const record = consumi[tipo].find(c => c.id === id);
    if (record && record.allegati) {
        record.allegati.splice(index, 1);
        salvaConsumi();
        popolaListaAllegati(tipo, id);
        caricaTabelleTutti();
    }
}


/* ===========================
   Import / Export
   =========================== */

function esportaDatiXLSX() {
    const workbook = XLSX.utils.book_new();

    const riass = [['Tipo', 'Totale consumo (kWh/m³)', 'Spesa totale (€)']];
    riass.push(['Energia', consumi.energia.reduce((s, c) => s + (c.consumo || 0), 0).toFixed(2) + ' kWh', consumi.energia.reduce((s, c) => s + (c.importo || 0), 0).toFixed(2)]);
    riass.push(['Gas', consumi.gas.reduce((s, c) => s + (c.consumo || 0), 0).toFixed(2) + ' kWh', consumi.gas.reduce((s, c) => s + (c.importo || 0), 0).toFixed(2)]);
    riass.push(['Acqua', consumi.acqua.reduce((s, c) => s + (c.consumo || 0), 0).toFixed(2) + ' m³', consumi.acqua.reduce((s, c) => s + (c.importo || 0), 0).toFixed(2)]);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(riass), 'Riassunto');

    ['energia', 'gas', 'acqua'].forEach(tipo => {
        // Intestazione più descrittiva e coerente per l'importazione
        const header = ['mese_anno', 'contatore_nome', 'contatore_id', 'contatore_codice', 'consumo_misurato', 'unita_misurata', 'importo', 'consumo_kWh_gas', 'allegati_count'];
        const dati = [header];
        consumi[tipo].forEach(r => {
            const cont = contatori.find(c => c.id === r.contatoreId) || { nome: '-', codice: '-' };
            let consumo_misurato_val = r.consumo; // Default al consumo principale
            let unita_misurata_val = tipo === 'energia' ? 'kWh' : (tipo === 'acqua' ? 'm3' : 'kWh'); // Default

            let consumo_kwh_gas_val = ''; // Vuoto di default, verrà riempito solo per gas se applicabile

            if (tipo === 'gas') {
                consumo_misurato_val = r.consumoOriginale ?? r.consumo; // Il valore originale, se esiste
                unita_misurata_val = r.tipoOrigine ?? 'kWh'; // L'unità originale
                consumo_kwh_gas_val = r.consumo; // Il consumo già convertito in kWh per il gas
            }

            dati.push([
                r.mese || '',
                cont.nome || '',
                cont.id || '',
                cont.codice || '',
                consumo_misurato_val != null ? parseFloat(consumo_misurato_val.toFixed(2)) : '',
                unita_misurata_val || '',
                (r.importo != null ? parseFloat(r.importo.toFixed(2)) : 0),
                consumo_kwh_gas_val !== '' ? parseFloat(consumo_kwh_gas_val.toFixed(2)) : '',
                (r.allegati ? r.allegati.length : 0)
            ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(dati);
        const sheetName = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    });

    const filename = `consumi_export_${(new Date()).toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });

        // Importa solo Energia/Gas/Acqua, ignora Riassunto
        const targetSheets = wb.SheetNames.filter(n => ['Energia', 'Gas', 'Acqua'].includes(n));
        if (targetSheets.length === 0) {
            alert("Il file non contiene fogli validi (Energia/Gas/Acqua).");
            return;
        }

        let importati = 0, errori = 0;

        for (const name of targetSheets) {
            const sheet = wb.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
            if (!rows || rows.length < 2) continue;

            const header = rows[0].map(h => String(h).toLowerCase().trim());
            const data = rows.slice(1);

            const idx = {
                mese: header.findIndex(h => h.includes('mese')),
                contatoreId: header.findIndex(h => h.includes('contatore_id')),
                codice: header.findIndex(h => h.includes('codice')),
                consumo: header.findIndex(h => h.includes('consumo')),
                unita: header.findIndex(h => h.includes('unita')),
                importo: header.findIndex(h => h.includes('importo') || h.includes('spesa') || h.includes('costo')),
                consumo_kwh: header.findIndex(h => h.includes('kwh')),
            };

            data.forEach((row, rIndex) => {
                try {
                    const mese = (row[idx.mese] || '').substring(0, 7);
                    if (!mese) throw new Error(`Mese vuoto riga ${rIndex + 2}`);
                    const consumoRaw = row[idx.consumo] || '';
                    const consumo = parseFloat(consumoRaw.toString().replace(',', '.'));
                    if (isNaN(consumo) || consumo <= 0) throw new Error(`Consumo non valido riga ${rIndex + 2}`);
                    const importoRaw = row[idx.importo] || '';
                    const importo = parseFloat(importoRaw.toString().replace(',', '.')) || 0;

                    let cont = null;
                    if (idx.contatoreId >= 0 && row[idx.contatoreId]) {
                        cont = contatori.find(c => String(c.id) === String(row[idx.contatoreId]));
                    }
                    if (!cont && idx.codice >= 0 && row[idx.codice]) {
                        cont = contatori.find(c => c.codice === String(row[idx.codice]));
                    }
                    if (!cont) throw new Error(`Contatore non trovato riga ${rIndex + 2}`);

                    const base = { id: Date.now() + Math.random(), contatoreId: cont.id, mese, importo, allegati: [] };

                    if (cont.fornitura === 'gas') {
                        let consumoKwh = idx.consumo_kwh >= 0 ? parseFloat((row[idx.consumo_kwh] || '').toString().replace(',', '.')) : NaN;
                        if (isNaN(consumoKwh)) {
                            const un = idx.unita >= 0 ? String(row[idx.unita]).toLowerCase() : '';
                            consumoKwh = consumo;
                            if (un.includes('m3')) consumoKwh = consumo * 10.69;
                            else if (un.includes('lit')) consumoKwh = consumo * 6.6;
                        }
                        consumi.gas.push({ ...base, consumo: consumoKwh, consumoOriginale: consumo, tipoOrigine: row[idx.unita] || '' });
                    } else {
                        consumi[cont.fornitura].push({ ...base, consumo });
                    }
                    importati++;
                } catch (rowErr) {
                    console.warn('Errore import riga', rowErr);
                    errori++;
                }
            });
        }

        salvaConsumi();
        caricaTabelleTutti();
        aggiornaGrafico();
        alert(`Import completato: ${importati} righe importate, ${errori} errori.`);
    } catch (err) {
        console.error('Errore import globale', err);
        alert('Errore durante import: ' + err.message);
    }
    e.target.value = '';
}


/* PDF & Utility */
function openModalPdf() { document.getElementById('modal-pdf').classList.add('is-active'); }
function closeModalPdf() { document.getElementById('modal-pdf').classList.remove('is-active'); }
function esportaStatistichePDF() {
    const { jsPDF } = window.jspdf;
    const orient = document.querySelector('input[name="pdf-orient"]:checked').value === 'l' ? 'landscape' : 'portrait';
    const format = document.getElementById('pdf-format').value;
    const doc = new jsPDF({ orientation: orient, format: format });
    let y = 10;

    const addTitle = (title, doc, yPos) => {
        doc.setFontSize(14); doc.text(title, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' }); return yPos + 10;
    };
    const addTable = (tipo, doc, yPos) => {
        const table = document.getElementById('table-' + tipo); if (!table) return yPos;
        const head = Array.from(table.querySelector('thead tr').children).map(th => th.textContent);
        const body = Array.from(table.querySelector('tbody').children).map(tr =>
            Array.from(tr.children).map(td => {
                // Estrai il testo dalla cella, ignorando stili specifici come 'counter-cell'
                return td.querySelector('.counter-cell')?.textContent || td.textContent;
            })
        );
        // Rimuovi l'ultima colonna "Azioni" dall'head e dal body
        if (head[head.length - 1] === 'Azioni') {
            head.pop();
            body.forEach(row => row.pop());
        }

        const estHeight = body.length * 7 + 20;
        if (yPos + estHeight > doc.internal.pageSize.getHeight() - 10 && yPos > 10) { doc.addPage(); yPos = 10; }
        yPos = addTitle(`Consumi ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`, doc, yPos);
        doc.autoTable({ head: [head], body: body, startY: yPos });
        return doc.autoTable.previous.finalY + 10;
    };

    const selections = Array.from(document.querySelectorAll('#pdf-section-list input:checked')).map(ch => ch.dataset.section);
    selections.forEach((section, index) => {
        if (index > 0) { doc.addPage(); y = 10; }
        if (section === 'chart') {
            y = addTitle("Grafico consumi", doc, y);
            const canvas = document.getElementById('chart-consumi');
            if (canvas) {
                const imgData = canvas.toDataURL('image/png');
                const pageW = doc.internal.pageSize.getWidth() - 20; const pageH = doc.internal.pageSize.getHeight() - 20 - y;
                let imgW = pageW; let imgH = (canvas.height / canvas.width) * imgW;
                if (imgH > pageH) { imgH = pageH; imgW = (canvas.width / canvas.height) * imgH; }
                doc.addImage(imgData, 'PNG', 10 + (pageW - imgW) / 2, y + 5, imgW, imgH);
                y += imgH + 15;
            }
        } else {
            y = addTable(section, doc, y);
        }
    });
    doc.save('statistiche_consumi.pdf');
    closeModalPdf();
}
