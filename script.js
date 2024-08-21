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
//  Use seconds from midnight.
const minTime = -5*3600;
const maxTime = 7.5*3600;
const timeScale = d3.scaleLinear()
    .domain([minTime, maxTime])
    .range([0, width]);

// y-axis
const dateStart = new Date("2024-10-01");
const dateEnd = new Date("2024-12-01");
const dateRange = d3.timeDay.range(dateStart, dateEnd);
const dates = dateRange.map(d => d.toISOString().split("T")[0]);
const dateScale = d3.scaleBand()
    .domain(dates)
    .range([0, height])
    .padding(0.01);

const sunStateColor = {
    "day": "#EEEE00",
    "twilight6": "#00FFFF",
    "twilight12": "#00AAAA",
    "twilight18": "#005555",
    "night": "#000000"
};

const categoryColor = {
    "Calibration": "#FF0000",
    "Prep": "#FF0000",
    "AOS transient": "#FFFF00",
    "AOS data": "#0000FF",
    "IQ": "#00FF00",
    "Science": "#00FFFF"
};

const categoryOpacity = {
    "Calibration": 0.4,
    "Prep": 0.4,
    "AOS transient": 0.4,
    "AOS data": 0.7,
    "IQ": 0.4,
    "Science": 0.4
};

const obstypes = {
    "Prep": {
        "tooltip": "Get Ready",
        "category": "Prep",
    },
    "Point": {
        "tooltip": "Pointing model",
        "category": "Prep",
    },
    "Trail": {
        "tooltip": "Star trails",
        "category": "Prep",
    },

    "Twiflat": {
        "tooltip": "Twilight flats",
        "category": "Calibration",
    },
    "Bias": {
        "tooltip": "Bias frames",
        "category": "Calibration",
    },
    "Dark": {
        "tooltip": "Dark frames",
        "category": "Calibration",
    },
    "Bright": {
        "tooltip": "Bright star scans",
        "category": "Calibration",
    },
    "Pinhole": {
        "tooltip": "Pinhole mask imaging",
        "category": "Calibration",
    },

    "Dome slit": {
        "tooltip": "Dome slit coord tests",
        "category": "AOS transient",
    },
    "M1M3 cover": {
        "tooltip": "Mirror cover petal tests",
        "category": "AOS transient",
    },
    "Focus": {
        "tooltip": "Focus sweeps",
        "category": "AOS transient",
    },
    "Align": {
        "tooltip": "Manual alignment",
        "category": "AOS transient",
    },
    "Exptime": {
        "tooltip": "Exposure time sweeps",
        "category": "AOS transient",
    },
    "Loop": {
        "tooltip": "Closed-loop optimization",
        "category": "AOS transient",
    },
    "Kick": {
        "tooltip": "Closed-loop kick tests",
        "category": "AOS transient",
    },

    "Sense": {
        "tooltip": "Sensitivity Matrix",
        "category": "AOS data",
    },
    "Ref": {
        "tooltip": "Reference wavefront",
        "category": "AOS data",
    },
    "LUT": {
        "tooltip": "Look-up table sweeps",
        "category": "AOS data",
    },
    "Giant": {
        "tooltip": "Giant donuts",
        "category": "AOS data",
    },

    "Guide": {
        "tooltip": "Guider mode imaging",
        "category": "IQ",
    },
    "Stutter": {
        "tooltip": "Stuttered imaging",
        "category": "IQ",
    },
    "Streak": {
        "tooltip": "Streaked imaging",
        "category": "IQ",
    },
    "MOSS": {
        "tooltip": "MOSS Dome Seeing Monitoring",
        "category": "IQ",
    },

    "DD*F": {
        "tooltip": "Dense dithered star fields",
        "category": "Science",
    },
    "Deep": {
        "tooltip": "Deep field imaging",
        "category": "Science",
    },
    "Survey": {
        "tooltip": "Survey field imaging",
        "category": "Science",
    }
}

Object.values(obstypes).forEach(type => {
    type.color = categoryColor[type.category];
    type.opacity = categoryOpacity[type.category];
});

function formatTime(secondsToMidnight, hms=false) {
    if (secondsToMidnight < 0) {
        secondsToMidnight += 86400;
    }
    let hours = Math.floor(secondsToMidnight / 3600);
    let minutes = Math.floor((secondsToMidnight - hours * 3600) / 60);
    let seconds = Math.round(secondsToMidnight % 60);
    if (hms) {
        if (hours === 0 && minutes === 0 && seconds === 0) {
            return `0s`;
        }
        if (hours === 0 && minutes === 0) {
            return `${seconds}s`;
        }
        if (hours === 0 && seconds === 0) {
            return `${minutes}m`;
        }
        if (minutes === 0 && seconds === 0) {
            return `${hours}h`;
        }
        if (hours === 0) {
            return `${minutes}m${seconds}s`;
        }
        if (seconds === 0) {
            return `${hours}h${minutes}m`;
        }
        return `${hours}h${minutes}m${seconds}s`;
    }
    let hourStr = String(hours).padStart(2, '0');
    let minuteStr = String(minutes).padStart(2, '0');
    let secondStr = String(seconds).padStart(2, '0');
    return `${hourStr}:${minuteStr}:${secondStr}`;
}

