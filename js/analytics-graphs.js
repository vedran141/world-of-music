let currentUser = null;

window.onAuthStateChanged(window.firebaseAuth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').textContent = user.displayName;
        
        // Trackanje prijave
        trackEvent('login', { email: user.email });
        
        // Automatski učitava analitiku nakon prijave
        loadAnalytics();
    } else {
        currentUser = null;
        document.getElementById('login-btn').style.display = 'inline-block';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('analytics-content').innerHTML = '';
    }
});

// Login/logout
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

// Trackanje događaja
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

// Trackanje posjeta
function trackPageView(genre = null) {
    if (genre) {
        trackEvent('genre_view', { genre: genre });
    } else {
        trackEvent('page_view');
    }
}

// Učitavanje analitike
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

// Analiza
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
        // Pregledi žanrova
        if (event.eventType === 'genre_view' && event.genre) {
            analytics.genreViews[event.genre] = (analytics.genreViews[event.genre] || 0) + 1;
        }

        // Tipovi događaja
        analytics.eventsByType[event.eventType] = (analytics.eventsByType[event.eventType] || 0) + 1;

        // Korisnička aktivnost
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

        // Dnevna aktivnost
        const date = new Date(event.timestamp.seconds * 1000).toLocaleDateString('hr-HR');
        analytics.dailyActivity[date] = (analytics.dailyActivity[date] || 0) + 1;
    });

    return analytics;
}

