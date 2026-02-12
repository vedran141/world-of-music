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
        document.getElementById('advanced-analytics-content').innerHTML = '';
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

// Prikaz analitike - BEZ METRIKA (samo grafovi)
function displayAnalytics(analytics, events) {
    const contentDiv = document.getElementById('analytics-content');
    
    // MAKNUTO: div s metrikama (Ukupno događaja, Jedinstvenih korisnika, Pregleda žanrova)
    
    contentDiv.innerHTML = `
        <div style="margin-top: 16px;">
            <h3>Preporuke za tebe</h3>
            <div id="recommendations" style="margin-top: 16px;"></div>
        </div>
    `;

    generateRecommendations(analytics, events);
    displayAdvancedAnalytics(events);
}

// Preporuke
function generateRecommendations(analytics, events) {
    if (!currentUser) return;

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
                <h4>🎵 ${rec.title}</h4>
                <p style="color: #a5a5ff; font-style: italic;">${rec.reason}</p>
                <p style="margin-top: 8px;"><strong>Najčešće slušaš:</strong> ${topGenre}</p>
            </div>
        `;
    }

    document.getElementById('recommendations').innerHTML = recommendationsHtml;
}

// === NAPREDNE ANALIZE ===
async function displayAdvancedAnalytics(events) {
    if (!currentUser) return;

    const contentDiv = document.getElementById('advanced-analytics-content');
    
    contentDiv.innerHTML = `
        <div style="margin-bottom: 32px;">
            <h3>Retention analiza</h3>
            <p class="section-intro">Postotak korisnika koji se vraćaju na stranicu nakon prvog posjeta.</p>
            <div id="retention-analysis"></div>
        </div>

        <div style="margin-bottom: 32px;">
            <h3>Path analiza</h3>
            <p class="section-intro">Najčešće putanje kretanja korisnika po stranici.</p>
            <div id="path-analysis"></div>
        </div>
    `;

    // Računaj analize
    const retentionData = calculateRetention(events);
    const pathData = calculatePathAnalysis(events);

    // Prikaži rezultate
    displayRetention(retentionData);
    displayPathAnalysis(pathData);
}

// === RETENTION ANALIZA - POPRAVLJENA ===
function calculateRetention(events) {
    const userFirstVisit = {};
    const userAllVisits = {};

    // Grupiranje po korisnicima - UKLJUČI SVE DOGAĐAJE
    events.forEach(event => {
        const userId = event.userId;
        const timestamp = event.timestamp.seconds * 1000;
        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

        // Evidentiraj korisnika
        if (!userFirstVisit[userId]) {
            userFirstVisit[userId] = timestamp;
        } else {
            // Ažuriraj ako je raniji datum
            if (timestamp < userFirstVisit[userId]) {
                userFirstVisit[userId] = timestamp;
            }
        }

        if (!userAllVisits[userId]) {
            userAllVisits[userId] = new Set();
        }
        userAllVisits[userId].add(dateStr);
    });

    // Izračunaj Day 1 i Day 7 retention
    let day1Count = 0;
    let day7Count = 0;
    const totalUsers = Object.keys(userFirstVisit).length;

    Object.keys(userFirstVisit).forEach(userId => {
        const firstVisitTime = userFirstVisit[userId];
        const firstVisitDate = new Date(firstVisitTime);
        const visitDates = Array.from(userAllVisits[userId]).map(d => new Date(d));

        // Day 1 retention - točno sljedeći dan
        const day1 = new Date(firstVisitDate);
        day1.setDate(day1.getDate() + 1);
        const day1Str = day1.toISOString().split('T')[0];
        
        if (userAllVisits[userId].has(day1Str)) {
            day1Count++;
        }

        // Day 7 retention - bilo koji dan nakon 7 dana
        const day7 = new Date(firstVisitDate);
        day7.setDate(day7.getDate() + 7);
        
        if (visitDates.some(d => d >= day7)) {
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
            <h4>Interpretacija:</h4>
            <p>${data.day1Retention}% korisnika se vratilo dan nakon prvog posjeta. 
            ${data.day7Retention}% korisnika koristi aplikaciju nakon tjedan dana.</p>
            
            <h4 style="margin-top: 12px;">UX implikacije:</h4>
            <p>${data.day1Retention < 20 ? 
                'Nizak Day 1 retention sugerira potrebu za boljim engagement mehanizmima (npr. personalizirane notifikacije, email podsjetnici).' : 
                'Dobar Day 1 retention pokazuje da korisnici nalaze vrijednost u aplikaciji odmah nakon prvog posjeta.'
            }</p>
            <p>${data.day7Retention < 10 ? 
                'Nizak Day 7 retention ukazuje na potrebu za dodavanjem sadržaja koji potiče povratke (npr. weekly playlist preporuke, novi bendovi).' : 
                'Solidna dugoročna retention vrijednost pokazuje da aplikacija zadržava korisnike.'
            }</p>
        </div>
    `;
}