// Helper function to parse time from the input field (hh:mm format) to decimal hours
function parseTime(timeStr) {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    let secondsToMidnight = hours*3600 + minutes*60 + seconds;
    if (secondsToMidnight >= 43200) {
        secondsToMidnight -= 86400; // Adjust for the internal time scale
    }
    return secondsToMidnight;
}

function formatTooltip(obs, moonIllumination) {
    let out = `${obs.dayobs}<br>`;
    if (obs.type in obstypes) {
        out += `${obstypes[obs.type]['tooltip']}<br>`;
    }
    const duration = formatTime(obs.end - obs.start, hms=true);
    out += `Start: ${formatTime(obs.start)}<br>`;
    out += `End: ${formatTime(obs.end)}<br>`;
    out += `Duration: ${duration}<br>`;
    out += `Moon Illumination: ${(moonIllumination * 100).toFixed(2)}%`;
    if (obs.notes) {
        out += `<br>Notes: ${obs.notes}`;
    }
    out = out.replace(/\n/g, "<br>");
    return out;
}

function renderObservations() {
    const padding = 3; // Horizontal padding for the rectangles
    const cornerRadius = 3;
    const dragThreshold = 5; // Threshold to distinguish between click and drag
    let startPos = null;    // Store the start position of a drag
    let lassoRect = null;   // Define lassoRect within the renderObservations function

    // Clear previous observations and available blocks
    g.selectAll(".observation").remove();
    g.selectAll(".available-block").remove();

    // Render observations
    const observations = g.selectAll(".observation")
        .data(filteredObservationData)
        .enter()
        .append("g")
        .attr("class", "observation")
        .attr("data-index", (d, i) => i);

    observations.append("rect")
        .attr("x", d => timeScale(d.start) + padding)
        .attr("y", d => dateScale(d.dayobs) + dateScale.bandwidth() * 0.1)
        .attr("width", d => timeScale(d.end) - timeScale(d.start) - padding * 2)
        .attr("height", dateScale.bandwidth() * 0.8)
        .attr("fill", d => obstypes[d.type].color)
        .attr("opacity", d => obstypes[d.type].opacity)
        .attr("rx", cornerRadius)
        .attr("ry", cornerRadius);

    observations.append("text")
        .attr("x", d => timeScale(d.start) + (timeScale(d.end) - timeScale(d.start)) / 2)
        .attr("y", d => dateScale(d.dayobs) + dateScale.bandwidth() * 0.1 + dateScale.bandwidth() * 0.4)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", "#FFFFFF")
        .style("font-family", "monospace")
        .style("font-size", "10px")
        .style("pointer-events", "none")
        .text(d => d.type);

    observations.on("mouseover", function(event, d) {
        const tooltip = d3.select("#tooltip");
        const moonDataForDate = filteredMoonData.find(moon => moon.dayobs === d.dayobs);  // Check this one
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

    // Lasso drag behavior for observation blocks
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
                d3.selectAll(".available-block").classed("selected", false)
                    .attr("stroke", "none") // Remove highlighting from available blocks
                    .attr("stroke-width", null);
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
            // Deselect all available blocks when lasso selection ends
            d3.selectAll(".available-block").classed("selected", false)
                .attr("stroke", "none") // Remove highlighting from available blocks
                .attr("stroke-width", null);

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
                        return d3.select(this.parentNode).classed("selected") ? "white" : null;
                    })
                    .attr("stroke-width", function(d) {
                        return d3.select(this.parentNode).classed("selected") ? 3 : null;
                    });
            } else {
                // Handle the lasso selection logic as before
                const x0 = parseFloat(lassoRect.attr("x"));
                const y0 = parseFloat(lassoRect.attr("y"));
                const x1 = x0 + parseFloat(lassoRect.attr("width"));
                const y1 = y0 + parseFloat(lassoRect.attr("height"));

                // Select elements whose center is within the lasso rectangle
                observations.classed("selected", function(d) {
                    const rectXCenter = timeScale(d.start) + (timeScale(d.end) - timeScale(d.start)) / 2;
                    const rectYCenter = dateScale(d.dayobs) + dateScale.bandwidth() / 2;

                    const isCurrentlySelected = d3.select(this).classed("selected");
                    const isWithinLasso = rectXCenter >= x0 && rectXCenter <= x1 && rectYCenter >= y0 && rectYCenter <= y1;

                    // Add to the selection if within the lasso or keep the current selection state if shift is held
                    return event.sourceEvent.shiftKey ? isCurrentlySelected || isWithinLasso : isWithinLasso;
                });

                // Highlight selected observations with a bright boundary
                observations.select("rect")
                    .attr("stroke", function(d) {
                        return d3.select(this.parentNode).classed("selected") ? "white" : null;
                    })
                    .attr("stroke-width", function(d) {
                        return d3.select(this.parentNode).classed("selected") ? 3 : null;
                    });

                // Remove the lasso rectangle after selection
                lassoRect.remove();
                lassoRect = null;
            }

            // Handle the visibility of the edit form
            const selectedObservations = d3.selectAll(".observation.selected");

            if (selectedObservations.size() === 1) {
                const selectedData = selectedObservations.data()[0];

                // Populate the form with the selected block's data
                document.getElementById("editDate").value = selectedData.dayobs;
                document.getElementById("editStartTime").value = formatTime(selectedData.start);
                document.getElementById("editEndTime").value = formatTime(selectedData.end);
                document.getElementById("duration").value = formatTime(selectedData.end - selectedData.start, hms=true);
                document.getElementById("editObsType").value = selectedData.type;
                setFilterTags(selectedData.filters);
                document.getElementById("editNotes").value = selectedData.notes || "";

                // Show the form
                document.getElementById("editFormContainer").style.display = "block";
                toggleFormInputs(true);
            } else {
                // Hide the form if no or more than one item is selected
                document.getElementById("editFormContainer").style.display = "none";
            }
        }); // End of lassoDrag

    // Render available blocks (invisible but selectable)
    const availableBlocks = g.selectAll(".available-block")
        .data(availableBlockData)
        .enter()
        .append("rect")
        .attr("class", "available-block")
        .attr("x", d => timeScale(d.start))
        .attr("y", d => dateScale(d.dayobs))
        .attr("width", d => timeScale(d.end) - timeScale(d.start))
        .attr("height", dateScale.bandwidth())
        .attr("fill", "transparent") // Make the blocks invisible
        .attr("stroke", "none")
        .attr("pointer-events", "all") // Ensure they can be clicked even if invisible
        .on("click", function(event, d) {
            d3.selectAll(".observation").classed("selected", false);
            d3.selectAll(".available-block").classed("selected", false)
                .attr("stroke", "none") // Remove highlighting from other available blocks
                .attr("stroke-width", null);
            d3.select(this).classed("selected", true);

            // Highlight the selected available block
            d3.select(this)
                .attr("stroke", "yellow")
                .attr("stroke-width", 3);

            // Handle form population for available blocks
            document.getElementById("editDate").value = d.dayobs;
            document.getElementById("editStartTime").value = formatTime(d.start);
            document.getElementById("editEndTime").value = formatTime(d.end);
            document.getElementById("duration").value = formatTime(d.end - d.start, hms=true);
            document.getElementById("editObsType").value = ""; // No type for available blocks
            setFilterTags([]); // No filters for available blocks
            document.getElementById("editNotes").value = ""; // No notes for available blocks

            // Show the form
            document.getElementById("editFormContainer").style.display = "block";
            toggleFormInputs(false);
        });

    // Apply the drag behavior to the SVG canvas
    svg.call(lassoDrag);

    const filtersPerNight = calculateFiltersUsedPerNight();
    renderLozenges(filtersPerNight);
}

