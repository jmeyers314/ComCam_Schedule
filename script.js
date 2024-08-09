// Keep these script-global
let filteredTwilightData = [];
let filteredMoonData = [];
let filteredObservationData = [];
let availableBlockData = [];

const svg = d3.select("#mySVG");

const margin = { top: 20, right: 20, bottom: 20, left: 60 };
const width = +svg.attr("width") - margin.left - margin.right;
const height = +svg.attr("height") - margin.top - margin.bottom;

const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// x-axis
//  Time range for x-axis.  17:00 to 07:30
const minTime = -5;
const maxTime = 7.5;
const customTimeScale = d3.scaleLinear()
    .domain([minTime, maxTime])
    .range([0, width]);

// y-axis
const dateStart = new Date("2024-10-01");
const dateEnd = new Date("2024-12-01");
const dateRange = d3.timeDay.range(dateStart, dateEnd);
const dateScale = d3.scaleBand()
    .domain(dateRange.map(d => d.toISOString().split("T")[0]))
    .range([0, height])
    .padding(0.01);

const sunStateColorScale = d3.scaleOrdinal()
    .domain(["day", "6-deg twilight", "12-deg twilight", "18-deg twilight", "night"])
    .range(["#EEEE00", "#00FFFF", "#00AAAA", "#005555", "#000000"]);

const observationColorScale = d3.scaleOrdinal()
    .domain(["Calibration", "Prep", "AOS transient", "AOS data", "IQ", "Science"])
    .range(["#FF0000", "#FF0000", "#FFFF00", "#0000FF", "#00FF00", "#00FFFF"]);

const observationOpacity = d3.scaleOrdinal()
    .domain(["Calibration", "Prep", "AOS transient", "AOS data", "IQ", "Science"])
    .range([0.4, 0.4, 0.4, 0.7, 0.4, 0.4]);

