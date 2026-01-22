// Dohvaćanje podataka iz Google Analytics - PREKO BACKEND-a
async function fetchAnalyticsData() {
    try {
        document.getElementById('analytics-content').innerHTML = '<p>Učitavanje podataka...</p>';
        
        console.log('Fetching data via backend proxy...');

        // Helper funkcija za API pozive - POZIVA BACKEND umjesto Google direktno
        async function runReport(body) {
            const response = await fetch('/api/analytics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Backend error:', response.status, errorData);
                throw new Error(`Backend request failed: ${response.status} - ${errorData.error}`);
            }

            return await response.json();
        }

        // Poziv 1: Broj korisnika po uređaju
        const deviceData = await runReport({
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'activeUsers' }]
        });

        console.log('Device data:', deviceData);

        // Poziv 2: Broj sesija po danu
        const sessionsData = await runReport({
            dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'date' }],
            metrics: [{ name: 'sessions' }]
        });

        console.log('Sessions data:', sessionsData);

        // Poziv 3: Top 5 stranica
        const pagesData = await runReport({
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [{ name: 'screenPageViews' }],
            limit: 5
        });

        console.log('Pages data:', pagesData);

        // Provjera ima li podataka
        if (!deviceData.rows || deviceData.rows.length === 0) {
            document.getElementById('analytics-content').innerHTML = `
                <div style="background: linear-gradient(145deg, #0b0b1a, #171736); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 20px;">
                    <h3 style="color: #ffd740; margin-bottom: 12px;">⚠️ Nema dostupnih podataka</h3>
                    <p>Google Analytics trenutno nema podataka za prikaz. Mogući razlozi:</p>
                    <ul style="margin-left: 20px; margin-top: 10px; color: #d0d0ff;">
                        <li>Stranica je nova i još nema dovoljno posjeta</li>
                        <li>GA4 tracking kod tek što je postavljen</li>
                        <li>Podaci se još procesiraju (može trajati 24-48h)</li>
                    </ul>
                    <p style="margin-top: 16px; font-style: italic; color: #a5a5ff;">
                        💡 Posjetite stranicu nekoliko puta, pričekajte par sati, pa pokušajte ponovno.
                    </p>
                </div>
            `;
            return;
        }

        // Vizualizacija podataka
        displayAnalytics(deviceData, sessionsData, pagesData);

    } catch (err) {
        console.error('Fetch error:', err);
        
        document.getElementById('analytics-content').innerHTML = `
            <div style="background: linear-gradient(145deg, #2d0a1f, #1a0a2d); border: 1px solid #ff4fa3; border-radius: 10px; padding: 20px; color: #ff9999;">
                <h3 style="color: #ff4fa3; margin-bottom: 12px;">❌ Greška pri dohvaćanju podataka</h3>
                <p><strong>Poruka:</strong> ${err.message}</p>
                <hr style="margin: 16px 0; border-color: rgba(255,79,163,0.3);">
                <p style="font-size: 14px; color: #d0d0ff;">
                    <strong>Mogući uzroci:</strong><br>
                    • Backend serverless funkcija nije dostupna<br>
                    • Service Account nema pristup Analytics Property-ju<br>
                    • Environment variable nije pravilno postavljena
                </p>
            </div>
        `;
    }
}

// Vizualizacija s Chart.js
function displayAnalytics(deviceData, sessionsData, pagesData) {
    const contentDiv = document.getElementById('analytics-content');
    contentDiv.innerHTML = `
        <div class="analytics-grid">
            <div class="chart-container">
                <h3>Korisnici po uređajima (30 dana)</h3>
                <canvas id="deviceChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Sesije po danima (7 dana)</h3>
                <canvas id="sessionsChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Top 5 najposjećenijih stranica</h3>
                <canvas id="pagesChart"></canvas>
            </div>
        </div>
    `;

    // Graf 1: Pie chart za uređaje
    const deviceLabels = deviceData.rows.map(row => row.dimensionValues[0].value);
    const deviceValues = deviceData.rows.map(row => parseInt(row.metricValues[0].value));

    new Chart(document.getElementById('deviceChart'), {
        type: 'pie',
        data: {
            labels: deviceLabels,
            datasets: [{
                data: deviceValues,
                backgroundColor: ['#7b5cff', '#ff4fa3', '#4fc3f7', '#ffd740']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#f5f5f5' } }
            }
        }
    });

    // Graf 2: Line chart za sesije
    const sessionLabels = sessionsData.rows.map(row => {
        const date = row.dimensionValues[0].value;
        return `${date.slice(6,8)}.${date.slice(4,6)}.`;
    });
    const sessionValues = sessionsData.rows.map(row => parseInt(row.metricValues[0].value));

    new Chart(document.getElementById('sessionsChart'), {
        type: 'line',
        data: {
            labels: sessionLabels,
            datasets: [{
                label: 'Sesije',
                data: sessionValues,
                borderColor: '#7b5cff',
                backgroundColor: 'rgba(123, 92, 255, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#f5f5f5' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    ticks: { color: '#f5f5f5' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f5f5f5' } }
            }
        }
    });

    // Graf 3: Bar chart za stranice
    const pageLabels = pagesData.rows.map(row => row.dimensionValues[0].value);
    const pageValues = pagesData.rows.map(row => parseInt(row.metricValues[0].value));

    new Chart(document.getElementById('pagesChart'), {
        type: 'bar',
        data: {
            labels: pageLabels,
            datasets: [{
                label: 'Broj pregleda',
                data: pageValues,
                backgroundColor: '#ff4fa3'
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y', // Horizontalni bar chart
            scales: {
                y: { 
                    ticks: { color: '#f5f5f5' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    beginAtZero: true,
                    ticks: { color: '#f5f5f5' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f5f5f5' } }
            }
        }
    });
}
