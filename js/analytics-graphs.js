// analytics-graphs.js - Complete Firebase Analytics Implementation

let currentUser = null;

// === AUTH STATE LISTENER ===
window.onAuthStateChanged(window.firebaseAuth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').textContent = user.displayName;
        
        // Track login
        trackEvent('login', { email: user.email });
        
        // Automatski učitaj analytics nakon logina
        loadAnalytics();
    } else {
        currentUser = null;
        document.getElementById('login-btn').style.display = 'inline-block';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('analytics-content').innerHTML = '';
    }
});

// === LOGIN/LOGOUT ===
async function loginWithGoogle() {
    try {
        await window.signInWithPopup(window.firebaseAuth, window.googleProvider);
    } catch (error) {
        console.error('Login error:', error);
        alert('Greška pri prijavi: ' + error.message);
    }
}

async function logoutUser() {
    await window.signOut(window.firebaseAuth);
}

// === EVENT TRACKING ===
async function trackEvent(eventType, data = {}) {
    if (!currentUser) return;
    
    try {
        await window.firestoreAddDoc(window.firestoreCollection(window.firebaseDb, 'events'), {
            userId: currentUser.uid,
            userName: currentUser.displayName,
            email: currentUser.email,
            eventType: eventType,
            page: window.location.pathname,
            timestamp: new Date(),
            ...data
        });
        console.log('Event tracked:', eventType);
    } catch (error) {
        console.error('Tracking error:', error);
    }
}

// Track genre page visits (dodaj ovo na sve stranice)
function trackPageView(genre = null) {
    if (genre) {
        trackEvent('genre_view', { genre: genre });
    } else {
        trackEvent('page_view');
    }
}