function renderAxes() {
    const xAxis = d3.axisBottom(timeScale)
        .tickValues(d3.range(minTime, maxTime + 1, 3600))
        .tickFormat(d => {
            const hours = Math.floor(d/3600);
            const minutes = (d/3600 - hours) * 60;
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
        filteredTwilightData = twilightData.filter(d => dates.includes(d.dayobs));
        filteredMoonData = moonData.filter(d => dates.includes(d.dayobs));
        filteredObservationData = observationData.filter(d => dates.includes(d.dayobs));

        filteredTwilightData.forEach(d => {
            for (const k in d) {
                if (k === "dayobs") continue;
                d[k] = parseTime(d[k]);
            }
        });
        filteredMoonData.forEach(d => {
            d.moonintervals = d.moonintervals.map(interval => interval.map(parseTime));
        });
        filteredObservationData.forEach(d => {
            d.start = parseTime(d.start);
            d.end = parseTime(d.end);
        });

        initializeAvailableBlocks();
        pruneAvailableBlocks();

        // Add twilight rectangles; only need to do this once.
        filteredTwilightData.forEach(d => {
            const twilightIntervals = [
                { start: minTime, end: d.sunset, fill: sunStateColor.day, dayobs: d.dayobs },
                { start: d.sunset, end: d.evening_6deg, fill: sunStateColor.twilight6, dayobs: d.dayobs },
                { start: d.evening_6deg, end: d.evening_12deg, fill: sunStateColor.twilight12, dayobs: d.dayobs },
                { start: d.evening_12deg, end: d.evening_18deg, fill: sunStateColor.twilight18, dayobs: d.dayobs },
                { start: d.evening_18deg, end: d.morning_18deg, fill: sunStateColor.night, dayobs: d.dayobs },
                { start: d.morning_18deg, end: d.morning_12deg, fill: sunStateColor.twilight18, dayobs: d.dayobs },
                { start: d.morning_12deg, end: d.morning_6deg, fill: sunStateColor.twilight12, dayobs: d.dayobs },
                { start: d.morning_6deg, end: d.sunrise, fill: sunStateColor.twilight6, dayobs: d.dayobs },
                { start: d.sunrise, end: maxTime, fill: sunStateColor.day, dayobs: d.dayobs }
            ];

            // Bind the data for each date and append rectangles
            g.selectAll(".twilight-" + d.dayobs)
                .data(twilightIntervals)
                .enter()
                .append("rect")
                .attr("class", "twilight")
                .attr("x", d => timeScale(d.start))
                .attr("y", d => dateScale(d.dayobs))
                .attr("width", d => timeScale(d.end) - timeScale(d.start))
                .attr("height", dateScale.bandwidth())
                .attr("fill", d => d.fill);
        });

        // Moon rectangles; only needed once.
        const flattenedMoonData = filteredMoonData.flatMap(d =>
            d.moonintervals
                .map(interval => {
                    const start = Math.max(minTime, interval[0]);
                    const end = Math.min(maxTime, interval[1]);
                    return {
                        start,
                        end,
                        dayobs: d.dayobs
                    };
                })
                .filter(({ start, end }) => start < end)
        );
        g.selectAll(".moon")
            .data(flattenedMoonData)
            .enter()
            .append("rect")
            .attr("class", "moon")
            .attr("x", d => timeScale(d.start))
            .attr("y", d => dateScale(d.dayobs))
            .attr("width", d => timeScale(d.end)-timeScale(d.start))
            .attr("height", dateScale.bandwidth())
            .attr("fill", "grey")
            .attr("opacity", 0.5);

        renderObservations();
        renderAxes();
    }).catch(function(error) {
        console.error("Error loading the JSON data: ", error);
    });
}

