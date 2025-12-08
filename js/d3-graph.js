// 1) BAR GRAF PO ŽANROVIMA
// Podaci za bar graf (žanrovi)
const genreData = [
    { genre: "Classic Rock", value: 65 },
    { genre: "Indie",        value: 47 },
    { genre: "Funk",         value: 39 }
];

// Glavni container za bar graf
const genreContainer = d3.select("#genre-chart");

// Dimenzije grafa
const margin = { top: 30, right: 20, bottom: 60, left: 50 };
const width  = 600 - margin.left - margin.right;
const height = 320 - margin.top - margin.bottom;

// Kreiranje SVG elemenata
const svgBar = genreContainer
    .append("svg")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .classed("genre-bar-chart", true);

const chartArea = svgBar.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Skaliranje
const xScale = d3.scaleBand()
    .domain(genreData.map(d => d.genre))
    .range([0, width])
    .padding(0.3);

const yScale = d3.scaleLinear()
    .domain([0, d3.max(genreData, d => d.value) + 2])
    .range([height, 0]);

// X os
chartArea.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .style("fill", "#ffffff")
    .style("font-size", "12px");

// Y os
chartArea.append("g")
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("fill", "#ffffff")
    .style("font-size", "12px");

// Stupci
chartArea.selectAll(".bar")
    .data(genreData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => xScale(d.genre))
    .attr("y", height)         // animacija od dna
    .attr("width", xScale.bandwidth())
    .attr("height", 0)
    .attr("rx", 6)
    .style("fill", (d, i) => {
        const colors = ["#7b5cff", "#ff4fa3", "#1db954"];
        return colors[i % colors.length];
    })
    .transition()
    .duration(800)
    .attr("y", d => yScale(d.value))
    .attr("height", d => height - yScale(d.value));

// Vrijednosti iznad stupaca
chartArea.selectAll(".bar-label")
    .data(genreData)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => xScale(d.genre) + xScale.bandwidth() / 2)
    .attr("y", d => yScale(d.value) - 8)
    .attr("text-anchor", "middle")
    .style("fill", "#ffffff")
    .style("font-size", "12px")
    .text(d => d.value);

// 2) DONUT GRAF: KADA SLUŠAŠ GLAZBU
// Podaci za donut (situacije / konteksti)
const contextData = [
    { context: "Učenje",     value: 35 },
    { context: "Vožnja",     value: 10 },
    { context: "Opuštanje",  value: 30 },
    { context: "Aktivnost",  value: 15 },
    { context: "Ostalo",     value: 10 }
];

// Kontejner za donut graf
const contextContainer = d3.select("#context-chart");

// Dimenzije za donut
const donutWidth  = 500;
const donutHeight = 320;
const radius      = Math.min(donutWidth, donutHeight) / 2 - 10;

// SVG za donut
const svgDonut = contextContainer
    .append("svg")
    .attr("viewBox", `0 0 ${donutWidth} ${donutHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .classed("context-donut-chart", true);

const donutGroup = svgDonut.append("g")
    .attr("transform", `translate(${donutWidth / 2}, ${donutHeight / 2})`);

// Boje
const color = d3.scaleOrdinal()
    .domain(contextData.map(d => d.context))
    .range(["#7b5cff", "#ff4fa3", "#1db954", "#ffd65c", "#57c7ff"]);

// Pie layout
const pie = d3.pie()
    .value(d => d.value)
    .sort(null);

// Arc generator (donut)
const arc = d3.arc()
    .innerRadius(radius * 0.5)   // unutarnji radius -> donut
    .outerRadius(radius);

// Arc za tekst (malo izvan)
const outerArc = d3.arc()
    .innerRadius(radius * 0.9)
    .outerRadius(radius * 0.9);

// Kreiranje segmenata
const arcs = donutGroup
    .selectAll(".slice")
    .data(pie(contextData))
    .enter()
    .append("g")
    .attr("class", "slice");

// Oblik segmenata
arcs.append("path")
    .attr("d", arc)
    .attr("fill", d => color(d.data.context))
    .attr("stroke", "#050510")
    .style("stroke-width", "1px")
    .each(function(d) { this._current = d; }) // za eventualne animacije
    .transition()
    .duration(800)
    .attrTween("d", function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) {
            return arc(i(t));
        };
    });

// Linije prema labelama
arcs.append("polyline")
    .attr("points", d => {
        const pos = outerArc.centroid(d);
        const midAngle = (d.startAngle + d.endAngle) / 2;
        const offset = midAngle < Math.PI ? 40 : -40;
        return [arc.centroid(d), outerArc.centroid(d), [pos[0] + offset, pos[1]]];
    })
    .style("fill", "none")
    .style("stroke", "#ccccff")
    .style("stroke-width", 1)
    .style("opacity", 0.7);

// Tekst labela
arcs.append("text")
    .text(d => `${d.data.context} (${d.data.value}%)`)
    .attr("transform", d => {
        const pos = outerArc.centroid(d);
        const midAngle = (d.startAngle + d.endAngle) / 2;
        const offset = midAngle < Math.PI ? 45 : -45;
        return `translate(${pos[0] + offset}, ${pos[1]})`;
    })
    .style("fill", "#f5f5f5")
    .style("font-size", "11px")
    .style("text-anchor", d => {
        const midAngle = (d.startAngle + d.endAngle) / 2;
        return midAngle < Math.PI ? "start" : "end";
    });