function formatTime(hoursDecimal) {
    let hours = Math.floor(hoursDecimal);
    let minutes = Math.round((hoursDecimal - hours) * 60);

    // Adjust decimal hours to be +ve hh:mm format
    if (hours < 0) {
        hours += 24;
    } else if (hours >= 24) {
        hours -= 24;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatTooltip(obs, moonIllumination) {
    const startTime = formatTime(obs.start_time);
    const endTime = formatTime(obs.end_time);
    const durationHours = obs.end_time - obs.start_time;
    const duration = formatTime(durationHours);

    return `${obs.date}<br>${obs.tooltip}<br>Start: ${startTime}<br>` +
           `End: ${endTime}<br>Duration: ${duration}<br>` +
           `Moon Illumination: ${(moonIllumination * 100).toFixed(2)}%`;
}

function renderObservations() {
    const padding = 3; // Horizontal padding for the rectangles
    const cornerRadius = 3;
    let dragThreshold = 5; // Threshold to distinguish between click and drag
    let startPos = null;    // Store the start position of a drag
    let lassoRect = null;   // Define lassoRect within the renderObservations function

    g.selectAll(".observation").remove(); // Clear previous observations

    const observations = g.selectAll(".observation")
        .data(filteredObservationData)
        .enter()
        .append("g")
        .attr("class", "observation")
        .attr("data-index", (d, i) => i);

    observations.append("rect")
        .attr("x", d => customTimeScale(d.start_time) + padding)
        .attr("y", d => dateScale(d.date) + dateScale.bandwidth() * 0.1)
        .attr("width", d => customTimeScale(d.end_time) - customTimeScale(d.start_time) - padding * 2)
        .attr("height", dateScale.bandwidth() * 0.8)
        .attr("fill", d => observationColorScale(d.category))
        .attr("opacity", d => observationOpacity(d.category))
        .attr("rx", cornerRadius)
        .attr("ry", cornerRadius);

    observations.append("text")
        .attr("x", d => customTimeScale(d.start_time) + (customTimeScale(d.end_time) - customTimeScale(d.start_time)) / 2)
        .attr("y", d => dateScale(d.date) + dateScale.bandwidth() * 0.1 + dateScale.bandwidth() * 0.4)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", "#FFFFFF")
        .style("font-family", "monospace")
        .style("font-size", "10px")
        .text(d => d.label);

    observations.on("mouseover", function(event, d) {
        const tooltip = d3.select("#tooltip");
        const moonDataForDate = filteredMoonData.find(moon => moon.date === d.date);
        tooltip.style("display", "block")
            .style("left", (event.pageX + 5) + "px")
            .style("top", (event.pageY + 5) + "px")
            .style("font-family", "monospace")
            .style("font-size", "10px")
            .html(formatTooltip(d, moonDataForDate ? moonDataForDate.illumination : 0));
    }).on("mousemove", function(event) {
        const tooltip = d3.select("#tooltip");
        tooltip.style("left", (event.pageX + 5) + "px")
            .style("top", (event.pageY + 5) + "px");
    }).on("mouseout", function() {
        d3.select("#tooltip").style("display", "none");
    });

    const lassoDrag = d3.drag()
        .on("start", function(event) {
            startPos = d3.pointer(event, this); // Capture the start position

            // Adjust the start coordinates to account for margins
            lassoStartCoords = d3.pointer(event, this);
            lassoStartCoords[0] -= margin.left;
            lassoStartCoords[1] -= margin.top;

            // If the Shift key is not held, clear the existing selection
            if (!event.sourceEvent.shiftKey) {
                observations.classed("selected", false);
            }

            // Remove any existing lasso rectangle
            if (lassoRect) lassoRect.remove();

            // Create a new lasso rectangle
            lassoRect = g.append("rect")
                .attr("class", "lasso")
                .attr("x", lassoStartCoords[0])
                .attr("y", lassoStartCoords[1])
                .attr("width", 0)
                .attr("height", 0)
                .attr("stroke", "black")
                .attr("stroke-dasharray", "4")
                .attr("fill", "none");
        })
        .on("drag", function(event) {
            let [x, y] = d3.pointer(event, this);
            x -= margin.left;
            y -= margin.top;

            // Calculate the new width and height of the lasso rectangle
            const width = Math.abs(x - lassoStartCoords[0]);
            const height = Math.abs(y - lassoStartCoords[1]);

            // Update the position and size of the lasso rectangle
            lassoRect.attr("x", Math.min(x, lassoStartCoords[0]))
                .attr("y", Math.min(y, lassoStartCoords[1]))
                .attr("width", width)
                .attr("height", height);
        })
        .on("end", function(event) {
            const endPos = d3.pointer(event, this); // Capture the end position
            const dragDistance = Math.sqrt(
                Math.pow(endPos[0] - startPos[0], 2) +
                Math.pow(endPos[1] - startPos[1], 2)
            );

            if (dragDistance < dragThreshold) {
                // Treat as a click if drag distance is below threshold
                const target = d3.select(event.sourceEvent.target.parentNode);
                const isSelected = target.classed("selected");

                if (event.sourceEvent.shiftKey) {
                    // If Shift is held, toggle selection
                    target.classed("selected", !isSelected);
                } else {
                    // If Shift is not held, clear other selections and select this one
                    observations.classed("selected", false);
                    target.classed("selected", true);
                }

                // Update the highlighting
                observations.select("rect")
                    .attr("stroke", function(d) {
                        return d3.select(this.parentNode).classed("selected") ? "yellow" : null;
                    })
                    .attr("stroke-width", function(d) {
                        return d3.select(this.parentNode).classed("selected") ? 2 : null;
                    });
            } else {
                // Handle the lasso selection logic as before
                const x0 = parseFloat(lassoRect.attr("x"));
                const y0 = parseFloat(lassoRect.attr("y"));
                const x1 = x0 + parseFloat(lassoRect.attr("width"));
                const y1 = y0 + parseFloat(lassoRect.attr("height"));

                // Select elements whose center is within the lasso rectangle
                observations.classed("selected", function(d) {
                    const rectXCenter = customTimeScale(d.start_time) + (customTimeScale(d.end_time) - customTimeScale(d.start_time)) / 2;
                    const rectYCenter = dateScale(d.date) + dateScale.bandwidth() / 2;

                    const isCurrentlySelected = d3.select(this).classed("selected");
                    const isWithinLasso = rectXCenter >= x0 && rectXCenter <= x1 && rectYCenter >= y0 && rectYCenter <= y1;

                    // Add to the selection if within the lasso or keep the current selection state if shift is held
                    return event.sourceEvent.shiftKey ? isCurrentlySelected || isWithinLasso : isWithinLasso;
                });

                // Highlight selected observations with a bright yellow boundary
                observations.select("rect")
                    .attr("stroke", function(d) {
                        return d3.select(this.parentNode).classed("selected") ? "yellow" : null;
                    })
                    .attr("stroke-width", function(d) {
                        return d3.select(this.parentNode).classed("selected") ? 2 : null;
                    });

                // Remove the lasso rectangle after selection
                lassoRect.remove();
                lassoRect = null;
            }
        });

    // Apply the drag behavior to the SVG canvas
    svg.call(lassoDrag);
}

function renderAxes() {
    const xAxis = d3.axisBottom(customTimeScale).tickFormat(d => {
        const hours = Math.floor(d);
        const minutes = (d - hours) * 60;
        const date = new Date(1970, 0, 1, hours, minutes);
        return d3.timeFormat("%H:%M")(date);
    });
    const yAxis = d3.axisLeft(dateScale);

    g.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    g.append("g")
        .attr("class", "y axis")
        .call(yAxis);
}

function loadObservations() {
    Promise.all([
        d3.json("twilight.json?t=" + new Date().getTime()),
        d3.json("moon.json?t=" + new Date().getTime()),
        d3.json("observation.json?t=" + new Date().getTime())
    ]).then(function(data) {
        const [twilightData, moonData, observationData] = data;

        // Filter data to exclude dates outside the specified range
        filteredTwilightData = twilightData
            .filter(d => dateRange.map(
                date => date.toISOString().split("T")[0]).includes(d.date)
            );
        filteredMoonData = moonData
            .filter(d => dateRange.map(
                date => date.toISOString().split("T")[0]).includes(d.date)
            );
        filteredObservationData = observationData
            .filter(d => dateRange.map(
                date => date.toISOString().split("T")[0]).includes(d.date)
            );
        availableBlockData = initializeAvailableBlocks(filteredTwilightData);

        // Add twilight rectangles; only need to do this once.
        filteredTwilightData.forEach(state => {
            let wafternoon = (
                customTimeScale(state.sunset) -
                customTimeScale(minTime)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(minTime))
                .attr("y", dateScale(state.date))
                .attr("width", wafternoon)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("day"));

            let we6deg = (
                customTimeScale(state.evening_6deg) -
                customTimeScale(state.sunset)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(state.sunset))
                .attr("y", dateScale(state.date))
                .attr("width", we6deg)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("6-deg twilight"));

            let we12deg = (
                customTimeScale(state.evening_12deg) -
                customTimeScale(state.evening_6deg)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(state.evening_6deg))
                .attr("y", dateScale(state.date))
                .attr("width", we12deg)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("12-deg twilight"));

            let we18deg = (
                customTimeScale(state.evening_18deg) -
                customTimeScale(state.evening_12deg)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(state.evening_12deg))
                .attr("y", dateScale(state.date))
                .attr("width", we12deg)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("18-deg twilight"));

            let wnight = (
                customTimeScale(state.morning_18deg) -
                customTimeScale(state.evening_18deg)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(state.evening_18deg))
                .attr("y", dateScale(state.date))
                .attr("width", wnight)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("night"));

            let wm18deg = (
                customTimeScale(state.morning_12deg) -
                customTimeScale(state.morning_18deg)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(state.morning_18deg))
                .attr("y", dateScale(state.date))
                .attr("width", wm18deg)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("18-deg twilight"));

            let wm12deg = (
                customTimeScale(state.morning_6deg) -
                customTimeScale(state.morning_12deg)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(state.morning_12deg))
                .attr("y", dateScale(state.date))
                .attr("width", wm12deg)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("12-deg twilight"));

            let wm6deg = (
                customTimeScale(state.sunrise) -
                customTimeScale(state.morning_6deg)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(state.morning_6deg))
                .attr("y", dateScale(state.date))
                .attr("width", wm6deg)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("6-deg twilight"));

            let wmorning = (
                customTimeScale(maxTime) -
                customTimeScale(state.sunrise)
            );
            g.append("rect")
                .attr("class", "twilight")
                .attr("x", customTimeScale(state.sunrise))
                .attr("y", dateScale(state.date))
                .attr("width", wmorning)
                .attr("height", dateScale.bandwidth())
                .attr("fill", sunStateColorScale("day"));
        });

        // Moon rectangles; only needed once.
        filteredMoonData.forEach(state => {
            state.moonintervals.forEach(interval => {
                const start = Math.max(minTime, interval[0]);
                const end = Math.min(maxTime, interval[1]);
                if (start < end) {
                    g.append("rect")
                        .attr("class", "moon")
                        .attr("x", customTimeScale(start))
                        .attr("y", dateScale(state.date))
                        .attr("width", customTimeScale(end) - customTimeScale(start))
                        .attr("height", dateScale.bandwidth())
                        .attr("fill", "grey")
                        .attr("opacity", 0.5);
                }
            });
        });

        renderObservations();
        renderAxes();
    }).catch(function(error) {
        console.error("Error loading the JSON data: ", error);
    });
}

