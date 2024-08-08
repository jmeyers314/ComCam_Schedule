// Select the SVG element
const svg = d3.select("#mySVG");

// Define the margins and dimensions
const margin = { top: 20, right: 20, bottom: 20, left: 60 };
const width = +svg.attr("width") - margin.left - margin.right;
const height = +svg.attr("height") - margin.top - margin.bottom;

const minTime = -5;
const maxTime = 7.5;

// Append a group element to the SVG and transform it based on the margins
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

// Define the custom time range for the x-axis (from -7 hours to +8 hours)
const customTimeScale = d3.scaleLinear()
    .domain([minTime, maxTime])
    .range([0, width]);

// Define the date range for the y-axis
const dateRange = d3.timeDay.range(new Date("2024-10-01"), new Date("2024-12-01"));
const dateScale = d3.scaleBand()
    .domain(dateRange.map(d => d.toISOString().split("T")[0]))
    .range([0, height])
    .padding(0.01);

// Define a color scale for sun states
const sunStateColorScale = d3.scaleOrdinal()
    .domain(["day", "6-deg twilight", "12-deg twilight", "18-deg twilight", "night"])
    .range(["#EEEE00", "#00FFFF", "#00AAAA", "#005555", "#000000"]);

// Define a color scale for observation categories
const observationColorScale = d3.scaleOrdinal()
    .domain(["Calibration", "Prep", "AOS transient", "AOS data", "IQ", "Science"])
    .range(["#FF0000", "#FF0000", "#FFFF00", "#0000FF", "##00FF00", "#00FFFF"]);

const observationOpacity = d3.scaleOrdinal()
    .domain(["Calibration", "Prep", "AOS transient", "AOS data", "IQ", "Science"])
    .range([0.4, 0.4, 0.4, 0.7, 0.4, 0.4]);

function formatTime(hoursDecimal) {
    let hours = Math.floor(hoursDecimal);
    let minutes = Math.round((hoursDecimal - hours) * 60);

    // Adjust hours and minutes to be within 24-hour format
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

    return `${obs.date}<br>${obs.tooltip}<br>Start: ${startTime}<br>End: ${endTime}<br>Duration: ${duration}<br>Moon Illumination: ${(moonIllumination * 100).toFixed(2)}%`;
}

