import {Ion, Viewer, ScreenSpaceEventHandler, ScreenSpaceEventType, defined, Entity, PolylineGraphics} from "cesium";
import "cesium/Widgets/widgets.css";
import WebGLGlobeDataSource from "./WebGLGlobeDataSource.js";

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
        hideTooltip();
    } else if (entityBeingSelected.id !== selectedEntityId) {
        selectedEntityId = entityBeingSelected.id;
        showTooltip(movement.endPosition, entityBeingSelected);
    }
}, ScreenSpaceEventType.MOUSE_MOVE);

function getSelectedEntity(position) {
    let pickedObject = viewer.scene.pick(position);
    if (pickedObject !== undefined) {
        return pickedObject.id;

    }
    return null;
}

function showTooltip(endPosition, entity) {
    const tooltipContent = document.getElementById('tooltip-content');
    tooltipContent.innerHTML = `Selected Event: lat=${entity.latitude}, lon=${entity.longitude}`;
}

function hideTooltip() {
    const tooltipContent = document.getElementById('tooltip-content');
    tooltipContent.innerHTML = `Selected Event:`;
}

document.querySelector("#timeSlider").addEventListener('change', () => {
    const newValue = document.getElementById("timeSlider").value;
    dataSource.seriesToDisplay = newValue;
})

