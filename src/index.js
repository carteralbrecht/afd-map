import {Ion, ScreenSpaceEventHandler, ScreenSpaceEventType, Viewer, Math, Rectangle} from "cesium";
import "cesium/Widgets/widgets.css";
import WebGLGlobeDataSource from "./WebGLGlobeDataSource.js";
import events from "./events.json";

Ion.defaultAccessToken = process.env.CESIUM_TOKEN;

//Create a Viewer instances and add the DataSource.
const viewer = new Viewer("cesiumContainer", {
    animation: false,
    timeline: false,
});

const dataSource = new WebGLGlobeDataSource();
dataSource.load();
viewer.clock.shouldAnimate = false;
viewer.dataSources.add(dataSource);

const handlerToolTips = new ScreenSpaceEventHandler(viewer.scene.canvas);
let playInterval = null;
let selectedEntityId = null;

handlerToolTips.setInputAction(function (movement) {
    const entityBeingSelected = getSelectedEntity(movement.endPosition);
    if (entityBeingSelected === null) {
        selectedEntityId = null;
        moveRowToTopAndHighlight(entityBeingSelected);
    } else if (entityBeingSelected.id !== selectedEntityId) {
        selectedEntityId = entityBeingSelected.id;
        unhighlightEntity(entityBeingSelected);
    }
}, ScreenSpaceEventType.MOUSE_MOVE);

function getSelectedEntity(position) {
    let pickedObject = viewer.scene.pick(position);
    if (pickedObject !== undefined) {
        return pickedObject.id;

    }
    return null;
}

function unhighlightEntity(entity) {
}

function moveRowToTopAndHighlight(entity) {
    // var rows = document.getElementById("table").rows, parent = rows[index].parentNode;
    // eventInfoTable
}

function getCurrentTimeSliderValue() {
    return document.getElementById("timeSlider").value;
}

function setDateField(epochValue) {
    let d = new Date(parseInt(epochValue) * 1000);
    document.getElementById("timeColumn").innerHTML = d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

function incrementTimeStep() {
    document.getElementById("timeSlider").stepUp(1);
    setDateField(getCurrentTimeSliderValue());
    dataSource.seriesToDisplay = getCurrentTimeSliderValue();
    updateEventData();
}

function updateEventData() {
    let rect = viewer.camera.computeViewRectangle();
    let west = Math.toDegrees(rect.west).toFixed(4);
    let south = Math.toDegrees(rect.south).toFixed(4);
    let east = Math.toDegrees(rect.east).toFixed(4);
    let north = Math.toDegrees(rect.north).toFixed(4);
    const currentTime = document.getElementById("timeSlider").value
    let displayedColumns = ["EVENT_ID", "customer_name", "customer_job", "ip_address", "customer_email",
        "phone", "product_category", "order_price", "MODEL_SCORE"
    ];
    console.log(`Bounding box is West: ${west}, East: ${east}, North: ${north}, South: ${south}`);

    let eventCount = 0;
    let displayedEvents = [];
    for (let i = 0; i < events.length && eventCount < 30; i++) {
        let event = events[i];
        if (event["EVENT_TS_BUCKET"] === parseInt(currentTime)) {
            let eventLat = parseFloat(event["billing_latitude"]);
            let eventLon = parseFloat(event["billing_longitude"]);

            if (south < eventLat && eventLat < north && west < eventLon && eventLon < east) {
                displayedEvents.push(event)
                eventCount++;
            }
        }
    }
    if (displayedEvents.length > 0) {
        let innerHTML = "<thead><tr>";
        // Generate the headers
        for (let i = 0; i < displayedColumns.length; i++) {
            innerHTML+='<th>' + displayedColumns[i] + '</th>';
        }
        innerHTML += "</tr><tbody>"

        //Generate each row of data
        for (let i = 0; i < displayedEvents.length; i++) {
            let displayedEvent = displayedEvents[i];
            // We'll set this row to highlight yellow or red depending on the model score
            if(parseInt(displayedEvent["MODEL_SCORE"]) > 750) {
                innerHTML+= `<tr class="table-danger" id="${displayedEvent["ENTITY_ID"]}>`;
            } else if(parseInt(displayedEvent["MODEL_SCORE"]) > 650) {
                innerHTML+= `<tr class="table-warning" id="${displayedEvent["ENTITY_ID"]}>`;
            } else {
                innerHTML+= `<tr id="${displayedEvent["ENTITY_ID"]}>`;
            }

            for (let j = 0; j < displayedColumns.length; j++) {
                let displayedColumn = displayedColumns[j]
                innerHTML += '<td>' + displayedEvent[displayedColumn] + '</td>';
            }
            innerHTML+="</tr>"
        }
        innerHTML += "</tbody>"
        document.getElementById("eventInfoTable").innerHTML = innerHTML
    } else {
        document.getElementById("eventInfoTable").innerHTML = "";
    }
}

document.querySelector("#timeSlider").addEventListener('change', () => {
    setDateField(getCurrentTimeSliderValue());
    dataSource.seriesToDisplay = getCurrentTimeSliderValue();
    updateEventData();
});

document.querySelector("#playButton").addEventListener('click', () => {
    if (playInterval === null) {
        playInterval = setInterval(incrementTimeStep, 500);
    }
})

document.querySelector("#pauseButton").addEventListener('click', () => {
    if (playInterval != null) {
        clearInterval(playInterval);
        playInterval = null;
    }
})

viewer.camera.moveEnd.addEventListener(() => {
    updateEventData();
});

// When the page loads, set the lines to visible
dataSource.seriesToDisplay = getCurrentTimeSliderValue();
setDateField(getCurrentTimeSliderValue());

// Centers the map on the united states (where our data is) and triggers the moveEnd which renders the event table
let rectangle = Rectangle.fromDegrees(-152.0026, 9.2220, -43.7370, 49.1125);
viewer.camera.flyTo({destination : rectangle});