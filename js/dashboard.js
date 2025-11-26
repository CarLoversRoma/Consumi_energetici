/* ===========================
   Dashboard Logic
   =========================== */

function initDashboard() {
    renderDashboard();
}

function renderDashboard() {
    const dashboard = document.getElementById('dashboard-content');
    if (!dashboard) return;

    // Leggi stato filtri
    const showEnergia = document.getElementById('dash-filter-energia')?.checked ?? true;
    const showGas = document.getElementById('dash-filter-gas')?.checked ?? true;
    const showAcqua = document.getElementById('dash-filter-acqua')?.checked ?? true;

    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);

    // Calcola totali
    const stats = {
        energia: calculateStats('energia'),
        gas: calculateStats('gas'),
        acqua: calculateStats('acqua')
    };

    let html = '<div class="columns is-multiline">';
    if (showEnergia) html += createCard('Energia', stats.energia, 'kWh', '⚡');
    if (showGas) html += createCard('Gas', stats.gas, 'kWh', '🔥');
    if (showAcqua) html += createCard('Acqua', stats.acqua, 'm³', '💧');
    html += '</div>';

    html += `
    <div class="columns">
        <div class="column is-6">
            <div class="card-min">
                <h4 class="title is-6">Andamento Spesa Totale (Anno Corrente)</h4>
                <div class="chart-wrap" style="height: 250px;">
                    <canvas id="chart-dashboard-spesa"></canvas>
                </div>
            </div>
        </div>
        <div class="column is-6">
             <div class="card-min">
                <h4 class="title is-6">Ripartizione Spesa Anno Corrente</h4>
                <div class="chart-wrap" style="height: 250px; position: relative;">
                    <canvas id="chart-dashboard-pie"></canvas>
                </div>
            </div>
        </div>
    </div>
    `;

    dashboard.innerHTML = html;

    renderDashboardCharts(showEnergia, showGas, showAcqua);
}

function calculateStats(type) {
    const data = consumi[type] || [];

    // Trova l'ultimo mese con dati disponibili
    // Ordina per mese decrescente (YYYY-MM)
    const sortedData = [...data].sort((a, b) => b.mese.localeCompare(a.mese));
    const lastEntry = sortedData[0];

    const currentMonth = lastEntry ? lastEntry.mese : new Date().toISOString().slice(0, 7);

    // Calcola il mese precedente a quello trovato
    const d = new Date(currentMonth + '-01');
    d.setMonth(d.getMonth() - 1);
    const lastMonth = d.toISOString().slice(0, 7);

    // Dati Mese Corrente (che è l'ultimo disponibile)
    const curr = data.filter(c => c.mese === currentMonth).reduce((acc, c) => ({
        consumo: acc.consumo + (c.consumo || 0),
        importo: acc.importo + (c.importo || 0)
    }), { consumo: 0, importo: 0 });

    // Dati Mese Precedente (per confronto)
    const last = data.filter(c => c.mese === lastMonth).reduce((acc, c) => ({
        consumo: acc.consumo + (c.consumo || 0),
        importo: acc.importo + (c.importo || 0)
    }), { consumo: 0, importo: 0 });

    // Calcolo Medie e Costo Materia Prima (su tutti i dati disponibili)
    const validData = data.filter(c => c.consumo > 0 && c.importo > 0);
    const totali = validData.reduce((acc, c) => ({
        consumo: acc.consumo + c.consumo,
        importo: acc.importo + c.importo,
        count: acc.count + 1
    }), { consumo: 0, importo: 0, count: 0 });

    const mediaSpesa = totali.count > 0 ? totali.importo / totali.count : 0;
    const mediaConsumo = totali.count > 0 ? totali.consumo / totali.count : 0;
    const costoMateriaPrima = totali.consumo > 0 ? totali.importo / totali.consumo : 0;

    return {
        current: curr,
        last: last,
        diffImporto: curr.importo - last.importo,
        diffConsumo: curr.consumo - last.consumo,
        mediaSpesa: mediaSpesa,
        mediaConsumo: mediaConsumo,
        costoMateriaPrima: costoMateriaPrima,
        displayMonth: currentMonth // Passiamo il mese visualizzato per la label
    };
}

