
const EV_CHANCE_TIME = "ChanceTime"
const EV_TECH_ZONE   = "TechZone"

// HELPER FUNCTIONS
function getNextEvent(chart, time, name) {
    for (const event of chart.events) {
        if (time < event.start && (event.name == name || name == null)) {
            return event;
        }
    }

    return null;
}

function getCurrentEvent(chart, time) {
    for (const event of chart.events) {
        if (time >= event.start && time < event.end) {
            return event;
        }
    }

    return null;
}

//
//
function preprocessChart(chart) {
    let index = 0;

    for (let event of chart.events) {
        if (event.name == EV_CHANCE_TIME || event.name == EV_TECH_ZONE) {
            event.noteCount = 0;
            event.firstIndex = -1;
            event.lastIndex = -1;
            event.index = index++;

            console.log(event);

            chart.notes.forEach((note, index) => {
                if (note.time >= event.start && note.time < event.end) {
                    event.noteCount++;
                    event.lastIndex = index;
                    if (event.firstIndex == -1) { event.firstIndex = index; };

                    note.eventIndex = event.index;
                    note.eventType = event.name;
                }
                else {
                    if (!note.hasOwnProperty("eventIndex")) {
                        note.eventIndex = -1;
                        note.eventType = "NONE";
                    }
                }
            });
        }
    }

    return chart;
}