function initializeAvailableBlocks() {
    let blockData = [];
    twilightData = filteredTwilightData;

    twilightData.forEach(d => {
        // Create blocks for each twilight period and night period
        const blocks = [
            { dayobs: d.dayobs, start: d.sunset, end: d.evening_6deg },
            { dayobs: d.dayobs, start: d.evening_6deg, end: d.evening_12deg },
            { dayobs: d.dayobs, start: d.evening_12deg, end: d.evening_18deg },
            { dayobs: d.dayobs, start: d.evening_18deg, end: d.morning_18deg }, // Night
            { dayobs: d.dayobs, start: d.morning_18deg, end: d.morning_12deg },
            { dayobs: d.dayobs, start: d.morning_12deg, end: d.morning_6deg },
            { dayobs: d.dayobs, start: d.morning_6deg, end: d.sunrise }
        ];

        // Filter out any blocks that have no duration (e.g., if start equals end)
        blocks.forEach(block => {
            if (block.start < block.end) {
                blockData.push(block);
            }
        });
    });

    availableBlockData = blockData;
}

function pruneAvailableBlocks() {
    let prunedBlocks = [];

    availableBlockData.forEach(availableBlock => {
        let newBlocks = [availableBlock]; // Start with the available block itself

        filteredObservationData.forEach(observation => {
            let tempBlocks = [];

            newBlocks.forEach(block => {
            if (observation.dayobs === block.dayobs) { // They are on the same date
                    // Case 1: Observation completely covers the available block
                    if (observation.start <= block.start && observation.end >= block.end) {
                        // This available block is fully covered by the observation and should be removed.
                        // Do nothing here, so it gets removed.
                    }
                    // Case 2: Observation overlaps the start of the available block
                    else if (observation.start <= block.start && observation.end > block.start && observation.end < block.end) {
                        // Truncate the start of the available block
                        tempBlocks.push({
                            ...block,
                            start: observation.end
                        });
                    }
                    // Case 3: Observation overlaps the end of the available block
                    else if (observation.start > block.start && observation.start < block.end && observation.end >= block.end) {
                        // Truncate the end of the available block
                        tempBlocks.push({
                            ...block,
                            end: observation.start
                        });
                    }
                    // Case 4: Observation is inside the available block
                    else if (observation.start > block.start && observation.end < block.end) {
                        // Split the available block into two blocks
                        tempBlocks.push({
                            ...block,
                            end: observation.start
                        });
                        tempBlocks.push({
                            ...block,
                            start: observation.end
                        });
                    }
                    // Case 5: No overlap
                    else {
                        // No change needed, keep the block as it is.
                        tempBlocks.push(block);
                    }
                } else {
                    // No overlap, different dates, keep the block as it is.
                    tempBlocks.push(block);
                }
            });

            newBlocks = tempBlocks; // Update the current blocks for this available block
        });

        prunedBlocks = prunedBlocks.concat(newBlocks); // Add the remaining blocks to the pruned list
    });

    // Update the global availableBlockData array with the pruned blocks
    availableBlockData = prunedBlocks;
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
                d => dates.includes(d.dayobs)
            );
            initializeAvailableBlocks();
            pruneAvailableBlocks();
            renderObservations();
        };
        reader.readAsText(file);
    }
});

document.addEventListener("keydown", function(event) {
    // Check if the currently focused element is an input or textarea
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';

    if ((event.key === 'd' || event.key === 'Backspace') && !isInputFocused) {
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
        initializeAvailableBlocks();
        pruneAvailableBlocks();
        renderObservations();
    }
});

