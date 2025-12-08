document.addEventListener("DOMContentLoaded", function () {
    // Mobilna navigacija (hamburger)
    const navToggle = document.querySelector(".nav-toggle");
    const navLinks = document.querySelector(".nav-links");

    if (navToggle && navLinks) {
        navToggle.addEventListener("click", () => {
            navLinks.classList.toggle("nav-open");
        });
    }

    // Alert za vanjske linkove u footeru (Pratite nas)
    window.myFunction1 = function () {
        alert("Otvarate vanjsku stranicu (društvene mreže).");
    };

    // Toggle dodatnih opisa (Prikaži / Sakrij detalje)
    const toggleButtons = document.querySelectorAll("[data-toggle='details']");
    toggleButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const target = document.getElementById(targetId);
            if (!target) return;

            target.classList.toggle("details-open");
            btn.textContent = target.classList.contains("details-open")
                ? "Sakrij detalje"
                : "Prikaži detalje";
        });
    });

    // Random preporuke po žanru (classic / indie / funk)
    const recommendButtons = document.querySelectorAll("[data-role='recommend-btn']");
    recommendButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const genre = btn.getAttribute("data-genre"); // "classic", "indie", "funk"
            const output = document.querySelector(`[data-genre-text='${genre}']`);
            if (!output) return;

            const suggestions = {
                classic: [
                    "Pokušaj usporediti live i studijsku verziju iste pjesme.",
                    "Odaberi jedan classic rock album i poslušaj ga od početka do kraja bez preskakanja.",
                    "Obrati pozornost samo na bubnjeve u nekoj pjesmi i vidi koliko nose energiju."
                ],
                indie: [
                    "Preslušaj indie album i obrati pažnju samo na tekstove pjesama.",
                    "Probaj usporediti produkciju indie benda na prvom i zadnjem albumu.",
                    "Pronađi live session nekog indie izvođača i usporedi tu izvedbu sa studijskom verzijom."
                ],
                funk: [
                    "Pokušaj pratiti samo bas liniju kroz jednu funk pjesmu.",
                    "Izaberi playlistu s funk klasicima i slušaj samo uvode pjesama.",
                    "Obrati pažnju na to kako bubnjevi i bas zajedno stvaraju groove."
                ]
            };

            const list = suggestions[genre] || [];
            if (list.length > 0) {
                const randomIndex = Math.floor(Math.random() * list.length);
                output.textContent = list[randomIndex];
            }
        });
    });
});
