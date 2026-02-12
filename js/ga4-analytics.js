// Google Analytics 4 API Configuration
const GA4_CLIENT_ID = '1093306972763-1uld61mraqce17lquhd3mi6bf01l50cf.apps.googleusercontent.com';
const GA4_API_KEY = 'AIzaSyC9wVrhWU9Gz8YEj5h1Hkzs5k9y2va_Qxo';
const GA4_PROPERTY_ID = '521095907';
const GA4_SCOPES = 'https://www.googleapis.com/auth/analytics.readonly';

let ga4TokenClient;
let ga4GapiInited = false;
let ga4GisInited = false;

// Inicijalizacija Google API
function ga4GapiLoaded() {
    gapi.load('client', initializeGA4GapiClient);
}

async function initializeGA4GapiClient() {
    try {
        await gapi.client.init({
            apiKey: GA4_API_KEY,
            discoveryDocs: [],
        });
        ga4GapiInited = true;
        maybeEnableGA4Buttons();
        console.log('GA4 GAPI initialized');
    } catch (err) {
        console.error('GA4 GAPI init error:', err);
    }
}

function ga4GisLoaded() {
    ga4TokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GA4_CLIENT_ID,
        scope: GA4_SCOPES,
        callback: '',
    });
    ga4GisInited = true;
    maybeEnableGA4Buttons();
    console.log('GA4 GIS initialized');
}

function maybeEnableGA4Buttons() {
    if (ga4GapiInited && ga4GisInited) {
        document.getElementById('ga4-authorize-btn').style.display = 'inline-block';
    }
}

// OAuth 2.0 autentifikacija
function handleGA4AuthClick() {
    ga4TokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('GA4 Auth error:', resp);
            return;
        }
        console.log('GA4 Authorization successful');
        document.getElementById('ga4-authorize-btn').style.display = 'none';
        document.getElementById('ga4-signout-btn').style.display = 'inline-block';
        await fetchGA4AnalyticsData();
    };

    if (gapi.client.getToken() === null) {
        ga4TokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        ga4TokenClient.requestAccessToken({prompt: ''});
    }
}

function handleGA4SignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('ga4-authorize-btn').style.display = 'inline-block';
        document.getElementById('ga4-signout-btn').style.display = 'none';
        document.getElementById('ga4-analytics-content').innerHTML = '';
    }
}