function updateSelectedObservation() {
    const selectedObservations = d3.selectAll(".observation.selected");

    if (selectedObservations.size() === 1) {
        const selectedData = selectedObservations.data()[0];

        // Update the selected block's data with the values from the form
        selectedData.dayobs = document.getElementById("editDate").value;
        selectedData.start = parseTime(document.getElementById("editStartTime").value);
        selectedData.end = parseTime(document.getElementById("editEndTime").value);
        selectedData.type = document.getElementById("editObsType").value;
        selectedData.filters = filterTags.getValue(true);
        selectedData.notes = document.getElementById("editNotes").value;

        // Store the index of the selected observation
        const selectedIndex = filteredObservationData.indexOf(selectedData);

        // Re-render the observations and available blocks
        initializeAvailableBlocks();
        pruneAvailableBlocks();
        renderObservations();

        // Reapply the selection to the updated observation
        d3.selectAll(".observation")
            .filter((d, i) => i === selectedIndex)
            .classed("selected", true)
            .select("rect")
            .attr("stroke", "white")
            .attr("stroke-width", 3);
    }
}

// Add event listeners to form fields for real-time updates
document.getElementById("editDate").addEventListener("input", updateSelectedObservation);
document.getElementById("editStartTime").addEventListener("input", updateSelectedObservation);
document.getElementById("editEndTime").addEventListener("input", updateSelectedObservation);
document.getElementById("editObsType").addEventListener("input", updateSelectedObservation);

// Event listener for the 'a' key to add a new observation
document.addEventListener('keydown', function(event) {
    if (event.key === 'a') {
        const selectedAvailableBlock = d3.selectAll(".available-block.selected").data()[0];

        if (selectedAvailableBlock) {
            // Calculate the duration of the new observation block (1 hour or remainder of the available time)
            const duration = Math.min(3600, selectedAvailableBlock.end - selectedAvailableBlock.start);
            const endTime = selectedAvailableBlock.start + duration;

            // Create the new observation block
            const newObservation = {
                dayobs: selectedAvailableBlock.dayobs,
                start: selectedAvailableBlock.start,
                end: endTime,
                type: "Survey",
                filters: ['i']
            };

            // Add the new observation to the filteredObservationData
            filteredObservationData.push(newObservation);

            // Update availableBlockData by removing or truncating the selected available block
            if (endTime === selectedAvailableBlock.end) {
                // Remove the available block if fully covered by the new observation
                availableBlockData = availableBlockData.filter(block => block !== selectedAvailableBlock);
            } else {
                // Truncate the available block
                selectedAvailableBlock.start = endTime;
            }

            // Re-render the observations and available blocks
            renderObservations();

            // Unselect the available block
            d3.selectAll(".available-block.selected").classed("selected", false);

            // Select and highlight the new observation block
            d3.selectAll(".observation").classed("selected", function(d) {
                return d === newObservation;
            });

            d3.selectAll(".observation.selected").select("rect")
                .attr("stroke", "white")
                .attr("stroke-width", 3);

            // Populate the form with the new observation block's data
            document.getElementById("editDate").value = newObservation.dayobs;
            document.getElementById("editStartTime").value = formatTime(newObservation.start);
            document.getElementById("editEndTime").value = formatTime(newObservation.end);
            document.getElementById("duration").value = formatTime(newObservation.end - newObservation.start, hms=true);
            document.getElementById("editObsType").value = newObservation.type;
            setFilterTags(newObservation.filters);
            document.getElementById("editNotes").value = newObservation.notes || "";

            // Enable the form
            toggleFormInputs(true);

            // Show the edit form
            document.getElementById("editFormContainer").style.display = "block";
        }
    }
});