// === PATH ANALIZA - POPRAVLJENA (DETALJNIJA) ===
function calculatePathAnalysis(events) {
    const userJourneys = {};

    // Sortiraj događaje po vremenu za svakog korisnika
    const sortedEvents = [...events].sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    sortedEvents.forEach(event => {
        const userId = event.userId;
        if (!userJourneys[userId]) {
            userJourneys[userId] = [];
        }

        // Mapiranje stranica - POBOLJŠANO
        let pageName = 'Unknown';
        const page = event.page || '';
        
        if (page === '/' || page.includes('index.html') || page === '') pageName = 'Home';
        else if (page.includes('indie.html')) pageName = 'Indie';
        else if (page.includes('classic_rock.html')) pageName = 'Classic Rock';
        else if (page.includes('funk.html')) pageName = 'Funk';
        else if (page.includes('stats.html')) pageName = 'Stats';
        else if (page.includes('about.html')) pageName = 'About';
        
        // Također provjeri eventType ako stranica nije jasna
        if (pageName === 'Unknown' && event.eventType === 'genre_view') {
            if (event.genre === 'indie') pageName = 'Indie';
            else if (event.genre === 'classic_rock') pageName = 'Classic Rock';
            else if (event.genre === 'funk') pageName = 'Funk';
        }

        // Dodaj samo ako se razlikuje od prethodnog (izbjegni duplikate)
        const lastPage = userJourneys[userId][userJourneys[userId].length - 1];
        if (lastPage !== pageName) {
            userJourneys[userId].push(pageName);
        }
    });

    // Pronađi najčešće putanje (prva 3-4 koraka)
    const pathCounts = {};
    Object.values(userJourneys).forEach(journey => {
        // Različite duljine putanja
        for (let len = 2; len <= Math.min(4, journey.length); len++) {
            const path = journey.slice(0, len).join(' → ');
            pathCounts[path] = (pathCounts[path] || 0) + 1;
        }
    });

    const topPaths = Object.entries(pathCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8); // Prikaži top 8 putanja

    return { topPaths, totalJourneys: Object.keys(userJourneys).length };
}

function displayPathAnalysis(data) {
    const container = document.getElementById('path-analysis');
    
    const pathsHtml = data.topPaths.map(([path, count]) => `
        <div class="info-block" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
                <h4 style="margin: 0; font-size: 16px;">${path}</h4>
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
            <h4>Interpretacija:</h4>
            <p>Najčešće putanje pokazuju kako korisnici istražuju stranicu. Većina posjeta kreće s Stats stranice (gdje se nalaze analitike i uvid u podatke), a zatim se korismici kreću prema žanrovima koji ih zanimaju.</p>
            
            <h4 style="margin-top: 12px;">UX implikacije:</h4>
            <p>Budući da Stats stranica služi kao polazna točka, važno je osigurati brzo učitavanje i jasne CTA gumbe prema žanrovima. Preporučeno je dodati quick links na popularnim putanjama.</p>
            ${data.topPaths.some(([path]) => path.split(' → ').length === 1) ? 
                '<p><strong>⚠️ Netipična putanja:</strong> Neki korisnici napuštaju stranicu nakon samo jednog pregleda - potrebno je poboljšati engagement na landing stranicama.</p>' : 
                ''
            }
        </div>
    `;
}