// Dohvaćanje podataka iz GA4
async function fetchGA4AnalyticsData() {
    try {
        document.getElementById('ga4-analytics-content').innerHTML = '<p>Učitavanje Google Analytics podataka...</p>';
        
        const token = gapi.client.getToken();

        async function runGA4Report(body) {
            const response = await fetch(
                `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                throw new Error(`GA4 API error: ${response.status}`);
            }

            return await response.json();
        }

        // 1. Aktivni korisnici po uređaju (zadnjih 30 dana)
        const deviceData = await runGA4Report({
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'activeUsers' }]
        });

        // 2. Sesije po danima (zadnjih 7 dana)
        const sessionsData = await runGA4Report({
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'date' }],
            metrics: [{ name: 'sessions' }]
        });

        // 3. Top 10 stranica
        const pagesData = await runGA4Report({
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [{ name: 'screenPageViews' }],
            limit: 10
        });

        // 4. Ukupni aktivni korisnici
        const totalUsersData = await runGA4Report({
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }]
        });

        if (!deviceData.rows || deviceData.rows.length === 0) {
            document.getElementById('ga4-analytics-content').innerHTML = `
                <div style="background: linear-gradient(145deg, #0b0b1a, #171736); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 20px;">
                    <h3 style="color: #ffd740;">Nema dostupnih podataka</h3>
                    <p>Google Analytics trenutno nema podataka za ovaj Property.</p>
                </div>
            `;
            return;
        }

        displayGA4Analytics(deviceData, sessionsData, pagesData, totalUsersData);

    } catch (err) {
        console.error('GA4 Fetch error:', err);
        document.getElementById('ga4-analytics-content').innerHTML = `
            <div style="background: linear-gradient(145deg, #2d0a1f, #1a0a2d); border: 1px solid #ff4fa3; border-radius: 10px; padding: 20px;">
                <h3 style="color: #ff4fa3;">❌ Greška</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

// Prikaz GA4 podataka
function displayGA4Analytics(deviceData, sessionsData, pagesData, totalUsersData) {
    const contentDiv = document.getElementById('ga4-analytics-content');
    
    // Extract totals
    const totalUsers = totalUsersData.rows?.[0]?.metricValues[0]?.value || 0;
    const totalSessions = totalUsersData.rows?.[0]?.metricValues[1]?.value || 0;
    const totalPageViews = totalUsersData.rows?.[0]?.metricValues[2]?.value || 0;

    contentDiv.innerHTML = `
        <div style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 16px;">Ključne metrike (zadnjih 30 dana)</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="info-block">
                    <h4>Aktivni korisnici</h4>
                    <p style="font-size: 32px; font-weight: bold; color: #7b5cff;">${totalUsers}</p>
                </div>
                <div class="info-block">
                    <h4>Sesije</h4>
                    <p style="font-size: 32px; font-weight: bold; color: #ff4fa3;">${totalSessions}</p>
                </div>
                <div class="info-block">
                    <h4>Pregledi stranica</h4>
                    <p style="font-size: 32px; font-weight: bold; color: #4fc3f7;">${totalPageViews}</p>
                </div>
            </div>
        </div>

        <div class="analytics-grid">
            <div class="chart-container">
                <h3>Korisnici po uređajima</h3>
                <canvas id="ga4DeviceChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Sesije po danima (7 dana)</h3>
                <canvas id="ga4SessionsChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Top stranice</h3>
                <canvas id="ga4PagesChart"></canvas>
            </div>
        </div>

        <div style="margin-top: 24px;">
            <h3>Detaljna tablica - top stranice</h3>
            <div id="ga4-pages-table" style="overflow-x: auto;"></div>
        </div>
    `;

    // Graf 1: Pie chart - uređaji
    new Chart(document.getElementById('ga4DeviceChart'), {
        type: 'pie',
        data: {
            labels: deviceData.rows.map(row => row.dimensionValues[0].value),
            datasets: [{
                data: deviceData.rows.map(row => parseInt(row.metricValues[0].value)),
                backgroundColor: ['#7b5cff', '#ff4fa3', '#4fc3f7', '#ffd740']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#f5f5f5' } } }
        }
    });

    // Graf 2: Line chart - sesije
    new Chart(document.getElementById('ga4SessionsChart'), {
        type: 'line',
        data: {
            labels: sessionsData.rows.map(row => {
                const date = row.dimensionValues[0].value;
                return `${date.slice(6,8)}.${date.slice(4,6)}.`;
            }),
            datasets: [{
                label: 'Sesije',
                data: sessionsData.rows.map(row => parseInt(row.metricValues[0].value)),
                borderColor: '#7b5cff',
                backgroundColor: 'rgba(123, 92, 255, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#f5f5f5' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { ticks: { color: '#f5f5f5' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            },
            plugins: { legend: { labels: { color: '#f5f5f5' } } }
        }
    });

    // Graf 3: Horizontal bar chart - stranice
    new Chart(document.getElementById('ga4PagesChart'), {
        type: 'bar',
        data: {
            labels: pagesData.rows.map(row => row.dimensionValues[0].value),
            datasets: [{
                label: 'Pregledi',
                data: pagesData.rows.map(row => parseInt(row.metricValues[0].value)),
                backgroundColor: '#ff4fa3'
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                y: { ticks: { color: '#f5f5f5' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { beginAtZero: true, ticks: { color: '#f5f5f5' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            },
            plugins: { legend: { labels: { color: '#f5f5f5' } } }
        }
    });

    // Tablica stranica
    const tableHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <thead>
                <tr style="background: rgba(123, 92, 255, 0.2);">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #7b5cff;">#</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #7b5cff;">Stranica</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #7b5cff;">Pregledi</th>
                </tr>
            </thead>
            <tbody>
                ${pagesData.rows.map((row, index) => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <td style="padding: 12px;">${index + 1}</td>
                        <td style="padding: 12px;"><code>${row.dimensionValues[0].value}</code></td>
                        <td style="padding: 12px; text-align: right; font-weight: bold; color: #7b5cff;">${row.metricValues[0].value}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    document.getElementById('ga4-pages-table').innerHTML = tableHtml;
}