document.addEventListener("DOMContentLoaded", function() {
    const adjustmentStep = 15*60; // Time step in seconds

    // Function to get the list of stopping points based on observations and twilight edges
    function getStoppingPoints(currentDate) {
        const stoppingPoints = [];

        // Filter and add twilight edges for the current date
        filteredTwilightData.forEach(d => {
            if (d.dayobs === currentDate) {
                stoppingPoints.push(d.sunset);
                stoppingPoints.push(d.evening_6deg);
                stoppingPoints.push(d.evening_12deg);
                stoppingPoints.push(d.evening_18deg);
                stoppingPoints.push(d.morning_18deg);
                stoppingPoints.push(d.morning_12deg);
                stoppingPoints.push(d.morning_6deg);
                stoppingPoints.push(d.sunrise);
            }
        });

        // Filter and add observation start and end times for the current date
        filteredObservationData.forEach(observation => {
            if (observation.dayobs === currentDate) {
                stoppingPoints.push(observation.start);
                stoppingPoints.push(observation.end);
            }
        });

        // Remove duplicates and sort
        return Array.from(new Set(stoppingPoints)).sort((a, b) => a - b);
    }

    // Function to find the next/previous stopping point based on direction
    function findNextStoppingPoint(currentTime, currentDate, direction) {
        const stoppingPoints = getStoppingPoints(currentDate);
        if (direction > 0) {
            // Find the next stopping point
            for (let i = 0; i < stoppingPoints.length; i++) {
                if (stoppingPoints[i] > currentTime) {
                    return stoppingPoints[i];
                }
            }
            return maxTime; // If no stopping point found, return maxTime
        } else {
            // Find the previous stopping point
            for (let i = stoppingPoints.length - 1; i >= 0; i--) {
                if (stoppingPoints[i] < currentTime) {
                    return stoppingPoints[i];
                }
            }
            return minTime; // If no stopping point found, return minTime
        }
    }

    // Function to adjust time with respect to predefined stopping points
    function adjustTime(inputField, adjustment) {
        const currentDate = document.getElementById("editDate").value;
        let secondsToMidnight = parseTime(inputField.value);
        let newSecondsToMidnight;

        if (adjustment > 0) {
            newSecondsToMidnight = findNextStoppingPoint(secondsToMidnight, currentDate, 1);
        } else {
            newSecondsToMidnight = findNextStoppingPoint(secondsToMidnight, currentDate, -1);
        }

        // Adjust by adjustmentStep if no stopping point is nearby
        const secondsDifference = (newSecondsToMidnight - secondsToMidnight);
        if (Math.abs(secondsDifference) > adjustmentStep) {
            newSecondsToMidnight = secondsToMidnight + adjustment;
        }

        // Ensure the time stays within the minTime to maxTime period
        if (newSecondsToMidnight < minTime) secondsToMidnight = minTime;
        if (newSecondsToMidnight > maxTime) secondsToMidnight = maxTime;

        inputField.value = formatTime(newSecondsToMidnight);
        inputField.dispatchEvent(new Event('input')); // Trigger any input event listeners
    }

    // Event listeners for Start Time buttons
    document.getElementById("startTimeUp").addEventListener("click", function() {
        adjustTime(document.getElementById("editStartTime"), adjustmentStep);
    });

    document.getElementById("startTimeDown").addEventListener("click", function() {
        adjustTime(document.getElementById("editStartTime"), -adjustmentStep);
    });

    // Event listeners for End Time buttons
    document.getElementById("endTimeUp").addEventListener("click", function() {
        adjustTime(document.getElementById("editEndTime"), adjustmentStep);
    });

    document.getElementById("endTimeDown").addEventListener("click", function() {
        adjustTime(document.getElementById("editEndTime"), -adjustmentStep);
    });
});

// Use Flatpickr for Date
const dateInput = document.getElementById("editDate");
flatpickr(dateInput, {
    dateFormat: "Y-m-d",  // Date format
    closeOnSelect: false,
    onOpen: function(selectedDates, dateStr, instance) {
        const currentDate = dateInput.value;
        if (currentDate) {
            instance.setDate(currentDate, true); // Jump to current date in input
        }
    }
});

const startTimeInput = document.getElementById("editStartTime");
const endTimeInput = document.getElementById("editEndTime");

// Lazy initialization for flatpickr time inputs
let startTimeInitialized = false;
startTimeInput.addEventListener("focus", function () {
    if (!startTimeInitialized) {
        flatpickr(startTimeInput, {
            enableTime: true,
            noCalendar: true,  // Disable the date selection
            dateFormat: "H:i:S",  // Time format in 24-hour
            time_24hr: true,  // 24-hour time picker
            allowInput: true,  // Allow direct typing of time
            enableSeconds: true,  // Enable seconds input
            defaultDate: startTimeInput.value || "00:00:00",  // Default time if input is empty
        });
        startTimeInitialized = true;
    }
});

let endTimeInitialized = false;
endTimeInput.addEventListener("focus", function () {
    if (!endTimeInitialized) {
        flatpickr(endTimeInput, {
            enableTime: true,
            noCalendar: true,  // Disable the date selection
            dateFormat: "H:i:S",  // Time format in 24-hour
            time_24hr: true,  // 24-hour time picker
            allowInput: true,  // Allow direct typing of time
            enableSeconds: true,  // Enable seconds input
            defaultDate: endTimeInput.value || "00:00:00",  // Default time if input is empty
        });
        endTimeInitialized = true;
    }
});

// Initialize Choices.js for the multi-select filters
const filterOrder = ['u', 'g', 'r', 'i', 'z', 'y'];
const filterTags = new Choices('#filterTags', {
    removeItemButton: true,
    maxItemCount: 3,  // Limit the number of selections to 3
    shouldSort: false,  // Disable alphabetical sorting to maintain the order in HTML
    shouldSortItems: false,  // Disable sorting of selected items
    allowHTML: true, // Allow HTML content in the dropdown
});

function setFilterTags(items) {
    // Clear the current selections and re-add them in the original order
    sortedItems = items.sort((a, b) => filterOrder.indexOf(a) - filterOrder.indexOf(b));
    filterTags.removeActiveItems(); // Remove all active items (lozenges)
    sortedItems.forEach(tag => filterTags.setChoiceByValue(tag)); // Re-add items in the original order
}