// Load data from the external JSON files
Promise.all([
    d3.json("twilight.json?t=" + new Date().getTime()),
    d3.json("moon.json?t=" + new Date().getTime()),
    d3.json("observation.json?t=" + new Date().getTime())
]).then(function(data) {
    const [twilightData, moonData, observationData] = data;

    // Filter data to exclude dates outside the specified range
    const filteredTwilightData = twilightData.filter(d => dateRange.map(date => date.toISOString().split("T")[0]).includes(d.date));
    const filteredMoonData = moonData.filter(d => dateRange.map(date => date.toISOString().split("T")[0]).includes(d.date));
    const filteredObservationData = observationData.filter(d => dateRange.map(date => date.toISOString().split("T")[0]).includes(d.date));

    // Add background rectangles for sun states
    filteredTwilightData.forEach(state => {
        g.append("rect")
            // .attr("x", customTimeScale(state.sunset))
            .attr("x", customTimeScale(minTime))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(state.sunset) - customTimeScale(minTime))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("day"));

        g.append("rect")
            .attr("x", customTimeScale(state.sunset))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(state.evening_6deg) - customTimeScale(state.sunset))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("6-deg twilight"));

        g.append("rect")
            .attr("x", customTimeScale(state.evening_6deg))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(state.evening_12deg) - customTimeScale(state.evening_6deg))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("12-deg twilight"));

        g.append("rect")
            .attr("x", customTimeScale(state.evening_12deg))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(state.evening_18deg) - customTimeScale(state.evening_12deg))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("18-deg twilight"));

        g.append("rect")
            .attr("x", customTimeScale(state.evening_18deg))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(state.morning_18deg) - customTimeScale(state.evening_18deg))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("night"));

        g.append("rect")
            .attr("x", customTimeScale(state.morning_18deg))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(state.morning_12deg) - customTimeScale(state.morning_18deg))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("18-deg twilight"));

        g.append("rect")
            .attr("x", customTimeScale(state.morning_12deg))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(state.morning_6deg) - customTimeScale(state.morning_12deg))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("12-deg twilight"));

        g.append("rect")
            .attr("x", customTimeScale(state.morning_6deg))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(state.sunrise) - customTimeScale(state.morning_6deg))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("6-deg twilight"));

        g.append("rect")
            .attr("x", customTimeScale(state.sunrise))
            .attr("y", dateScale(state.date))
            .attr("width", customTimeScale(8) - customTimeScale(state.sunrise))
            .attr("height", dateScale.bandwidth())
            .attr("fill", sunStateColorScale("day"));
    });

    // Add rectangles for moon states
    filteredMoonData.forEach(state => {
        state.moonintervals.forEach(interval => {
            const start = Math.max(minTime, interval[0]);
            const end = Math.min(8, interval[1]);

            // Only add the rectangle if the interval is within the valid range
            if (start < end) {
                g.append("rect")
                    .attr("x", customTimeScale(start))
                    .attr("y", dateScale(state.date))
                    .attr("width", customTimeScale(end) - customTimeScale(start))
                    .attr("height", dateScale.bandwidth())
                    .attr("fill", "grey")
                    .attr("opacity", 0.5); // Adjust the opacity to indicate moon presence
            }
        });
    });

    const padding = 3; // Horizontal padding for the rectangles
    const cornerRadius = 3; // Radius for rounded corners

    filteredObservationData.forEach(obs => {
        const link = obs.url ? g.append("a").attr("xlink:href", obs.url).attr("target", "_blank") : g;

        const xStart = customTimeScale(obs.start_time) + padding;
        const xEnd = customTimeScale(obs.end_time) - padding;
        const width = xEnd - xStart;

        const rectHeight = dateScale.bandwidth() * 0.8;
        const rectY = dateScale(obs.date) + dateScale.bandwidth() * 0.1;

        const group = link.append("g");

        group.append("rect")
            .attr("x", xStart)
            .attr("y", rectY)
            .attr("width", width)
            .attr("height", rectHeight)
            .attr("fill", observationColorScale(obs.category))
            .attr("opacity", observationOpacity(obs.category))
            .attr("rx", cornerRadius)
            .attr("ry", cornerRadius);

        group.append("text")
            .attr("x", xStart + width / 2)
            .attr("y", rectY + rectHeight / 2)
            .attr("dy", ".35em") // Adjusts the text vertically to be centered
            .attr("text-anchor", "middle") // Centers the text horizontally
            .attr("fill", "#FFFFFF") // Text color
            .style("font-family", "monospace") // Sets the font to monospace
            .style("font-size", "10px") // Sets the font size to 10px (or any desired size)
            .text(obs.label);

        // Find the corresponding moon data for the current observation date
        const moonDataForDate = filteredMoonData.find(moon => moon.date === obs.date);
        console.debug(moonDataForDate);

        group.on("mouseover", function(event) {
                const tooltip = d3.select("#tooltip");
                tooltip.style("display", "block")
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY + 5) + "px")
                    .style("font-family", "monospace")
                    .style("font-size", "10px")
                    .html(formatTooltip(obs, moonDataForDate ? moonDataForDate.illumination : 0));
            })
            .on("mousemove", function(event) {
                const tooltip = d3.select("#tooltip");
                tooltip.style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY + 5) + "px");
            })
            .on("mouseout", function() {
                d3.select("#tooltip").style("display", "none");
            });
    });

    // Add axes
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

}).catch(function(error) {
    console.error("Error loading the JSON data: ", error);
});
