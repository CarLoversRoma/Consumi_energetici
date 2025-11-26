/* ===========================
   Gestione Grafici
   =========================== */

/* Colori per il grafico, una palette più ampia per i contatori */
const CHART_COLORS_PALETTE = [
    '#8dd3c7', '#81D4FA', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd',
    '#ccebc5', '#ffed6f', '#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00',
    '#cab2d6', '#6a3d9a', '#ffff99', '#b15928'
];
let chartColorMap = new Map(); // Mappa ID contatore a colore
let chartInstance = null;

function getCounterColor(counterId) {
    if (!chartColorMap.has(counterId)) {
        const usedColors = new Set(chartColorMap.values());
        let nextColor = CHART_COLORS_PALETTE[chartColorMap.size % CHART_COLORS_PALETTE.length];

        // Cerca un colore non ancora usato
        const availableColors = CHART_COLORS_PALETTE.filter(color => !Array.from(usedColors).includes(color));
        if (availableColors.length > 0) {
            nextColor = availableColors[0];
        } else {
            // Se tutti i colori della palette sono usati, ricomincia la palette
            nextColor = CHART_COLORS_PALETTE[chartColorMap.size % CHART_COLORS_PALETTE.length];
        }
        chartColorMap.set(counterId, nextColor);
    }
    return chartColorMap.get(counterId);
}

function inizializzaGrafico() {
    const ctx = document.getElementById('chart-consumi').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { title: { display: true, text: 'Mese' } }, y: { beginAtZero: true, title: { display: true, text: 'Consumo' } } },
            plugins: { tooltip: { mode: 'index', intersect: false }, legend: { display: true, position: 'top', labels: { usePointStyle: true } } }
        }
    });
    aggiornaGrafico();
}

function aggiornaGrafico() {
    if (!chartInstance) return;
    const start = document.getElementById('filtro-inizio-stat').value;
    const end = document.getElementById('filtro-fine-stat').value;
    const labels = generaEtichetteIntervallo(start, end);

    const visibleTypes = {
        energia: document.getElementById('toggle-energia').checked,
        gas: document.getElementById('toggle-gas').checked,
        acqua: document.getElementById('toggle-acqua').checked,
    };

    // Legge i contatori selezionati dalla variabile `selectedStatCounters` (definita in app.js, ma accessibile globalmente se caricata prima o gestita diversamente. 
    // NOTA: Per ora assumiamo che selectedStatCounters sia globale. In un refactoring più avanzato useremmo moduli.)
    const selectedCounterIds = Array.from(selectedStatCounters);

    const monthlyConsumptionsByCounter = new Map();
    ['energia', 'gas', 'acqua'].forEach(type => {
        if (!visibleTypes[type]) return;

        consumi[type].forEach(r => {
            const cont = contatori.find(c => c.id === r.contatoreId);
            if (!cont || cont.stato !== 'attivo') return;

            if (selectedCounterIds.length > 0 && !selectedCounterIds.includes(cont.id)) {
                return;
            }

            if (!monthlyConsumptionsByCounter.has(cont.id)) { monthlyConsumptionsByCounter.set(cont.id, new Map()); }
            const counterMonthlyData = monthlyConsumptionsByCounter.get(cont.id);
            counterMonthlyData.set(r.mese, (counterMonthlyData.get(r.mese) || 0) + (r.consumo || 0));
        });
    });

    let datasets = [];
    const sortedCounters = contatori.filter(c => c.stato === 'attivo' && visibleTypes[c.fornitura]).sort((a, b) => {
        const order = ['energia', 'gas', 'acqua']; return order.indexOf(a.fornitura) - order.indexOf(b.fornitura) || a.nome.localeCompare(b.nome);
    });
    sortedCounters.forEach(cont => {
        if (selectedCounterIds.length > 0 && !selectedCounterIds.includes(cont.id)) {
            return;
        }

        const data = labels.map(label => monthlyConsumptionsByCounter.get(cont.id)?.get(label) || 0);
        const color = getCounterColor(cont.id);
        datasets.push({
            label: `${cont.nome} (${cont.codice}) - ${forniture[cont.fornitura]?.nome || cont.fornitura}`,
            data, backgroundColor: color, borderColor: color, borderWidth: 2, fill: false, tension: 0.1
        });
    });
    chartInstance.data.labels = labels.map(l => formatMese(l));
    chartInstance.data.datasets = datasets;
    chartInstance.update();
}

function generaEtichetteIntervallo(start, end) {
    if (!start && !end) {
        const out = []; const oggi = new Date();
        for (let i = 11; i >= 0; i--) {
            let d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
            out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return out;
    }
    const allMesi = Object.values(consumi).flat().map(c => c.mese).filter(Boolean).sort();
    let startYM = start || allMesi[0] || new Date().toISOString().slice(0, 7);
    let endYM = end || allMesi[allMesi.length - 1] || new Date().toISOString().slice(0, 7);

    let out = [];
    const [startYear, startMonth] = startYM.split('-').map(Number);
    const [endYear, endMonth] = endYM.split('-').map(Number);
    let d = new Date(startYear, startMonth - 1, 1);
    while (d.getFullYear() < endYear || (d.getFullYear() === endYear && d.getMonth() <= endMonth - 1)) {
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        d.setMonth(d.getMonth() + 1);
    }
    return out;
}

function esportaGraficoXLSX() {
    const labels = chartInstance.data.labels;
    const datasets = chartInstance.data.datasets;
    let header = ['Mese', ...datasets.map(ds => ds.label)];
    let rows = [header, ...labels.map((label, i) => [label, ...datasets.map(ds => ds.data[i])])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'ConsumiMensiliDettaglio');
    XLSX.writeFile(wb, `grafico_consumi_mensili_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function esportaGraficoCSV() {
    const labels = chartInstance.data.labels;
    const datasets = chartInstance.data.datasets;
    let header = ['Mese', ...datasets.map(ds => ds.label)];
    let csv = header.join(';') + '\n';
    labels.forEach((label, i) => {
        csv += [label, ...datasets.map(ds => ds.data[i])].join(';') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement('a');
    aEl.href = url;
    aEl.download = `grafico_consumi_${new Date().toISOString().split('T')[0]}.csv`;
    aEl.click();
    URL.revokeObjectURL(url);
}