function updateFilterObservationFilters() {
    const selectedObservations = d3.selectAll(".observation.selected");

    if (selectedObservations.size() === 1) {
        const selectedData = selectedObservations.data()[0];
        selectedData.filters = filterTags.getValue(true);  // Update the observation's filters
    }
}

// Add event listeners to maintain order after each selection or removal
document.getElementById('filterTags').addEventListener('change', function() {
    setFilterTags(filterTags.getValue(true));
    updateFilterObservationFilters();
    renderLozenges(calculateFiltersUsedPerNight());
});

document.getElementById("editNotes").addEventListener("input", function() {
    const selectedObservations = d3.selectAll(".observation.selected");

    if (selectedObservations.size() === 1) {
        const selectedData = selectedObservations.data()[0];
        selectedData.notes = this.value;  // Update the observation's notes
    }
});

function toggleFormInputs(enabled) {
    const formElements = document.querySelectorAll('#editForm input, #editForm select, #editForm textarea, .time-buttons button');
    formElements.forEach(element => {
        element.disabled = !enabled;
    });

    // Specifically handle the Choices.js dropdown separately if needed
    const filterTagsDropdown = document.querySelector('.choices__inner');
    if (filterTagsDropdown) {
        filterTagsDropdown.classList.toggle('disabled', !enabled);
    }
}

function calculateFiltersUsedPerNight() {
    const filtersPerNight = {};

    filteredObservationData.forEach(observation => {
        const { dayobs, filters } = observation;

        if (!filtersPerNight[dayobs]) {
            filtersPerNight[dayobs] = new Set();
        }

        filters.forEach(filter => {
            filtersPerNight[dayobs].add(filter);
        });
    });

    return filtersPerNight;
}

function renderLozenges(filtersPerNight) {
    const lozengeSVG = d3.select("#lozengesSVG");

    // Define the margins for the lozenges SVG
    const lozengeMargin = { top: 20, right: 10, bottom: 20, left: 0 };
    const lozengeWidth = 25;
    const lozengeHeight = 12;

    lozengeSVG
        .attr("width", lozengeWidth*3 + lozengeMargin.left + lozengeMargin.right)
        .attr("height", height + lozengeMargin.top + lozengeMargin.bottom) // Use the same height as the main SVG

    // Clear previous lozenges
    lozengeSVG.selectAll("*").remove();

    const dayobsKeys = Object.keys(filtersPerNight);

    dayobsKeys.forEach((dayobs) => {
        const filters = Array.from(filtersPerNight[dayobs]);
        const yPosition = dateScale(dayobs) + dateScale.bandwidth() * 0.1 + lozengeMargin.top;

        sortedFilters = filters.sort((a, b) => filterOrder.indexOf(a) - filterOrder.indexOf(b));
        sortedFilters.forEach((filter, filterIndex) => {
            lozengeSVG.append("rect")
                .attr("x", lozengeMargin.left + lozengeWidth * filterIndex)
                .attr("y", yPosition)
                .attr("width", lozengeWidth)
                .attr("height", lozengeHeight)
                .attr("rx", 7)
                .attr("ry", 7)
                .attr("fill", getFilterColor(filter));

            lozengeSVG.append("text")
                .attr("x", lozengeMargin.left + lozengeWidth / 2 + lozengeWidth * filterIndex)
                .attr("y", yPosition + lozengeHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .attr("fill", "#FFFFFF")
                .style("font-family", "monospace")
                .style("font-size", "10px")
                .text(filter);
        });
    });
}

function getFilterColor(filter) {
    const colorMap = {
        'u': 'var(--color-u)',
        'g': 'var(--color-g)',
        'r': 'var(--color-r)',
        'i': 'var(--color-i)',
        'z': 'var(--color-z)',
        'y': 'var(--color-y)'
    };
    return colorMap[filter] || '#000000';  // Fallback to black if filter not found
}

document.addEventListener("keydown", function(event) {
    // Check if the focused element is an input, textarea, or other form control
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable;

    // If an input or textarea is focused, do not trap the arrow keys
    if (isInputFocused) {
        return; // Allow the default behavior and do not handle the arrow keys
    }

    const selectedObservations = d3.selectAll(".observation.selected");
    const selectedAvailableBlocks = d3.selectAll(".available-block.selected");

    // Determine if an observation or an available block is selected
    let selectedData = null;
    if (selectedObservations.size() === 1) {
        selectedData = selectedObservations.data()[0];
    } else if (selectedAvailableBlocks.size() === 1) {
        selectedData = selectedAvailableBlocks.data()[0];
    }

    if (selectedData) {
        switch (event.key) {
            case "ArrowLeft":
            case "ArrowRight":
            case "ArrowUp":
            case "ArrowDown":
                event.preventDefault(); // Prevent the default arrow key behavior
                break;
        }

        let targetBlock = null;

        switch (event.key) {
            case "ArrowLeft":
                targetBlock = findLeftNeighbor(selectedData);
                break;
            case "ArrowRight":
                targetBlock = findRightNeighbor(selectedData);
                break;
            case "ArrowUp":
                targetBlock = findVerticalNeighbor(selectedData, -1); // Up
                break;
            case "ArrowDown":
                targetBlock = findVerticalNeighbor(selectedData, 1); // Down
                break;
        }

        if (targetBlock !== null) {
            highlightObservation(targetBlock);
        }
    }
});


function findLeftNeighbor(selectedData) {
    const allBlocks = [...filteredObservationData, ...availableBlockData]
    .filter(obs => obs.dayobs === selectedData.dayobs)
        .sort((a, b) => a.start - b.start);

    const currentIndex = allBlocks.indexOf(selectedData);

    return currentIndex > 0 ? allBlocks[currentIndex - 1] : null;
}

function findRightNeighbor(selectedData) {
    const allBlocks = [...filteredObservationData, ...availableBlockData]
        .filter(obs => obs.dayobs === selectedData.dayobs)
        .sort((a, b) => a.start - b.start);

    const currentIndex = allBlocks.indexOf(selectedData);

    return currentIndex < allBlocks.length - 1 ? allBlocks[currentIndex + 1] : null;
}

function findVerticalNeighbor(selectedData, direction) {
    const currentCenter = (selectedData.start + selectedData.end) / 2;
    const currentDateIndex = dates.indexOf(selectedData.dayobs);
    const targetDate = dates[currentDateIndex + direction];

    if (!targetDate) return null; // No date to move to

    const allBlocksForTargetDate = [...filteredObservationData, ...availableBlockData]
        .filter(obs => obs.dayobs === targetDate);

    if (allBlocksForTargetDate.length === 0) return null;

    let closestBlock = null;
    let closestDistance = Infinity;

    allBlocksForTargetDate.forEach(obs => {
        const obsCenter = (obs.start + obs.end) / 2;
        const distance = Math.abs(obsCenter - currentCenter);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestBlock = obs;
        }
    });

    return closestBlock;
}

