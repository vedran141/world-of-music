// Google Analytics API Configuration
const CLIENT_ID = '1093306972763-1uld61mraqce17lquhd3mi6bf01l50cf.apps.googleusercontent.com';
const API_KEY = 'AIzaSyC9wVrhWU9Gz8YEj5h1Hkzs5k9y2va_Qxo';
const PROPERTY_ID = '521095907';
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Inicijalizacija Google API
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [], // Prazan - koristimo direktan fetch
        });
        gapiInited = true;
        maybeEnableButtons();
        console.log('GAPI initialized successfully');
    } catch (err) {
        console.error('GAPI init error:', err);
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // definirano kasnije
    });
    gisInited = true;
    maybeEnableButtons();
    console.log('GIS initialized successfully');
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize-btn').style.display = 'inline-block';
        console.log('Authorization button enabled');
    }
}

// OAuth 2.0 autentifikacija
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('Auth error:', resp);
            throw (resp);
        }
        console.log('Authorization successful');
        document.getElementById('authorize-btn').style.display = 'none';
        document.getElementById('signout-btn').style.display = 'inline-block';
        await fetchAnalyticsData();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('authorize-btn').style.display = 'inline-block';
        document.getElementById('signout-btn').style.display = 'none';
        document.getElementById('analytics-content').innerHTML = '';
    }
}

// Dohvaćanje podataka iz Google Analytics - KORISTI FETCH umjesto gapi.client
async function fetchAnalyticsData() {
    try {
        document.getElementById('analytics-content').innerHTML = '<p>Učitavanje podataka...</p>';
        
        const token = gapi.client.getToken();
        if (!token) {
            throw new Error('No access token available');
        }

        console.log('Fetching data for Property ID:', PROPERTY_ID);

        // Helper funkcija za API pozive
        async function runReport(body) {
            const response = await fetch(
                `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
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
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`API request failed: ${response.status}`);
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
                    • Property ID nije GA4 format<br>
                    • Nema dovoljno podataka u Analytics-u<br>
                    • Pristupna prava nisu pravilno postavljena<br>
                    • API key ili OAuth kredencijali nisu valjani
                </p>
                <p style="margin-top: 12px; font-size: 13px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px;">
                    <strong>Property ID:</strong> ${PROPERTY_ID}<br>
                    <strong>Scope:</strong> analytics.readonly
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