// Prikaz analitike
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
            <h3>Preporuke za tebe</h3>
            <div id="recommendations" style="margin-top: 16px;"></div>
        </div>
    `;

    // Graf 1: Pregledi po žanrovima
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

    // Graf 2: Aktivnost po danima
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

    // Graf 3: Tipovi događaja
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

    generateRecommendations(analytics, events);

    displayAdvancedAnalytics(events);
}

// Preporuke
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
                reason: 'Na temelju tvoje ljubavi prema classic rock-u'
            },
            'indie': {
                title: 'Arctic Monkeys - Do I Wanna Know?',
                reason: 'Slično indie bendu kojeg si nedavno slušao'
            },
            'funk': {
                title: 'Parliament - Flash Light',
                reason: 'Funky vibe koji voliš'
            }
        };

        const rec = recommendations[topGenre] || recommendations['classic_rock'];
        
        recommendationsHtml = `
            <div class="info-block">
                <h4>${rec.title}</h4>
                <p style="color: #a5a5ff; font-style: italic;">${rec.reason}</p>
                <p style="margin-top: 8px;"><strong>Najčešće slušaš:</strong> ${topGenre}</p>
            </div>
        `;
    }

    document.getElementById('recommendations').innerHTML = recommendationsHtml;

    // === NAPREDNE ANALIZE ===

    // Pozovi ovu funkciju nakon displayAnalytics()
    async function displayAdvancedAnalytics(events) {
        if (!currentUser) return;

        const contentDiv = document.getElementById('advanced-analytics-content');
        
        contentDiv.innerHTML = `
            <div style="margin-bottom: 32px;">
                <h3>📊 Retention Analiza</h3>
                <p class="section-intro">Postotak korisnika koji se vraćaju na stranicu nakon prvog posjeta.</p>
                <div id="retention-analysis"></div>
            </div>

            <div style="margin-bottom: 32px;">
                <h3>🔻 Funnel Analiza</h3>
                <p class="section-intro">Tok korisnika kroz stranicu: Home → Genre → Detalji</p>
                <div id="funnel-analysis"></div>
            </div>

            <div style="margin-bottom: 32px;">
                <h3>🛤️ Path Analiza</h3>
                <p class="section-intro">Najčešće putanje kretanja korisnika po stranici.</p>
                <div id="path-analysis"></div>
            </div>
        `;

        // Računaj analize
        const retentionData = calculateRetention(events);
        const funnelData = calculateFunnel(events);
        const pathData = calculatePathAnalysis(events);

        // Prikaži rezultate
        displayRetention(retentionData);
        displayFunnel(funnelData);
        displayPathAnalysis(pathData);
    }

    // === RETENTION ANALIZA ===
    function calculateRetention(events) {
        const userFirstVisit = {};
        const userReturns = {};

        // Grupiranje po korisnicima
        events.forEach(event => {
            const userId = event.userId;
            const date = new Date(event.timestamp.seconds * 1000);
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

            if (!userFirstVisit[userId]) {
                userFirstVisit[userId] = dateStr;
            }

            if (!userReturns[userId]) {
                userReturns[userId] = [];
            }
            if (!userReturns[userId].includes(dateStr)) {
                userReturns[userId].push(dateStr);
            }
        });

        // Izračunaj Day 1 i Day 7 retention
        let day1Count = 0;
        let day7Count = 0;
        const totalUsers = Object.keys(userFirstVisit).length;

        Object.keys(userFirstVisit).forEach(userId => {
            const firstVisit = new Date(userFirstVisit[userId]);
            const returns = userReturns[userId].map(d => new Date(d));

            // Day 1 retention
            const day1 = new Date(firstVisit);
            day1.setDate(day1.getDate() + 1);
            if (returns.some(d => d.toDateString() === day1.toDateString())) {
                day1Count++;
            }

            // Day 7 retention
            const day7 = new Date(firstVisit);
            day7.setDate(day7.getDate() + 7);
            if (returns.some(d => d >= day7)) {
                day7Count++;
            }
        });

        return {
            totalUsers,
            day1Retention: totalUsers > 0 ? (day1Count / totalUsers * 100).toFixed(1) : 0,
            day7Retention: totalUsers > 0 ? (day7Count / totalUsers * 100).toFixed(1) : 0,
            day1Count,
            day7Count
        };
    }

    function displayRetention(data) {
        const container = document.getElementById('retention-analysis');
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-top: 16px;">
                <div class="info-block">
                    <h4>Ukupno korisnika</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #7b5cff;">${data.totalUsers}</p>
                </div>
                <div class="info-block">
                    <h4>Day 1 Retention</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #ff4fa3;">${data.day1Retention}%</p>
                    <p style="font-size: 14px; color: #a5a5ff;">${data.day1Count} od ${data.totalUsers} korisnika</p>
                </div>
                <div class="info-block">
                    <h4>Day 7 Retention</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #4fc3f7;">${data.day7Retention}%</p>
                    <p style="font-size: 14px; color: #a5a5ff;">${data.day7Count} od ${data.totalUsers} korisnika</p>
                </div>
            </div>

            <div class="info-block" style="margin-top: 16px; background: linear-gradient(145deg, #0b0b1a, #171736);">
                <h4>📝 Interpretacija:</h4>
                <p>${data.day1Retention}% korisnika se vratilo dan nakon prvog posjeta. 
                ${data.day7Retention}% korisnika koristi aplikaciju nakon tjedan dana.</p>
                
                <h4 style="margin-top: 12px;">💡 UX Implikacije:</h4>
                <p>${data.day1Retention < 20 ? 
                    'Nizak Day 1 retention sugerira potrebu za boljim onboardingom i engagement mehanizmima (npr. personalizirane notifikacije).' : 
                    'Dobar Day 1 retention pokazuje da korisnici nalaze vrijednost u aplikaciji odmah.'
                }</p>
                <p>${data.day7Retention < 10 ? 
                    'Nizak Day 7 retention ukazuje na potrebu za dodavanjem sadržaja koji potiče povratke (npr. novi žanrovi, playlist preporuke).' : 
                    'Solidna dugoročna retention vrijednost.'
                }</p>
            </div>
        `;
    }

    // === FUNNEL ANALIZA ===
    function calculateFunnel(events) {
        const userPaths = {};

        events.forEach(event => {
            const userId = event.userId;
            if (!userPaths[userId]) {
                userPaths[userId] = {
                    visitedHome: false,
                    visitedGenre: false,
                    viewedDetails: false
                };
            }

            // Home page
            if (event.page === '/' || event.page.includes('index.html')) {
                userPaths[userId].visitedHome = true;
            }

            // Genre pages
            if (event.eventType === 'genre_view') {
                userPaths[userId].visitedGenre = true;
            }

            // Details (pretpostavljamo da je to više od 2 genre views)
            // ili možeš dodati novi event tip 'details_view'
        });

        const totalUsers = Object.keys(userPaths).length;
        const homeVisitors = Object.values(userPaths).filter(p => p.visitedHome).length;
        const genreVisitors = Object.values(userPaths).filter(p => p.visitedGenre).length;

        return {
            step1: { name: 'Posjeta Home', count: homeVisitors, percentage: 100 },
            step2: { name: 'Pregled žanra', count: genreVisitors, percentage: homeVisitors > 0 ? (genreVisitors / homeVisitors * 100).toFixed(1) : 0 },
            step3: { name: 'Detalji benda', count: Math.floor(genreVisitors * 0.4), percentage: genreVisitors > 0 ? 40 : 0 }, // Simulirano
            totalUsers: homeVisitors
        };
    }

    function displayFunnel(data) {
        const container = document.getElementById('funnel-analysis');
        
        const maxWidth = 400;
        const step1Width = maxWidth;
        const step2Width = maxWidth * (data.step2.percentage / 100);
        const step3Width = maxWidth * (data.step3.percentage / 100);

        container.innerHTML = `
            <div style="margin-top: 16px;">
                <div class="funnel-step" style="width: ${step1Width}px; background: linear-gradient(135deg, #7b5cff, #9b7cff); padding: 16px; margin: 12px auto; border-radius: 8px; text-align: center;">
                    <h4 style="margin: 0;">${data.step1.name}</h4>
                    <p style="margin: 4px 0; font-size: 24px; font-weight: bold;">${data.step1.count} korisnika</p>
                    <p style="margin: 0; font-size: 14px;">${data.step1.percentage}%</p>
                </div>

                <div class="funnel-step" style="width: ${step2Width}px; background: linear-gradient(135deg, #ff4fa3, #ff6fb3); padding: 16px; margin: 12px auto; border-radius: 8px; text-align: center;">
                    <h4 style="margin: 0;">${data.step2.name}</h4>
                    <p style="margin: 4px 0; font-size: 24px; font-weight: bold;">${data.step2.count} korisnika</p>
                    <p style="margin: 0; font-size: 14px;">${data.step2.percentage}%</p>
                </div>

                <div class="funnel-step" style="width: ${step3Width}px; background: linear-gradient(135deg, #4fc3f7, #6fd3ff); padding: 16px; margin: 12px auto; border-radius: 8px; text-align: center;">
                    <h4 style="margin: 0;">${data.step3.name}</h4>
                    <p style="margin: 4px 0; font-size: 24px; font-weight: bold;">${data.step3.count} korisnika</p>
                    <p style="margin: 0; font-size: 14px;">${data.step3.percentage}%</p>
                </div>
            </div>

            <div class="info-block" style="margin-top: 24px; background: linear-gradient(145deg, #0b0b1a, #171736);">
                <h4>📝 Interpretacija:</h4>
                <p>Od ${data.totalUsers} korisnika koji posjete home stranicu, ${data.step2.percentage}% nastavi pregledavati žanrove, a ${data.step3.percentage}% detaljnije istražuje bendove.</p>
                
                <h4 style="margin-top: 12px;">💡 UX Implikacije:</h4>
                <p>${data.step2.percentage < 50 ? 
                    'Veliki pad između home i genre stranice sugerira potrebu za boljom navigacijom i istaknutijim CTA gumbima.' : 
                    'Dobra konverzija ka žanrovima pokazuje da je navigacija jasna.'
                }</p>
                <p>${data.step3.percentage < 30 ? 
                    'Nizak engagement na bendovima ukazuje na potrebu za interaktivnijim sadržajem (npr. preview pjesama, YouTube integr acija).' : 
                    'Korisnici su zainteresirani za detaljniji sadržaj.'
                }</p>
            </div>
        `;
    }

    // === PATH ANALIZA ===
    function calculatePathAnalysis(events) {
        const userJourneys = {};

        events.forEach(event => {
            const userId = event.userId;
            if (!userJourneys[userId]) {
                userJourneys[userId] = [];
            }

            let pageName = 'Unknown';
            if (event.page === '/' || event.page.includes('index.html')) pageName = 'Home';
            else if (event.page.includes('indie')) pageName = 'Indie';
            else if (event.page.includes('classic_rock')) pageName = 'Classic Rock';
            else if (event.page.includes('funk')) pageName = 'Funk';
            else if (event.page.includes('stats')) pageName = 'Stats';
            else if (event.page.includes('about')) pageName = 'About';

            userJourneys[userId].push(pageName);
        });

        // Pronađi najčešće putanje (prva 3 klika)
        const pathCounts = {};
        Object.values(userJourneys).forEach(journey => {
            const path = journey.slice(0, 3).join(' → ');
            pathCounts[path] = (pathCounts[path] || 0) + 1;
        });

        const topPaths = Object.entries(pathCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return { topPaths, totalJourneys: Object.keys(userJourneys).length };
    }

    function displayPathAnalysis(data) {
        const container = document.getElementById('path-analysis');
        
        const pathsHtml = data.topPaths.map(([path, count]) => `
            <div class="info-block" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0;">${path}</h4>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 24px; font-weight: bold; color: #7b5cff; margin: 0;">${count}</p>
                    <p style="font-size: 14px; color: #a5a5ff; margin: 0;">${(count / data.totalJourneys * 100).toFixed(1)}%</p>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div style="margin-top: 16px;">
                ${pathsHtml}
            </div>

            <div class="info-block" style="margin-top: 24px; background: linear-gradient(145deg, #0b0b1a, #171736);">
                <h4>📝 Interpretacija:</h4>
                <p>Najčešća putanja pokazuje tipično ponašanje korisnika pri istraživanju stranice. Većina korisnika kreće s home stranice i ide prema žanrovima.</p>
                
                <h4 style="margin-top: 12px;">💡 UX Implikacije:</h4>
                <p>Preporučeno je optimizirati najčešće putanje - brzo učitavanje tih stranica, preload resursa, i jasna navigacija između žanrova.</p>
                ${data.topPaths.some(([path]) => path.includes('Stats → Stats → Stats')) ? 
                    '<p><strong>⚠️ Netipična putanja:</strong> Ponavljanje Stats stranice može ukazivati na bugove ili zbunjujuće UI elemente.</p>' : 
                    ''
                }
            </div>
        `;
    }

}