function highlightObservation(selectedBlock) {
    // Deselect all available blocks
    d3.selectAll(".available-block").classed("selected", false)
        .attr("stroke", "none") // Remove highlighting from available blocks
        .attr("stroke-width", null);

    // Deselect all observation blocks
    d3.selectAll(".observation").classed("selected", false)
        .select("rect").attr("stroke", "none").attr("stroke-width", null);

    // Determine if the selected block is an observation or an available block
    const isObservation = filteredObservationData.includes(selectedBlock);
    const blockSelection = isObservation ? ".observation" : ".available-block";

    // Apply the selection and highlight the appropriate block
    d3.selectAll(blockSelection)
        .filter(d => d === selectedBlock)
        .classed("selected", true)
        .attr("stroke", isObservation ? null : "yellow")
        .attr("stroke-width", isObservation ? null : 3);

    if (isObservation) {
        // Highlight the selected observation block
        d3.selectAll(".observation")
            .filter(d => d === selectedBlock)
            .select("rect")
            .attr("stroke", "white")
            .attr("stroke-width", 3);

        // Update the form with the selected observation's data
        document.getElementById("editDate").value = selectedBlock.dayobs;
        document.getElementById("editStartTime").value = formatTime(selectedBlock.start);
        document.getElementById("editEndTime").value = formatTime(selectedBlock.end);
        document.getElementById("duration").value = formatTime(selectedBlock.end - selectedBlock.start, hms=true);
        document.getElementById("editObsType").value = selectedBlock.type;
        setFilterTags(selectedBlock.filters);
        document.getElementById("editNotes").value = selectedBlock.notes || "";

        // Show the form and enable inputs
        document.getElementById("editFormContainer").style.display = "block";
        toggleFormInputs(true);
    } else {
        // Handle case for available blocks
        document.getElementById("editDate").value = selectedBlock.dayobs;
        document.getElementById("editStartTime").value = formatTime(selectedBlock.start);
        document.getElementById("editEndTime").value = formatTime(selectedBlock.end);
        document.getElementById("duration").value = formatTime(selectedBlock.end - selectedBlock.start, hms=true);
        document.getElementById("editObsType").value = ""; // No type for available blocks
        setFilterTags([]); // No filters for available blocks
        document.getElementById("editNotes").value = ""; // No notes for available blocks

        // Show the form but disable inputs
        document.getElementById("editFormContainer").style.display = "block";
        toggleFormInputs(false);
    }
}

function calculateAndDisplayDuration() {
    const startTime = parseTime(document.getElementById("editStartTime").value);
    const endTime = parseTime(document.getElementById("editEndTime").value);

    if (startTime !== null && endTime !== null) {
        const duration = endTime - startTime;
        document.getElementById("duration").value = formatTime(duration, hms=true);
    } else {
        document.getElementById("duration").value = '';
    }
}

// Event listeners to update duration whenever start or end time changes
document.getElementById("editStartTime").addEventListener("input", calculateAndDisplayDuration);
document.getElementById("editEndTime").addEventListener("input", calculateAndDisplayDuration);