// === LOAD ANALYTICS DATA ===
async function loadAnalytics() {
    if (!currentUser) {
        document.getElementById('analytics-content').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="font-size: 18px; color: #d0d0ff;">Prijavite se za prikaz analitike</p>
            </div>
        `;
        return;
    }

    document.getElementById('analytics-content').innerHTML = '<p>Učitavanje analitike...</p>';

    try {
        // Dohvati SVE događaje svih korisnika
        const eventsRef = window.firestoreCollection(window.firebaseDb, 'events');
        const q = window.firestoreQuery(eventsRef, window.firestoreOrderBy('timestamp', 'desc'));
        const querySnapshot = await window.firestoreGetDocs(q);

        const events = [];
        querySnapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() });
        });

        console.log('Loaded events:', events.length);

        if (events.length === 0) {
            document.getElementById('analytics-content').innerHTML = `
                <div style="background: linear-gradient(145deg, #0b0b1a, #171736); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 20px;">
                    <h3 style="color: #ffd740;">Nema dostupnih podataka</h3>
                    <p>Posjetite stranice s žanrovima (Classic Rock, Indie, Funk) kako biste generirali podatke za analizu.</p>
                    <p style="margin-top: 12px;">Trenutno praćeni događaji: login, genre_view, page_view</p>
                </div>
            `;
            return;
        }

        // Analiza podataka
        const analytics = analyzeEvents(events);
        
        // Vizualizacija
        displayAnalytics(analytics, events);

    } catch (error) {
        console.error('Load analytics error:', error);
        document.getElementById('analytics-content').innerHTML = `
            <div style="background: linear-gradient(145deg, #2d0a1f, #1a0a2d); border: 1px solid #ff4fa3; border-radius: 10px; padding: 20px;">
                <h3 style="color: #ff4fa3;">Greška pri učitavanju podataka</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// === ANALYZE EVENTS ===
function analyzeEvents(events) {
    const analytics = {
        totalEvents: events.length,
        uniqueUsers: new Set(events.map(e => e.userId)).size,
        genreViews: {},
        userActivity: {},
        eventsByType: {},
        dailyActivity: {}
    };

    events.forEach(event => {
        // Genre views
        if (event.eventType === 'genre_view' && event.genre) {
            analytics.genreViews[event.genre] = (analytics.genreViews[event.genre] || 0) + 1;
        }

        // Event types
        analytics.eventsByType[event.eventType] = (analytics.eventsByType[event.eventType] || 0) + 1;

        // User activity
        if (!analytics.userActivity[event.userId]) {
            analytics.userActivity[event.userId] = {
                name: event.userName || 'Unknown',
                email: event.email || '',
                events: 0,
                genres: []
            };
        }
        analytics.userActivity[event.userId].events++;
        if (event.genre && !analytics.userActivity[event.userId].genres.includes(event.genre)) {
            analytics.userActivity[event.userId].genres.push(event.genre);
        }

        // Daily activity
        const date = new Date(event.timestamp.seconds * 1000).toLocaleDateString('hr-HR');
        analytics.dailyActivity[date] = (analytics.dailyActivity[date] || 0) + 1;
    });

    return analytics;
}

// === DISPLAY ANALYTICS ===
function displayAnalytics(analytics, events) {
    const contentDiv = document.getElementById('analytics-content');
    
    contentDiv.innerHTML = `
        <div style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 16px;">Pregled aktivnosti</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="info-block">
                    <h4>Ukupno događaja</h4>
                    <p style="font-size: 32px; font-weight: bold; color: #7b5cff;">${analytics.totalEvents}</p>
                </div>
                <div class="info-block">
                    <h4>Jedinstvenih korisnika</h4>
                    <p style="font-size: 32px; font-weight: bold; color: #ff4fa3;">${analytics.uniqueUsers}</p>
                </div>
                <div class="info-block">
                    <h4>Pregleda žanrova</h4>
                    <p style="font-size: 32px; font-weight: bold; color: #4fc3f7;">${Object.values(analytics.genreViews).reduce((a, b) => a + b, 0)}</p>
                </div>
            </div>
        </div>

        <div class="analytics-grid">
            <div class="chart-container">
                <h3>Pregledi po žanrovima</h3>
                <canvas id="genreChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Aktivnost po danima</h3>
                <canvas id="dailyChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Tipovi događaja</h3>
                <canvas id="eventTypeChart"></canvas>
            </div>
        </div>

        <div style="margin-top: 32px;">
            <h3>👥 Aktivnost korisnika</h3>
            <div id="user-activity-list" style="margin-top: 16px;"></div>
        </div>

        <div style="margin-top: 32px;">
            <h3>🎵 Preporuke za tebe</h3>
            <div id="recommendations" style="margin-top: 16px;"></div>
        </div>
    `;

    // Chart 1: Genre views (Bar chart)
    if (Object.keys(analytics.genreViews).length > 0) {
        new Chart(document.getElementById('genreChart'), {
            type: 'bar',
            data: {
                labels: Object.keys(analytics.genreViews),
                datasets: [{
                    label: 'Broj pregleda',
                    data: Object.values(analytics.genreViews),
                    backgroundColor: ['#7b5cff', '#ff4fa3', '#4fc3f7']
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
    }

    // Chart 2: Daily activity (Line chart)
    const sortedDates = Object.keys(analytics.dailyActivity).sort();
    new Chart(document.getElementById('dailyChart'), {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Aktivnost',
                data: sortedDates.map(date => analytics.dailyActivity[date]),
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

    // Chart 3: Event types (Pie chart)
    new Chart(document.getElementById('eventTypeChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(analytics.eventsByType),
            datasets: [{
                data: Object.values(analytics.eventsByType),
                backgroundColor: ['#7b5cff', '#ff4fa3', '#4fc3f7', '#ffd740']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#f5f5f5' } } }
        }
    });

    // User activity list
    const userActivityHtml = Object.entries(analytics.userActivity)
        .sort((a, b) => b[1].events - a[1].events)
        .slice(0, 5)
        .map(([userId, data]) => `
            <div class="info-block" style="margin-bottom: 12px;">
                <h4>${data.name}</h4>
                <p><strong>${data.events}</strong> događaja • Žanrovi: ${data.genres.join(', ') || 'Nema'}</p>
            </div>
        `).join('');
    
    document.getElementById('user-activity-list').innerHTML = userActivityHtml || '<p>Nema podataka o aktivnosti korisnika.</p>';

    // Recommendations (basic content-based)
    generateRecommendations(analytics, events);
}

// === GENERATE RECOMMENDATIONS ===
function generateRecommendations(analytics, events) {
    if (!currentUser) return;

    // Get current user's genre preferences
    const userEvents = events.filter(e => e.userId === currentUser.uid && e.eventType === 'genre_view');
    const genreCounts = {};
    
    userEvents.forEach(event => {
        if (event.genre) {
            genreCounts[event.genre] = (genreCounts[event.genre] || 0) + 1;
        }
    });

    const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);

    let recommendationsHtml = '';

    if (sortedGenres.length === 0) {
        recommendationsHtml = `
            <div class="info-block">
                <p>Posjetite stranice s žanrovima kako biste dobili personalizirane preporuke!</p>
            </div>
        `;
    } else {
        const topGenre = sortedGenres[0][0];
        const recommendations = {
            'classic_rock': {
                title: 'Led Zeppelin - Stairway to Heaven',
                reason: 'Temeljem tvoje ljubavi prema Classic Rock-u'
            },
            'indie': {
                title: 'Arctic Monkeys - Do I Wanna Know?',
                reason: 'Slično indie bendu koji si nedavno pregledao'
            },
            'funk': {
                title: 'Parliament - Flash Light',
                reason: 'Funky vibe koji voliš'
            }
        };

        const rec = recommendations[topGenre] || recommendations['classic_rock'];
        
        recommendationsHtml = `
            <div class="info-block">
                <h4>🎵 ${rec.title}</h4>
                <p style="color: #a5a5ff; font-style: italic;">${rec.reason}</p>
                <p style="margin-top: 8px;"><strong>Najčešće slušaš:</strong> ${topGenre}</p>
            </div>
        `;
    }

    document.getElementById('recommendations').innerHTML = recommendationsHtml;
}
