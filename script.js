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
    "Loop": {
        "tooltip": "Closed-loop optimization",
        "category": "AOS transient",
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

    let out = `${obs.date}<br>`;
    if (obs.obstype in obstypes) {
        out += `${obstypes[obs.obstype]['tooltip']}<br>`;
    }
    out += `Start: ${startTime}<br>`;
    out += `End: ${endTime}<br>`;
    out += `Duration: ${duration}<br>`;
    out += `Moon Illumination: ${(moonIllumination * 100).toFixed(2)}%`;
    if (obs.notes) {
        out += `<br>Notes: ${obs.notes}`;
    }
    out = out.replace(/\n/g, "<br>");
    return out;
}

// Helper function to format the time for the input field
function formatTimeForInput(hoursDecimal) {
    let hours = Math.floor(hoursDecimal);
    let minutes = Math.round((hoursDecimal - hours) * 60);
    if (minutes === 60) {
        hours++;
        minutes = 0;
    }

    // Adjust for the 24-hour time format
    if (hours < 0) {
        hours += 24;
    } else if (hours >= 24) {
        hours -= 24;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
        .attr("x", d => customTimeScale(d.start_time) + padding)
        .attr("y", d => dateScale(d.date) + dateScale.bandwidth() * 0.1)
        .attr("width", d => customTimeScale(d.end_time) - customTimeScale(d.start_time) - padding * 2)
        .attr("height", dateScale.bandwidth() * 0.8)
        .attr("fill", d => categoryColor[obstypes[d.obstype]['category']])
        .attr("opacity", d => categoryOpacity[obstypes[d.obstype]['category']])
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
        .style("pointer-events", "none")
        .text(d => d.obstype);

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
                    const rectXCenter = customTimeScale(d.start_time) + (customTimeScale(d.end_time) - customTimeScale(d.start_time)) / 2;
                    const rectYCenter = dateScale(d.date) + dateScale.bandwidth() / 2;

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
                document.getElementById("editDate").value = selectedData.date;
                document.getElementById("editStartTime").value = formatTimeForInput(selectedData.start_time);
                document.getElementById("editEndTime").value = formatTimeForInput(selectedData.end_time);
                document.getElementById("duration").value = formatTime(selectedData.end_time - selectedData.start_time);
                document.getElementById("editObsType").value = selectedData.obstype;
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
        .attr("x", d => customTimeScale(d.start_time))
        .attr("y", d => dateScale(d.date))
        .attr("width", d => customTimeScale(d.end_time) - customTimeScale(d.start_time))
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
            document.getElementById("editDate").value = d.date;
            document.getElementById("editStartTime").value = formatTimeForInput(d.start_time);
            document.getElementById("editEndTime").value = formatTimeForInput(d.end_time);
            document.getElementById("duration").value = formatTime(d.end_time - d.start_time);
            document.getElementById("editObsType").value = ""; // No obstype for available blocks
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
        filteredTwilightData = twilightData.filter(d => dates.includes(d.date));
        filteredMoonData = moonData.filter(d => dates.includes(d.date));
        filteredObservationData = observationData.filter(d => dates.includes(d.date));

        initializeAvailableBlocks();
        pruneAvailableBlocks();

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
                .attr("fill", sunStateColor.day);

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
                .attr("fill", sunStateColor.twilight6);

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
                .attr("fill", sunStateColor.twilight12);

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
                .attr("fill", sunStateColor.twilight18);

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
                .attr("fill", sunStateColor.night);

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
                .attr("fill", sunStateColor.twilight18);

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
                .attr("fill", sunStateColor.twilight12);

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
                .attr("fill", sunStateColor.twilight6);

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
                .attr("fill", sunStateColor.day);
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

function initializeAvailableBlocks() {
    let blockData = [];
    twilightData = filteredTwilightData;

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
                if (observation.date === block.date) { // They are on the same date
                    // Case 1: Observation completely covers the available block
                    if (observation.start_time <= block.start_time && observation.end_time >= block.end_time) {
                        // This available block is fully covered by the observation and should be removed.
                        // Do nothing here, so it gets removed.
                    }
                    // Case 2: Observation overlaps the start of the available block
                    else if (observation.start_time <= block.start_time && observation.end_time > block.start_time && observation.end_time < block.end_time) {
                        // Truncate the start of the available block
                        tempBlocks.push({
                            ...block,
                            start_time: observation.end_time
                        });
                    }
                    // Case 3: Observation overlaps the end of the available block
                    else if (observation.start_time > block.start_time && observation.start_time < block.end_time && observation.end_time >= block.end_time) {
                        // Truncate the end of the available block
                        tempBlocks.push({
                            ...block,
                            end_time: observation.start_time
                        });
                    }
                    // Case 4: Observation is inside the available block
                    else if (observation.start_time > block.start_time && observation.end_time < block.end_time) {
                        // Split the available block into two blocks
                        tempBlocks.push({
                            ...block,
                            end_time: observation.start_time
                        });
                        tempBlocks.push({
                            ...block,
                            start_time: observation.end_time
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
                d => dates.includes(d.date)
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
        selectedData.date = document.getElementById("editDate").value;
        selectedData.start_time = parseTime(document.getElementById("editStartTime").value);
        selectedData.end_time = parseTime(document.getElementById("editEndTime").value);
        selectedData.obstype = document.getElementById("editObsType").value;
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
            const duration = Math.min(1, selectedAvailableBlock.end_time - selectedAvailableBlock.start_time);
            const endTime = selectedAvailableBlock.start_time + duration;

            // Create the new observation block
            const newObservation = {
                date: selectedAvailableBlock.date,
                start_time: selectedAvailableBlock.start_time,
                end_time: endTime,
                obstype: "Survey",
                filters: ['i']
            };

            // Add the new observation to the filteredObservationData
            filteredObservationData.push(newObservation);

            // Update availableBlockData by removing or truncating the selected available block
            if (endTime === selectedAvailableBlock.end_time) {
                // Remove the available block if fully covered by the new observation
                availableBlockData = availableBlockData.filter(block => block !== selectedAvailableBlock);
            } else {
                // Truncate the available block
                selectedAvailableBlock.start_time = endTime;
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
            document.getElementById("editDate").value = newObservation.date;
            document.getElementById("editStartTime").value = formatTimeForInput(newObservation.start_time);
            document.getElementById("editEndTime").value = formatTimeForInput(newObservation.end_time);
            document.getElementById("duration").value = formatTime(newObservation.end_time - newObservation.start_time);
            document.getElementById("editObsType").value = newObservation.obstype;
            setFilterTags(newObservation.filters);
            document.getElementById("editNotes").value = newObservation.notes || "";

            // Enable the form
            toggleFormInputs(true);

            // Show the edit form
            document.getElementById("editFormContainer").style.display = "block";
        }
    }
});

// Helper function to parse time from the input field (hh:mm format) to decimal hours
function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const decimalHours = hours + minutes / 60;
    if (decimalHours >= 12)
        return decimalHours - 24;
    else
        return decimalHours;
}

document.addEventListener("DOMContentLoaded", function() {
    const adjustmentStep = 15; // Time step in minutes

    // Utility function to parse time in HH:MM format to decimal hours
    function parseTimeToDecimalHours(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        let decimalHours = hours + minutes / 60;
        // Adjust for the internal time scale
        if (decimalHours >= 0 && decimalHours < 12) {
            // Morning times (e.g., 00:00 to 07:30)
            return decimalHours;
        } else {
            // Evening times (e.g., 19:00 to 24:00)
            return decimalHours - 24;
        }
    }

    // Utility function to format decimal hours back to HH:MM format
    function formatDecimalHoursToTime(decimalHours) {
        let adjustedHours = decimalHours;
        if (decimalHours < 0) {
            adjustedHours += 24; // Adjust back for positive hours
        }
        const hours = Math.floor(adjustedHours);
        const minutes = Math.round((adjustedHours - hours) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Function to get the list of stopping points based on observations and twilight edges
    function getStoppingPoints(currentDate) {
        const stoppingPoints = [];

        // Filter and add twilight edges for the current date
        filteredTwilightData.forEach(twilight => {
            if (twilight.date === currentDate) {
                stoppingPoints.push(twilight.sunset);
                stoppingPoints.push(twilight.evening_6deg);
                stoppingPoints.push(twilight.evening_12deg);
                stoppingPoints.push(twilight.evening_18deg);
                stoppingPoints.push(twilight.morning_18deg);
                stoppingPoints.push(twilight.morning_12deg);
                stoppingPoints.push(twilight.morning_6deg);
                stoppingPoints.push(twilight.sunrise);
            }
        });

        // Filter and add observation start and end times for the current date
        filteredObservationData.forEach(observation => {
            if (observation.date === currentDate) {
                stoppingPoints.push(observation.start_time);
                stoppingPoints.push(observation.end_time);
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
        let currentDecimalHours = parseTimeToDecimalHours(inputField.value);
        let newDecimalHours;

        if (adjustment > 0) {
            newDecimalHours = findNextStoppingPoint(currentDecimalHours, currentDate, 1);
            newDecimalHours += 0.017; // Add a small offset to avoid rounding errors
        } else {
            newDecimalHours = findNextStoppingPoint(currentDecimalHours, currentDate, -1);
            newDecimalHours -= 0.017; // Subtract a small offset to avoid rounding errors
        }

        // Adjust by 15 minutes if no stopping point is nearby
        const minutesDifference = (newDecimalHours - currentDecimalHours) * 60;
        if (Math.abs(minutesDifference) > adjustmentStep) {
            newDecimalHours = currentDecimalHours + adjustment / 60;
        }

        // Ensure the time stays within the minTime to maxTime period
        if (newDecimalHours < minTime) newDecimalHours = minTime;
        if (newDecimalHours > maxTime) newDecimalHours = maxTime;

        inputField.value = formatDecimalHoursToTime(newDecimalHours);
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

const dateInput = document.getElementById("editDate");
const startTimeInput = document.getElementById("editStartTime");
const endTimeInput = document.getElementById("editEndTime");

// Initialize Flatpickr for Date
flatpickr(dateInput, {
    dateFormat: "Y-m-d",  // Date format
    onOpen: function(selectedDates, dateStr, instance) {
        const currentDate = dateInput.value;
        if (currentDate) {
            instance.setDate(currentDate, true); // Jump to current date in input
        }
    }
});

// Lazy initialization for time inputs
let startTimeInitialized = false;
let endTimeInitialized = false;

startTimeInput.addEventListener("focus", function () {
    if (!startTimeInitialized) {
        flatpickr(startTimeInput, {
            enableTime: true,
            noCalendar: true,  // Disable the date selection
            dateFormat: "H:i",  // Time format in 24-hour
            time_24hr: true,  // 24-hour time picker
            allowInput: true,  // Allow direct typing of time
            defaultDate: startTimeInput.value || "00:00",  // Default time if input is empty
        });
        startTimeInitialized = true;
    }
});

endTimeInput.addEventListener("focus", function () {
    if (!endTimeInitialized) {
        flatpickr(endTimeInput, {
            enableTime: true,
            noCalendar: true,  // Disable the date selection
            dateFormat: "H:i",  // Time format in 24-hour
            time_24hr: true,  // 24-hour time picker
            allowInput: true,  // Allow direct typing of time
            defaultDate: endTimeInput.value || "00:00",  // Default time if input is empty
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
        const { date, filters } = observation;

        if (!filtersPerNight[date]) {
            filtersPerNight[date] = new Set();
        }

        filters.forEach(filter => {
            filtersPerNight[date].add(filter);
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

    const dateKeys = Object.keys(filtersPerNight);

    dateKeys.forEach((date) => {
        const filters = Array.from(filtersPerNight[date]);
        const yPosition = dateScale(date) + dateScale.bandwidth() * 0.1 + lozengeMargin.top;

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
        .filter(obs => obs.date === selectedData.date)
        .sort((a, b) => a.start_time - b.start_time);

    const currentIndex = allBlocks.indexOf(selectedData);

    return currentIndex > 0 ? allBlocks[currentIndex - 1] : null;
}

function findRightNeighbor(selectedData) {
    const allBlocks = [...filteredObservationData, ...availableBlockData]
        .filter(obs => obs.date === selectedData.date)
        .sort((a, b) => a.start_time - b.start_time);

    const currentIndex = allBlocks.indexOf(selectedData);

    return currentIndex < allBlocks.length - 1 ? allBlocks[currentIndex + 1] : null;
}

function findVerticalNeighbor(selectedData, direction) {
    const currentCenter = (selectedData.start_time + selectedData.end_time) / 2;
    const currentDateIndex = dates.indexOf(selectedData.date);
    const targetDate = dates[currentDateIndex + direction];

    if (!targetDate) return null; // No date to move to

    const allBlocksForTargetDate = [...filteredObservationData, ...availableBlockData]
        .filter(obs => obs.date === targetDate);

    if (allBlocksForTargetDate.length === 0) return null;

    let closestBlock = null;
    let closestDistance = Infinity;

    allBlocksForTargetDate.forEach(obs => {
        const obsCenter = (obs.start_time + obs.end_time) / 2;
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
        document.getElementById("editDate").value = selectedBlock.date;
        document.getElementById("editStartTime").value = formatTimeForInput(selectedBlock.start_time);
        document.getElementById("editEndTime").value = formatTimeForInput(selectedBlock.end_time);
        document.getElementById("duration").value = formatTime(selectedBlock.end_time - selectedBlock.start_time);
        document.getElementById("editObsType").value = selectedBlock.obstype;
        setFilterTags(selectedBlock.filters);
        document.getElementById("editNotes").value = selectedBlock.notes || "";

        // Show the form and enable inputs
        document.getElementById("editFormContainer").style.display = "block";
        toggleFormInputs(true);
    } else {
        // Handle case for available blocks
        document.getElementById("editDate").value = selectedBlock.date;
        document.getElementById("editStartTime").value = formatTimeForInput(selectedBlock.start_time);
        document.getElementById("editEndTime").value = formatTimeForInput(selectedBlock.end_time);
        document.getElementById("duration").value = formatTime(selectedBlock.end_time - selectedBlock.start_time);
        document.getElementById("editObsType").value = ""; // No obstype for available blocks
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
        document.getElementById("duration").value = formatTime(duration);
    } else {
        document.getElementById("duration").value = '';
    }
}

// Event listeners to update duration whenever start or end time changes
document.getElementById("editStartTime").addEventListener("input", calculateAndDisplayDuration);
document.getElementById("editEndTime").addEventListener("input", calculateAndDisplayDuration);