function initializeAvailableBlocks(twilightData) {
    const availableBlockData = [];

    twilightData.forEach(state => {
        // Create blocks for each twilight period and night period
        const blocks = [
            { date: state.date, start_time: state.sunset, end_time: state.evening_6deg },
            { date: state.date, start_time: state.evening_6deg, end_time: state.evening_12deg },
            { date: state.date, start_time: state.evening_12deg, end_time: state.evening_18deg },
            { date: state.date, start_time: state.evening_18deg, end_time: state.morning_18deg }, // Night
            { date: state.date, start_time: state.morning_18deg, end_time: state.morning_12deg },
            { date: state.date, start_time: state.morning_12deg, end_time: state.morning_6deg },
            { date: state.date, start_time: state.morning_6deg, end_time: state.sunrise }
        ];

        // Filter out any blocks that have no duration (e.g., if start_time equals end_time)
        blocks.forEach(block => {
            if (block.start_time < block.end_time) {
                availableBlockData.push(block);
            }
        });
    });

    return availableBlockData;
}

loadObservations();

d3.select("#saveButton").on("click", function() {
    const updatedDataStr = JSON.stringify(filteredObservationData, null, 2);
    const dataUri = (
        'data:application/json;charset=utf-8,' +
        encodeURIComponent(updatedDataStr)
    );

    const exportFileDefaultName = 'observation.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
});

d3.select("#loadButton").on("click", function() {
    document.getElementById("fileInput").click(); // Trigger the file input dialog
});

d3.select("#fileInput").on("change", function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            observationData = JSON.parse(e.target.result);
            filteredObservationData = observationData.filter(
                d => dateRange.map(
                    date => date.toISOString().split("T")[0]
                ).includes(d.date)
            );
            renderObservations(); // Rerender.
        };
        reader.readAsText(file);
    }
});

document.addEventListener("keydown", function(event) {
    if (event.key === 'd') {
        const selectedObservations = d3.selectAll(".observation.selected");
        const indicesToDelete = selectedObservations.nodes().map(
            d => +d.getAttribute("data-index")
        );

        // Filter out the selected observations
        filteredObservationData = filteredObservationData.filter(
            (obs, i) => !indicesToDelete.includes(i)
        );

        // Remove selected observations from the SVG
        selectedObservations.remove();
    }
});
