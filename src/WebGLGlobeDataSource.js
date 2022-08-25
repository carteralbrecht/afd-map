import * as Cesium from "cesium";
import data from "./data.json";

/**
 * This class is an example of a custom DataSource.  It loads JSON data as
 * defined by Google's WebGL Globe, https://github.com/dataarts/webgl-globe.
 * @alias WebGLGlobeDataSource
 * @constructor
 *
 * @param {String} [name] The name of this data source.  If undefined, a name
 *                        will be derived from the url.
 *
 * @example
 * var dataSource = new Cesium.WebGLGlobeDataSource();
 * dataSource.loadUrl('sample.json');
 * viewer.dataSources.add(dataSource);
 */

class WebGLGlobeDataSource {
    get clustering() {
        return this._clustering;
    }

    set clustering(value) {
        this._clustering = value;
    }
    get show() {
        return this._show;
    }

    set show(value) {
        this._show = value;
    }
    get heightScale() {
        return this._heightScale;
    }

    set heightScale(value) {
        if (value > 0) {
            throw new Cesium.DeveloperError('value must be greater than 0');
        }
        this._heightScale = value;
    }
    get seriesToDisplay() {
        return this._seriesToDisplay;
    }

    set seriesToDisplay(value) {
        this._seriesToDisplay = value;

        //Iterate over all entities and set their show property
        //to true only if they are part of the current series.
        var collection = this._entityCollection;
        var entities = collection.values;
        collection.suspendEvents();
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            entity.show = value === this._seriesToDisplay._name;
        }
        collection.resumeEvents();
    }
    get seriesNames() {
        return this._seriesNames;
    }

    set seriesNames(value) {
        this._seriesNames = value;
    }
    get loadingEvent() {
        return this._loading;
    }

    set loadingEvent(value) {
        this._loading = value;
    }
    get entityCollection() {
        return this._entityCollection;
    }

    set entityCollection(value) {
        this._entityCollection = value;
    }
    get errorEvent() {
        return this._error;
    }

    set errorEvent(value) {
        this._error = value;
    }
    get isLoading() {
        return this._isLoading;
    }

    set isLoading(value) {
        this._isLoading = value;
    }
    get entities() {
        return this._entityCollection;
    }

    set entities(value) {
        this._entityCollection = value;
    }
    get changedEvent() {
        return this._changed;
    }

    set changedEvent(value) {
        this._changed = value;
    }
    constructor(name) {
        //All public configuration is defined as ES5 properties
        //These are just the "private" variables and their defaults.
        this._name = name;
        this._changed = new Cesium.Event();
        this._error = new Cesium.Event();
        this._isLoading = false;
        this._loading = new Cesium.Event();
        this._entityCollection = new Cesium.EntityCollection();
        this._seriesNames = [];
        this._seriesToDisplay = undefined;
        this._heightScale = 10000000;
        this.clock = new Cesium.DataSourceClock()
        this._show = true;
        this._clustering = new Cesium.EntityCluster({
            enabled: false
        })

    }

    load() {

        //Clear out any data that might already exist.
        this._setLoading(true);
        this._seriesNames.length = 0;
        this._seriesToDisplay = undefined;

        var heightScale = this.heightScale;
        var entities = this._entityCollection;

        //It's a good idea to suspend events when making changes to a
        //large amount of entities.  This will cause events to be batched up
        //into the minimal amount of function calls and all take place at the
        //end of processing (when resumeEvents is called).
        entities.suspendEvents();
        entities.removeAll();

        var cnt = 0;
        for (var key in data) {
            var seriesName = key;
            var coordinates = data[key];

            //Add the name of the series to our list of possible values.
            this._seriesNames.push(seriesName);

            //Make the first series the visible one by default
            if (cnt === 0) {
                this._seriesToDisplay = seriesName;
            }

            //Now loop over each coordinate in the series and create
            // our entities from the data.
            for (var i = 0; i < coordinates.length; i += 3) {
                var latitude = coordinates[i];
                var longitude = coordinates[i + 1];
                var height = coordinates[i + 2];

                //Ignore lines of zero height.
                if(height === 0) {
                    continue;
                }

                var color = Cesium.Color.fromHsl((0.6 - (height * 0.5)), 1.0, 0.5);
                var surfacePosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
                var heightPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, height * heightScale);

                //WebGL Globe only contains lines, so that's the only graphics we create.
                var polyline = new Cesium.PolylineGraphics();
                polyline.material = new Cesium.ColorMaterialProperty(color);
                polyline.width = new Cesium.ConstantProperty(2);
                polyline.followSurface = new Cesium.ConstantProperty(false);
                polyline.positions = new Cesium.ConstantProperty([surfacePosition, heightPosition]);

                //The polyline instance itself needs to be on an entity.
                var entity = new Cesium.Entity({
                    id : seriesName + ' index ' + i.toString(),
                    show : cnt === 0,
                    polyline : polyline,
                    seriesName : seriesName //Custom property to indicate series name
                });

                //Add the entity to the collection.
                entities.add(entity);
            }
            cnt++;
        }
        entities.resumeEvents();
        this._changed.raiseEvent(this);
        this._setLoading(false);
    };

    _setLoading(isLoading) {
        if (this._isLoading !== isLoading) {
            this._isLoading = isLoading;
            this._loading.raiseEvent(this, isLoading);
        }
    }
}

export default WebGLGlobeDataSource;

