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
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://analyticsdata.googleapis.com/$discovery/rest?version=v1beta'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // definirano kasnije
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize-btn').style.display = 'inline-block';
    }
}

// OAuth 2.0 autentifikacija
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
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

// Dohvaćanje podataka iz Google Analytics
async function fetchAnalyticsData() {
    try {
        // Prikaz loading statusa
        document.getElementById('analytics-content').innerHTML = '<p>Učitavanje podataka...</p>';

        // Poziv 1: Broj korisnika po uređaju (device category)
        const deviceResponse = await gapi.client.request({
            path: `/v1beta/properties/${PROPERTY_ID}:runReport`,
            method: 'POST',
            body: {
                dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
                dimensions: [{ name: 'deviceCategory' }],
                metrics: [{ name: 'activeUsers' }]
            }
        });

        // Poziv 2: Broj sesija po danu (zadnjih 7 dana)
        const sessionsResponse = await gapi.client.request({
            path: `/v1beta/properties/${PROPERTY_ID}:runReport`,
            method: 'POST',
            body: {
                dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
                dimensions: [{ name: 'date' }],
                metrics: [{ name: 'sessions' }]
            }
        });

        // Poziv 3: Top 5 stranica
        const pagesResponse = await gapi.client.request({
            path: `/v1beta/properties/${PROPERTY_ID}:runReport`,
            method: 'POST',
            body: {
                dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
                dimensions: [{ name: 'pagePath' }],
                metrics: [{ name: 'screenPageViews' }],
                limit: 5
            }
        });

        // Obrada podataka i vizualizacija
        displayAnalytics(deviceResponse, sessionsResponse, pagesResponse);

    } catch (err) {
        document.getElementById('analytics-content').innerHTML = `<p style="color: #ff4fa3;">Greška: ${err.message}</p>`;
        console.error(err);
    }
}

// Vizualizacija s Chart.js
function displayAnalytics(deviceData, sessionsData, pagesData) {
    const contentDiv = document.getElementById('analytics-content');
    contentDiv.innerHTML = `
        <div class="analytics-grid">
            <div class="chart-container">
                <h3>Korisnici po uređajima (zadnjih 30 dana)</h3>
                <canvas id="deviceChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Sesije po danima (zadnjih 7 dana)</h3>
                <canvas id="sessionsChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Top 5 najposjećenijih stranica</h3>
                <canvas id="pagesChart"></canvas>
            </div>
        </div>
    `;

    // Graf 1: Pie chart za uređaje
    const deviceLabels = deviceData.result.rows.map(row => row.dimensionValues[0].value);
    const deviceValues = deviceData.result.rows.map(row => parseInt(row.metricValues[0].value));

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
    const sessionLabels = sessionsData.result.rows.map(row => {
        const date = row.dimensionValues[0].value;
        return `${date.slice(6,8)}.${date.slice(4,6)}.`;
    });
    const sessionValues = sessionsData.result.rows.map(row => parseInt(row.metricValues[0].value));

    new Chart(document.getElementById('sessionsChart'), {
        type: 'line',
        data: {
            labels: sessionLabels,
            datasets: [{
                label: 'Sesije',
                data: sessionValues,
                borderColor: '#7b5cff',
                backgroundColor: 'rgba(123, 92, 255, 0.1)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#f5f5f5' }
                },
                x: { 
                    ticks: { color: '#f5f5f5' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f5f5f5' } }
            }
        }
    });

    // Graf 3: Bar chart za stranice
    const pageLabels = pagesData.result.rows.map(row => row.dimensionValues[0].value);
    const pageValues = pagesData.result.rows.map(row => parseInt(row.metricValues[0].value));

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
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#f5f5f5' }
                },
                x: { 
                    ticks: { color: '#f5f5f5' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f5f5f5' } }
            }
        }
    });
}
