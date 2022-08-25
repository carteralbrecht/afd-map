import {Ion, ScreenSpaceEventHandler, ScreenSpaceEventType, Viewer, Math} from "cesium";
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

document.querySelector("#timeSlider").addEventListener('change', () => {
    const newValue = document.getElementById("timeSlider").value;
    dataSource.seriesToDisplay = newValue;
});

viewer.camera.moveEnd.addEventListener(() => {
    let rect = viewer.camera.computeViewRectangle();
    let west = Math.toDegrees(rect.west).toFixed(4);
    let south = Math.toDegrees(rect.south).toFixed(4);
    let east = Math.toDegrees(rect.east).toFixed(4);
    let north = Math.toDegrees(rect.north).toFixed(4);
    const currentTime = document.getElementById("timeSlider").value
    let displayed_columns = ["EVENT_ID", "customer_name", "customer_job", "ip_address", "customer_email",
        "phone", "product_category", "order_price", "MODEL_SCORE"
    ];
    console.log(`Bounding box is West: ${west}, East: ${east}, North: ${north}, South: ${south}`);

    let event_count = 0;
    let displayed_events = [];
    for (let i = 0; i < events.length && event_count < 30; i++) {
        let event = events[i];
        if (event["EVENT_TS_BUCKET"] === parseInt(currentTime)) {
            let event_lat = parseFloat(event["billing_latitude"]);
            let event_lon = parseFloat(event["billing_longitude"]);

            if (south < event_lat && event_lat < north && west < event_lon && event_lon < east) {
                displayed_events.push(event)
                event_count++;
            }
        }
    }
    if (displayed_events.length > 0) {
        let innerHTML = "<thead><tr>";
        // Generate the headers
        for (let i = 0; i < displayed_columns.length; i++) {
            innerHTML+='<th>' + displayed_columns[i] + '</th>';
        }
        innerHTML += "</tr><tbody>"

        //Generate each row of data
        for (let i = 0; i < displayed_events.length; i++) {
            let displayed_event = displayed_events[i];
            // We'll set this row to highlight yellow or red depending on the model score
            if(parseInt(displayed_event["MODEL_SCORE"]) > 750) {
                innerHTML+= `<tr class="table-danger" id="${displayed_event["ENTITY_ID"]}>`;
            } else if(parseInt(displayed_event["MODEL_SCORE"]) > 650) {
                innerHTML+= `<tr class="table-warning" id="${displayed_event["ENTITY_ID"]}>`;
            } else {
                innerHTML+= `<tr id="${displayed_event["ENTITY_ID"]}>`;
            }

            for (let j = 0; j < displayed_columns.length; j++) {
                let displayed_column = displayed_columns[j]
                innerHTML += '<td>' + displayed_event[displayed_column] + '</td>';
            }
            innerHTML+="</tr>"
        }
        innerHTML += "</tbody>"
        document.getElementById("eventInfoTable").innerHTML = innerHTML
    } else {
        document.getElementById("eventInfoTable").innerHTML = "";
    }
});