function createCard(title, stats, unit, icon) {
    const trendClass = stats.diffImporto > 0 ? 'has-text-danger' : (stats.diffImporto < 0 ? 'has-text-success' : 'has-text-grey');
    const trendIcon = stats.diffImporto > 0 ? '▲' : (stats.diffImporto < 0 ? '▼' : '—');

    // Ottieni il nome del mese visualizzato
    const [year, month] = stats.displayMonth.split('-');
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleString('it-IT', { month: 'long' });
    const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return `
    <div class="column is-4">
        <div class="card-min dashboard-card">
            <div class="media">
                <div class="media-left">
                    <span class="icon is-large" style="background: #f5f7fa; border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                        ${icon}
                    </span>
                </div>
                <div class="media-content">
                    <p class="title is-5">${title}</p>
                    <p class="subtitle is-6 small-muted">Ultimo Dato: ${monthLabel} ${year}</p>
                </div>
            </div>
            <div class="content">
                <div class="columns is-mobile is-multiline">
                    <div class="column is-6">
                        <p class="heading">Spesa</p>
                        <p class="title is-4">€${stats.current.importo.toFixed(2)}</p>
                        <p class="help ${trendClass}">${trendIcon} €${Math.abs(stats.diffImporto).toFixed(2)} vs mese prec.</p>
                    </div>
                    <div class="column is-6">
                        <p class="heading">Consumo</p>
                        <p class="title is-4">${stats.current.consumo.toFixed(1)} <span style="font-size:0.8rem">${unit}</span></p>
                    </div>
                    
                    <div class="column is-12" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                        <div class="columns is-mobile">
                            <div class="column is-4">
                                <p class="heading" style="font-size: 0.65rem;">Media Spesa</p>
                                <p class="subtitle is-6">€${stats.mediaSpesa.toFixed(2)}</p>
                            </div>
                            <div class="column is-4">
                                <p class="heading" style="font-size: 0.65rem;">Media Cons.</p>
                                <p class="subtitle is-6">${stats.mediaConsumo.toFixed(1)}</p>
                            </div>
                            <div class="column is-4">
                                <p class="heading" style="font-size: 0.65rem;">Costo Mat. Prima</p>
                                <p class="subtitle is-6">€${stats.costoMateriaPrima.toFixed(3)}/${unit}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

let dashboardChartSpesa = null;
let dashboardChartPie = null;

function renderDashboardCharts(showEnergia, showGas, showAcqua) {
    // Chart Spesa
    const ctxSpesa = document.getElementById('chart-dashboard-spesa');
    if (ctxSpesa) {
        if (dashboardChartSpesa) dashboardChartSpesa.destroy();

        // Genera etichette per l'anno corrente (Gennaio - Dicembre)
        const currentYear = new Date().getFullYear();
        const labels = [];
        for (let i = 0; i < 12; i++) {
            const month = String(i + 1).padStart(2, '0');
            labels.push(`${currentYear}-${month}`);
        }

        const datasets = [];
        if (showEnergia) {
            datasets.push({
                label: 'Energia',
                data: labels.map(m => getMonthlyTotal('energia', m)),
                borderColor: '#fdb462',
                backgroundColor: '#fdb462',
                tension: 0.3
            });
        }
        if (showGas) {
            datasets.push({
                label: 'Gas',
                data: labels.map(m => getMonthlyTotal('gas', m)),
                borderColor: '#fb8072',
                backgroundColor: '#fb8072',
                tension: 0.3
            });
        }
        if (showAcqua) {
            datasets.push({
                label: 'Acqua',
                data: labels.map(m => getMonthlyTotal('acqua', m)),
                borderColor: '#8dd3c7',
                backgroundColor: '#8dd3c7',
                tension: 0.3
            });
        }

        dashboardChartSpesa = new Chart(ctxSpesa, {
            type: 'bar',
            data: { labels: labels.map(formatMese), datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });
    }

    // Chart Pie - Somma anno solare corrente
    const ctxPie = document.getElementById('chart-dashboard-pie');
    if (ctxPie) {
        if (dashboardChartPie) dashboardChartPie.destroy();

        // Calcola i totali per l'anno corrente
        const currentYear = new Date().getFullYear();

        const totals = [];
        const labels = [];
        const bgColors = [];

        if (showEnergia) {
            totals.push(getYearlyTotal('energia', currentYear));
            labels.push('Energia');
            bgColors.push('#fdb462');
        }
        if (showGas) {
            totals.push(getYearlyTotal('gas', currentYear));
            labels.push('Gas');
            bgColors.push('#fb8072');
        }
        if (showAcqua) {
            totals.push(getYearlyTotal('acqua', currentYear));
            labels.push('Acqua');
            bgColors.push('#8dd3c7');
        }

        const totalSum = totals.reduce((a, b) => a + b, 0);
        const container = ctxPie.parentElement;

        // Rimuovi eventuali messaggi preesistenti
        const existingMsg = container.querySelector('.no-data-msg');
        if (existingMsg) existingMsg.remove();

        // Aggiorna il titolo del riquadro
        const pieTitle = container.parentElement.querySelector('.title');
        if (pieTitle) {
            pieTitle.textContent = `Ripartizione Spesa Anno ${currentYear}`;
        }

        if (totalSum === 0) {
            ctxPie.style.display = 'none';
            const msg = document.createElement('div');
            msg.className = 'no-data-msg';
            msg.style.position = 'absolute';
            msg.style.top = '50%';
            msg.style.left = '50%';
            msg.style.transform = 'translate(-50%, -50%)';
            msg.style.textAlign = 'center';
            msg.style.color = '#999';
            msg.innerHTML = '<p>Nessuna spesa registrata<br>per l\'anno corrente</p>';
            container.appendChild(msg);
        } else {
            ctxPie.style.display = 'block';
            dashboardChartPie = new Chart(ctxPie, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: totals,
                        backgroundColor: bgColors
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
        }
    }
}

function getMonthlyTotal(type, month) {
    return (consumi[type] || [])
        .filter(c => c.mese === month)
        .reduce((sum, c) => sum + (c.importo || 0), 0);
}

function getYearlyTotal(type, year) {
    return (consumi[type] || [])
        .filter(c => c.mese.startsWith(year.toString()))
        .reduce((sum, c) => sum + (c.importo || 0), 0);
}
