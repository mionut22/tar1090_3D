/*
    * 3D visualization of an aircraft using CesiumJS for tar1090
    * Author: Ionut Muntean
*/

const cesiumIonToken = typeof window.CESIUM_ION_TOKEN === 'string'
    ? window.CESIUM_ION_TOKEN.trim()
    : '';

if (cesiumIonToken) {
    Cesium.Ion.defaultAccessToken = cesiumIonToken;
} else {
    console.warn('Cesium ion token missing. Define window.CESIUM_ION_TOKEN in html/3d.config.local.js.');
}

// Initialization *************************************
const esri = new Cesium.UrlTemplateImageryProvider({
    url: "http://tilegen.ami:8080/sat/{z}/{y}/{x}",
    credit: new Cesium.Credit('Powered by <a href="https://www.esri.com">Esri.com</a>', true),
    maxZoom: 12
});

const osm = new Cesium.UrlTemplateImageryProvider({
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    credit: new Cesium.Credit("\u003ca href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\"\u003e\u0026copy; OpenStreetMap contributors\u003c/a\u003e", true)
});

const satStreets = new Cesium.UrlTemplateImageryProvider({
    layerName: 'SatStreets',
    url: "http://tilegen.ami:8080/lstreets/{z}/{x}/{y}",
    maxZoom: 20,
    credit: new Cesium.Credit('Powered by AMI Tilegen', true)
});

const arcGisTerrain = new Cesium.ProviderViewModel({
    name: "ArcGIS World Terrain",
    iconUrl: "https://www.arcgis.com/sharing/rest/content/items/58a541efc59545e6b7137f961d7de883/info/thumbnail/thumbnail1585609861151.png",
    creationFunction: () => {
        return Cesium.ArcGISTiledElevationTerrainProvider.fromUrl("https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer");
    },
    tooltip: "ArcGIS World Terrain",
});

const myMaps = [

    new Cesium.ProviderViewModel({
        name: "Streets overlay on ESRI",
        iconUrl: Cesium.buildModuleUrl("Widgets/Images/ImageryProviders/googleSatelliteLabels.png"),
        tooltip: "Streets layer ontop on ESRI",
        creationFunction: () => { return [satStreets]; }
    }),

    new Cesium.ProviderViewModel({
        name: "Sattelite (ESRI)",
        iconUrl: Cesium.buildModuleUrl("Widgets/Images/ImageryProviders/googleSatelliteLabels.png"),
        tooltip: "ESRI imagery",
        creationFunction: () => esri
    }),

    new Cesium.ProviderViewModel({
        name: "OpenstreetMap",
        iconUrl: Cesium.buildModuleUrl("Widgets/Images/ImageryProviders/openStreetMap.png"),
        tooltip: "OpenStreetMap",
        creationFunction: () => osm,
    }),
];

let viewer = undefined;
let scene = undefined;
let camera = undefined;
let viewModel = undefined;
let clock = undefined;
let pointEntity = undefined;
let orientationEntity = undefined;
let position = undefined;
let callsign = undefined;
let aircraft = undefined;
let onGround = false;
let aircraftEntity = undefined;
let currentAircraftModelType = '';
let otherPlanes = {};
let start = undefined;
let stop = undefined;
let lastCoords = undefined;
let modelDefault = "Cesium_Air.glb";
let modelUri = "/3dmodels/Cesium_Air.glb";
let modelPath = "/3dmodels/";
let google3dTileset = undefined;
let modelRotationOffsetDeg = 0;
let terrainProvider = undefined; // Store terrain provider for cleanup
let renderErrorHandler = null; // Store render error handler for cleanup
const debugParam = new URLSearchParams(window.location.search).get('debug');
let debug = debugParam === '1' || debugParam === 'true';
window.tar1090Debug = debug;
let isAnimating = false;
let posBuffer = [];
window.tar1090LatestWatchedSampleTimeMs = 0;
let lastWatchedSampleTimestampMs = 0;
const minPosinBuffer = 5; // Minimum number of samples in buffer before starting interpolation  
const overlay = document.getElementById('loadingOverlay');
window.__infoBoxHideTimer = null;
let mainMessageListener = null;
const MODEL_HEADING_OFFSET_DEG = 0;
const GS_KNOT_TO_FPM = 101.268591;
const MIN_GS_KNOTS_FOR_PITCH = 35;
const MAX_ABS_BARO_RATE_FPM = 9000;
const MAX_ABS_PITCH_DEG = 25;
const BARO_RATE_DEADBAND_FPM = 80;
const MAX_PITCH_STEP_DEG = 2.5;
const MIN_ABS_TELEMETRY_ROLL_DEG = 0.2;
const MIN_GS_KNOTS_FOR_ROLL_ESTIMATE = 45;
const MAX_ABS_ROLL_DEG = 45;
const ARC_TARGET_INTERVAL_SEC = 2.5;          // target spacing between interpolated samples
const MAX_ARC_INTERMEDIATE_SAMPLES = 6;       // hard cap per segment to avoid overload
const MAX_ROLL_STEP_DEG = 1.5;                // max roll change (°) per sample for smoothing
const MODEL_URI_ALIASES = {
    "A20N": "A320", "A21N": "A321", "A339": "A333", "A338": "A333", "A342": "A343", "A345": "A343", "A35K": "A359", "EC30": "EC35",
    "EC45": "EC35", "AT44": "AT43", "AT45": "AT43", "AT46": "AT43", "B733": "B736", "B734": "B736", "B37M": "B737", "B38M": "B738",
    "B77L": "B772", "B77W": "B773", "B778": "B773", "B779": "B773", "B462": "B461", "B463": "B461", "C501": "C500", "C510": "C500",
    "C525": "C500", "C25A": "C500", "C25B": "C500", "C25C": "C500", "C550": "C500", "DH8B": "DH8A", "DH8C": "DH8A", "DH8D": "DH8A",
    "C140": "C172", "C150": "C172", "C152": "C172", "C170": "C172", "C72R": "C172", "C182": "C172", "E3CF": "E3TF",
    //    "E195": "E190", "E195E2": "E190", "E190E2": "E190", "F900": "F70", "F70L": "F70", "F70W": "F70", "F100": "F100", "F28X": "F28"
};
const MODEL_URI_CACHE = Object.create(null);
const MODEL_CONFIG_CACHE = Object.create(null);
let lastPitchDeg = 0;
let lastRollEstimateDeg = 0;
let lastRollHeadingDeg = null;
let lastRollTimestampMs = null;
let lastRollSampleDeg = 0;                    // tracks roll across arc samples for step-limiting
let lastPitchSampleDeg = 0;                   // tracks pitch across arc samples for step-limiting
let lastWatchedDataReceivedTimeMs = Date.now(); // tracks when data was last received for watched aircraft
let watchedAircraftDataTimeoutIntervalId = null; // interval for checking watched aircraft data timeout

/**
 * Forces a Cesium viewer resize and requests a render to keep canvas dimensions in sync.
 */
function forceViewerResize() {
    if (!viewer || viewer.isDestroyed()) {
        return;
    }

    if (typeof viewer.forceResize === 'function') {
        viewer.forceResize();
    } else if (typeof viewer.resize === 'function') {
        viewer.resize();
    }

    if (viewer.scene) {
        viewer.scene.requestRender();
    }
}

/**
 * Converts a source timestamp to epoch milliseconds, accepting seconds or milliseconds.
 * @param {number|string} sourceNow Timestamp value from the data source.
 * @param {number} [fallbackMs=Date.now()] Fallback timestamp when source value is invalid.
 * @returns {number} Timestamp in epoch milliseconds.
 */
function sourceNowToTimestampMs(sourceNow, fallbackMs = Date.now()) {
    const numeric = Number(sourceNow);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallbackMs;
    }

    // Prefer epoch-seconds, but tolerate epoch-milliseconds to avoid invalid dates.
    if (numeric > 1e12) {
        return Math.round(numeric);
    }

    return Math.round(numeric * 1000);
}

/**
 * Checks if a value can be converted to a finite number.
 * @param {*} value Input value.
 * @returns {boolean} True when the value is numeric and finite.
 */
function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
}

/**
 * Clamps a numeric value to an inclusive range.
 * @param {number} value Value to clamp.
 * @param {number} minValue Lower bound.
 * @param {number} maxValue Upper bound.
 * @returns {number} Clamped value.
 */
function clampNumber(value, minValue, maxValue) {
    return Math.min(maxValue, Math.max(minValue, value));
}

/**
 * Validates that coordinate payload includes finite latitude and longitude.
 * @param {{lat:number, lon:number}} coords Coordinate object.
 * @returns {boolean} True when coordinates are usable.
 */
function hasValidPosition(coords) {
    return !!coords &&
        isFiniteNumber(coords.lon) &&
        isFiniteNumber(coords.lat);
}

/**
 * Ensures sample timestamps are strictly increasing for Cesium sampled properties.
 * @param {number} timestampMs Candidate timestamp.
 * @param {number} lastTimestampMs Previous timestamp.
 * @returns {number} Monotonic timestamp.
 */
function ensureIncreasingTimestampMs(timestampMs, lastTimestampMs) {
    if (!Number.isFinite(lastTimestampMs) || lastTimestampMs <= 0) {
        return timestampMs;
    }

    return timestampMs <= lastTimestampMs ? lastTimestampMs + 1 : timestampMs;
}

/**
 * Derives a monotonic sample timestamp for a plane update.
 * @param {Object} plane Aircraft payload.
 * @param {number} [lastTimestampMs=0] Last accepted timestamp.
 * @param {number} [fallbackMs=Date.now()] Fallback timestamp if payload timestamp is missing.
 * @returns {number} Sample timestamp in milliseconds.
 */
function getPlaneSampleTimestampMs(plane, lastTimestampMs = 0, fallbackMs = Date.now()) {
    const timestampMs = sourceNowToTimestampMs(plane && plane.now, fallbackMs);
    return ensureIncreasingTimestampMs(timestampMs, lastTimestampMs);
}

/**
 * Converts epoch milliseconds to Cesium JulianDate.
 * @param {number} timestampMs Epoch milliseconds.
 * @returns {Cesium.JulianDate} Converted Julian date.
 */
function julianFromTimestampMs(timestampMs) {
    return Cesium.JulianDate.fromDate(new Date(timestampMs));
}

/**
 * Creates and configures the Cesium viewer and sampled properties used for tracking.
 */
function createViewer() {
    viewer = new Cesium.Viewer('cesiumContainer', {
        sceneMode: Cesium.SceneMode.SCENE3D,
        scene3DOnly: true,
        sceneModePicker: false,
        shadows: false,
        terrainShadows: Cesium.ShadowMode.DISABLED,
        fullscreenButton: false,
        homeButton: false,
        navigationHelpButton: false,
        shouldAnimate: false,
        timeline: false,
        animation: false,
        clock: Cesium.ClockRange.UNBOUNDED,
        clockStep: Cesium.ClockStep.SYSTEM_CLOCK,
        baseLayerPicker: true,
        geocoder: false,
    });
    scene = viewer.scene;
    camera = viewer.camera;
    clock = viewer.clock;
    clock.shouldAnimate = false;
    clock.multiplier = 0.0;
    renderErrorHandler = (scene, error) => {
        console.log('Cesium render error:', error);
        stopPlayback();
    };
    viewer.scene.renderError.addEventListener(renderErrorHandler);

    viewModel = viewer.baseLayerPicker.viewModel;
    pointEntity = new Cesium.SampledPositionProperty();
    orientationEntity = new Cesium.SampledProperty(Cesium.Quaternion);
    pointEntity.forwardExtrapolationType = Cesium.ExtrapolationType.EXTRAPOLATE;
    pointEntity.forwardExtrapolationDuration = minPosinBuffer;
    pointEntity.setInterpolationOptions({
        interpolationDegree: 2,
        // interpolationAlgorithm: Cesium.LinearApproximation,
        interpolationAlgorithm: Cesium.CubicRealPolynomialApproximation,
    });
    if (typeof globalVariableIntervalManager !== 'undefined') {
        globalVariableIntervalManager.playbackController =
            new VariableIntervalPlaybackController(viewer);
        startVariableIntervalMonitoring();
        log('[INIT] Variable interval playback controller initialized');
    }
}

/**
 * Shows a status/info message in the floating info box.
 * @param {string} message HTML content to display.
 * @param {{persistent?: boolean, autoHideMs?: number}} [options={}] Visibility behavior options.
 */
function messageBox(message, options = {}) {
    const persistent = options.persistent === true;
    const autoHideMs = Number.isFinite(options.autoHideMs) ? options.autoHideMs : 6000;
    let i = document.getElementById('infoBox');
    if (i) {
        i.innerHTML = message;
        i.classList.add('visible');

        if (window.__infoBoxHideTimer) {
            clearTimeout(window.__infoBoxHideTimer);
            window.__infoBoxHideTimer = null;
        }

        if (persistent) {
            i.classList.add('live');
        } else {
            i.classList.remove('live');
            window.__infoBoxHideTimer = setTimeout(() => {
                if (!i.classList.contains('live')) {
                    i.classList.remove('visible');
                }
            }, autoHideMs);
        }
    }
}

/**
 * Hides and resets the floating info box.
 */
function clearMessageBox() {
    let i = document.getElementById('infoBox');
    if (i) {
        i.classList.remove('visible');
        i.classList.remove('live');
        if (window.__infoBoxHideTimer) {
            clearTimeout(window.__infoBoxHideTimer);
            window.__infoBoxHideTimer = null;
        }
    }
}

/**
 * Renders the current watched-aircraft telemetry text in the info box.
 */
function flightMessage() {
    if (debug) {
        return;
    }
    let message = '<b>' + aircraft.flight + '</b>' + // " (" + aircraft.desc + ')' +
        ' Altitude: ' + (getAltitude()).toFixed(2) + ' m' +
        ' Speed: ' + (aircraft.gs * 1.852).toFixed(2) + ' km/h' +
        ' VRate: ' + (aircraft.baro_rate * 0.00508).toFixed(2) + ' m/s' +
        ' <span style="color: ' + (onGround ? 'red' : 'green') + ';">' + (onGround ? 'On Ground' : 'Airborne') + '</span>' +
        (aircraft.isotime ? ('<br><span style="font-size: smaller;">Last seen: ' + new Date(aircraft.isotime).toLocaleString() + '</span>') : '');
    messageBox(message, { persistent: true });
}

/**
 * Applies scene, camera, globe, and terrain defaults after viewer creation.
 * @returns {Promise<void>} Resolves after asynchronous terrain provider setup starts.
 */
async function setupEnvironment() {
    scene.screenSpaceCameraController.enableCollisionDetection = true;
    viewer.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
    viewer.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
    scene.screenSpaceCameraController.enableCollisionDetection = true;
    scene.screenSpaceCameraController.enableTilt = false;
    scene.screenSpaceCameraController.enableRotate = true;
    scene.screenSpaceCameraController.enableZoom = true;
    scene.screenSpaceCameraController.enableTranslate = false;
    scene.screenSpaceCameraController.enableLook = false;
    scene.globe.atmosphereLightIntensity = 20.0;
    scene.globe.dynamicAtmosphereLightingFromSun = true;
    scene.postProcessStages.ambientOcclusion.enabled = false;
    scene.globe.showGroundAtmosphere = false;
    scene.globe.enableLighting = true;
    scene.globe.depthTestAgainstTerrain = true;
    viewer.terrainShadows = Cesium.ShadowMode.ENABLED;
    viewer.shadows = false;
    viewer.resolutionScale = 1; // 0.85;
    viewer.clockViewModel.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
    viewModel.imageryProviderViewModels = myMaps;
    viewModel.selectedImagery = viewModel.imageryProviderViewModels[0];
    viewModel.terrainProviderViewModels = [];

    // Load ArcGIS terrain by default
    Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
        "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
    ).then(tp => {
        terrainProvider = tp; // Store for cleanup
        viewer.terrainProvider = terrainProvider;
    });

    enableMoonSunOnMap();
    Cesium.Math.setRandomNumberSeed(3);
    clock.shouldAnimate = false;
}

/**
 * Writes debug logs only when debug mode is enabled.
 * @param {string} message Log message.
 */
function log(message) {
    if (debug) {
        console.log(message);
    }
}

/**
 * Checks whether a model URI is reachable using a synchronous HTTP probe.
 * @param {string} uri Model resource URI.
 * @returns {boolean} True when the resource exists.
 */
function modelUriExists(uri) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('HEAD', uri, false);
        xhr.send(null);
        if (xhr.status >= 200 && xhr.status < 400) {
            return true;
        }
        if (xhr.status === 405 || xhr.status === 501) {
            const xhrGet = new XMLHttpRequest();
            xhrGet.open('GET', uri, false);
            xhrGet.send(null);
            return xhrGet.status >= 200 && xhrGet.status < 400;
        }
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Resolves the first existing model URI from a candidate model-type list.
 * @param {string[]} candidates Candidate model type IDs.
 * @returns {string} Existing model URI or default URI.
 */
function resolveExistingModelUri(candidates) {
    for (const modelType of candidates) {
        if (!modelType) {
            continue;
        }
        const candidateUri = modelPath + modelType + ".glb";
        if (modelUriExists(candidateUri)) {
            return candidateUri;
        }
    }
    return modelPath + modelDefault;
}

/**
 * Builds and caches the best GLB URI for an aircraft type.
 * @param {string} type ICAO aircraft type code.
 */
function createUriforModel(type) {
    const normalizedType = typeof type === 'string' ? type.trim().toUpperCase() : '';
    if (!normalizedType) {
        modelUri = modelPath + modelDefault;
        return;
    }

    if (MODEL_URI_CACHE[normalizedType]) {
        modelUri = MODEL_URI_CACHE[normalizedType];
        return;
    }

    const aliasType = MODEL_URI_ALIASES[normalizedType];
    const candidates = aliasType && aliasType !== normalizedType
        ? [normalizedType, aliasType]
        : [normalizedType];

    const resolvedUri = resolveExistingModelUri(candidates);
    MODEL_URI_CACHE[normalizedType] = resolvedUri;
    modelUri = resolvedUri;
}

/**
 * Loads optional model configuration (rotation/color) next to a GLB asset.
 * @param {string} uri Model URI.
 * @returns {Promise<Object|null>} Parsed config JSON or null when not found.
 */
async function loadModelConfig(uri) {
    if (!uri) {
        return null;
    }

    // Check cache first
    if (MODEL_CONFIG_CACHE[uri] !== undefined) {
        return MODEL_CONFIG_CACHE[uri];
    }

    // Try to load .cfg file
    const cfgUri = uri.replace(/\.glb$/i, '.cfg');
    try {
        const response = await fetch(cfgUri);
        if (response.ok) {
            const config = await response.json();
            MODEL_CONFIG_CACHE[uri] = config;
            log(`[Model Config] Loaded config for ${uri}: ${JSON.stringify(config)}`);
            return config;
        }
    } catch (error) {
        log(`[Model Config] No config found for ${uri}`);
    }

    // Cache miss/not found
    MODEL_CONFIG_CACHE[uri] = null;
    return null;
}

/**
 * Enables sun/moon visuals and lens flare effects in the scene.
 */
function enableMoonSunOnMap() {
    const sunLight = new Cesium.SunLight();
    scene.light = sunLight;
    scene.sun.glowFactor = 1.0;
    scene.sunBloom = true;
    scene.sun.show = true;
    scene.skyBox.show = true;
    scene.moon.show = true;
    scene.postProcessStages.add(
        Cesium.PostProcessStageLibrary.createLensFlareStage()
    );
}

/**
 * Estimates ground altitude at a position for aircraft on ground.
 * @param {number} longitude Longitude in degrees.
 * @param {number} latitude Latitude in degrees.
 * @returns {number} Ground altitude in meters.
 */
function getAltitudeWhenOnGround(longitude, latitude) {
    const defaultHeightInMeters = 1;
    if (!scene || !longitude || !latitude) return defaultHeightInMeters;

    const cartoPosition = Cesium.Cartographic.fromDegrees(longitude, latitude);
    let altitude = defaultHeightInMeters;

    if (google3dTileset) {
        altitude = getHeightFrom3dTilesetDirect(cartoPosition);
    } else {
        altitude = scene.globe.getHeight(cartoPosition);
    }

    return altitude !== undefined
        ? altitude > 0 ? altitude : defaultHeightInMeters
        : defaultHeightInMeters;
}

/**
 * Reads height from the active 3D tileset at a cartographic position.
 * @param {Cesium.Cartographic} cartographic Position to sample.
 * @returns {number|undefined} Height in meters when available.
 */
function getHeightFrom3dTilesetDirect(cartographic) {
    if (
        !Cesium.defined(cartographic) ||
        !viewer ||
        !google3dTileset ||
        !viewer.scene
    ) {
        return undefined;
    }
    return google3dTileset.getHeight(cartographic, viewer.scene);
}

/**
 * Creates a Cesium Cartesian position from geodetic coordinates.
 * @param {number} longitude Longitude in degrees.
 * @param {number} latitude Latitude in degrees.
 * @param {number} altitude Altitude in meters.
 * @returns {Cesium.Cartesian3|null} Position or null for invalid coordinates.
 */
function create3dPosition(longitude, latitude, altitude) {
    if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude)) {
        return null;
    }

    const safeAltitude = isFiniteNumber(altitude) ? Number(altitude) : 0;
    let pos = Cesium.Cartesian3.fromDegrees(Number(longitude), Number(latitude), safeAltitude);
    if (debug) {
        viewer.entities.add({
            position: pos,
            point: {
                pixelSize: 7,
                color: Cesium.Color.RED,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
            },
        });
    }
    return pos;
}

/**
 * Extracts normalized position and kinematic values for the watched aircraft.
 * @returns {{lat:number, lon:number, alt:number, speed:number, vspeed:number, heading:number, roll:number|null, seen:boolean}|undefined} Normalized telemetry payload.
 */
function getLatLonAltSpeed() {
    const headingDeg = isFiniteNumber(aircraft.true_heading)
        ? Number(aircraft.true_heading)
        : (isFiniteNumber(aircraft.track) ? Number(aircraft.track) : 0);
    const heading = Cesium.Math.toRadians(headingDeg + 90);
    const rollDeg = isFiniteNumber(aircraft.roll) ? Number(aircraft.roll) : null;
    if (!getAirplaneIsSeen()) {
        let seen = aircraft.lastPosition.seen_pos;
        return {
            lat: aircraft.lastPosition.lat,
            lon: aircraft.lastPosition.lon,
            alt: getAltitudeWhenOnGround(aircraft.lastPosition.lon, aircraft.lastPosition.lat),
            speed: 0,
            vspeed: 0,
            heading: heading,
            roll: rollDeg,
            seen: (seen < 60) ? true : false
        }
    }
    if (aircraft.lat && aircraft.lon && aircraft.lat != 0 && aircraft.lon != 0) {
        return {
            lat: aircraft.lat,
            lon: aircraft.lon,
            alt: getAltitude(),
            speed: aircraft.gs * 1.852,
            vspeed: aircraft.baro_rate ? aircraft.baro_rate * 0.00508 : 0,
            heading: heading,
            roll: rollDeg,
            seen: true
        }
    }
}

/**
 * Converts aircraft kinematics to a velocity vector compatible with Cesium samples.
 * @param {number} speed Ground speed in km/h.
 * @param {number} vspeed Vertical speed in m/s.
 * @param {number} heading Heading in radians.
 * @param {number|null} roll Roll in degrees.
 * @returns {Cesium.Cartesian4} Velocity/roll packed vector.
 */
function getVelocityVector(speed, vspeed, heading, roll) {
    const speedInMetersPerSecond = speed / 3.6;
    const velocityX = speedInMetersPerSecond * Math.cos(heading);
    const velocityY = speedInMetersPerSecond * Math.sin(heading);
    const velocityZ = vspeed;
    return new Cesium.Cartesian4(velocityX, velocityY, velocityZ, roll ? roll * -1 : 0);
}

/**
 * Determines whether the watched aircraft currently has valid/recent position data.
 * @returns {boolean} True when aircraft is considered seen.
 */
function getAirplaneIsSeen() {
    if (!aircraft) {
        return false;
    }
    if (aircraft.lat && aircraft.lon && aircraft.lat !== 0 && aircraft.lon !== 0) {
        return true;
    }
    if (Number.isFinite(aircraft.seen_pos)) {
        return aircraft.seen_pos < 60;
    }
    if (aircraft.lastPosition && Number.isFinite(aircraft.lastPosition.seen_pos)) {
        return aircraft.lastPosition.seen_pos < 60;
    }
    return false;
}

/**
 * Computes whether the watched aircraft should be treated as on-ground.
 * @returns {boolean} True when altitude indicates ground state.
 */
function getOngroundStatus() {
    var alt = aircraft.alt_baro;
    if (alt == "ground" || alt <= 20 * 3.281 || alt < 0) {
        return true;
    }
    return false;
}

/**
 * Returns aircraft altitude in meters, including terrain fallback when needed.
 * @returns {number} Altitude in meters.
 */
function getAltitude() {
    let alt = aircraft.alt_baro;
    if (alt == "ground") {
        alt = getAltitudeWhenOnGround(aircraft.lon, aircraft.lat);
        return alt;
    }
    let altInMeters = alt / 3.281;
    if (altInMeters < 0) {
        altInMeters = getAltitudeWhenOnGround(aircraft.lon, aircraft.lat);
    }
    if (altInMeters < 0) {
        altInMeters = 0;
    }
    return altInMeters;
}

/**
 * Computes pitch angle from ground speed and barometric climb/descent rate.
 * @param {number} gs_knots Ground speed in knots.
 * @param {number} baro_rate_fpm Vertical rate in feet per minute.
 * @returns {number} Smoothed pitch angle in degrees.
 */
function getPitch(gs_knots, baro_rate_fpm) {
    if (aircraft && aircraft.alt_baro == "ground") {
        lastPitchDeg = 0;
        return 0.0;
    }

    const gs = Number(gs_knots);
    const baroRate = Number(baro_rate_fpm);
    if (!Number.isFinite(gs) || !Number.isFinite(baroRate)) {
        return lastPitchDeg;
    }
    if (gs <= MIN_GS_KNOTS_FOR_PITCH) {
        lastPitchDeg = 0;
        return 0.0;
    }

    const deadbandedBaroRate = Math.abs(baroRate) < BARO_RATE_DEADBAND_FPM ? 0 : baroRate;
    const safeBaroRate = clampNumber(
        deadbandedBaroRate,
        -MAX_ABS_BARO_RATE_FPM,
        MAX_ABS_BARO_RATE_FPM
    );
    const gsFpm = gs * GS_KNOT_TO_FPM;
    if (!Number.isFinite(gsFpm) || gsFpm <= 0) {
        return 0.0;
    }
    const rawPitchDeg = -Cesium.Math.toDegrees(Math.atan2(safeBaroRate, gsFpm));
    if (!Number.isFinite(rawPitchDeg)) {
        return lastPitchDeg;
    }
    const clampedPitchDeg = clampNumber(rawPitchDeg, -MAX_ABS_PITCH_DEG, MAX_ABS_PITCH_DEG);
    const stepLimitedPitchDeg = clampNumber(
        clampedPitchDeg,
        lastPitchDeg - MAX_PITCH_STEP_DEG,
        lastPitchDeg + MAX_PITCH_STEP_DEG
    );
    lastPitchDeg = stepLimitedPitchDeg;
    return stepLimitedPitchDeg;
}

/**
 * Builds aircraft orientation quaternion from heading, pitch, and roll.
 * @param {Cesium.Cartesian3} lastPosition Cartesian position used as orientation origin.
 * @param {Object} plane Aircraft telemetry payload.
 * @param {number|null} rollDegOverride Optional roll override in degrees.
 * @returns {Cesium.ConstantProperty} Orientation property wrapper.
 */
function getOrientation(lastPosition, plane, rollDegOverride) {
    const headingDeg = isFiniteNumber(plane.true_heading)
        ? Number(plane.true_heading)
        : (isFiniteNumber(plane.track) ? Number(plane.track) : 0);
    const lastTrack = headingDeg + 90 + MODEL_HEADING_OFFSET_DEG + modelRotationOffsetDeg;
    const sourceRollDeg = resolveRollDeg(plane, rollDegOverride, headingDeg);
    const lastRoll = clampNumber(-sourceRollDeg, -MAX_ABS_ROLL_DEG, MAX_ABS_ROLL_DEG);
    const lastHeadingRad = Cesium.Math.toRadians(lastTrack);
    const lastPitchRad = Cesium.Math.toRadians(getPitch(plane.gs, plane.baro_rate));
    const lastRollRad = Cesium.Math.toRadians(lastRoll);
    const hpr = new Cesium.HeadingPitchRoll(
        lastHeadingRad,
        lastPitchRad,
        lastRollRad
    );
    const lastOrientation = Cesium.Transforms.headingPitchRollQuaternion(
        lastPosition,
        hpr
    );
    return new Cesium.ConstantProperty(lastOrientation);
}

/**
 * Resolves roll angle using telemetry roll when present or turn-rate estimation fallback.
 * @param {Object} plane Aircraft telemetry payload.
 * @param {number|null} rollDegOverride Optional telemetry roll override.
 * @param {number} headingDeg Heading in degrees.
 * @returns {number} Roll angle in degrees.
 */
function resolveRollDeg(plane, rollDegOverride, headingDeg) {
    const telemetryRollDeg = isFiniteNumber(rollDegOverride)
        ? Number(rollDegOverride)
        : (isFiniteNumber(plane.roll) ? Number(plane.roll) : NaN);
    if (Number.isFinite(telemetryRollDeg) && Math.abs(telemetryRollDeg) >= MIN_ABS_TELEMETRY_ROLL_DEG) {
        lastRollEstimateDeg = telemetryRollDeg;
        return telemetryRollDeg;
    }
    const gsKnots = Number(plane.gs);
    const timestampMs = sourceNowToTimestampMs(plane && plane.now, Date.now());
    if (!Number.isFinite(gsKnots) || gsKnots < MIN_GS_KNOTS_FOR_ROLL_ESTIMATE || !Number.isFinite(headingDeg)) {
        lastRollEstimateDeg = 0;
        lastRollHeadingDeg = headingDeg;
        lastRollTimestampMs = timestampMs;
        return 0;
    }
    if (!Number.isFinite(lastRollHeadingDeg) || !Number.isFinite(lastRollTimestampMs)) {
        lastRollHeadingDeg = headingDeg;
        lastRollTimestampMs = timestampMs;
        return lastRollEstimateDeg;
    }
    const dtSec = (timestampMs - lastRollTimestampMs) / 1000;
    if (!Number.isFinite(dtSec) || dtSec <= 0) {
        return lastRollEstimateDeg;
    }
    let deltaHeadingDeg = headingDeg - lastRollHeadingDeg;
    if (deltaHeadingDeg > 180) {
        deltaHeadingDeg -= 360;
    } else if (deltaHeadingDeg < -180) {
        deltaHeadingDeg += 360;
    }
    const turnRateRadPerSec = Cesium.Math.toRadians(deltaHeadingDeg) / dtSec;
    const speedMs = gsKnots * 0.514444;
    const g = 9.80665;
    const estimatedRollDeg = Cesium.Math.toDegrees(Math.atan2(speedMs * turnRateRadPerSec, g));
    lastRollHeadingDeg = headingDeg;
    lastRollTimestampMs = timestampMs;
    lastRollEstimateDeg = clampNumber(estimatedRollDeg, -MAX_ABS_ROLL_DEG, MAX_ABS_ROLL_DEG);
    return lastRollEstimateDeg;
}

/**
 * Creates and configures the tracked aircraft entity/model in the scene.
 * @returns {Promise<void>} Resolves after entity/model configuration is complete.
 */
async function loadModel() {
    aircraftEntity = viewer.entities.add({
        id: callsign,
        position: pointEntity,
        orientation: orientationEntity,
        availability: new Cesium.TimeIntervalCollection([
            new Cesium.TimeInterval({
                start: start,
                stop: stop,
            }),
        ]),
        label: {
            text: aircraft.flight,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            font: '12px Helvetica',
            fillColor: Cesium.Color.WHITE,
            outlineWidth: 0,
            style: Cesium.LabelStyle.FILL,
            scale: 2,
            pixelOffset: new Cesium.Cartesian2(10, -10),
            showBackground: true,
            backgroundColor: new Cesium.Color(0.2, 0.2, 0.2, 0.4),
            disableDepthTestDistance: 0,
            scaleByDistance: undefined,
            backgroundPadding: new Cesium.Cartesian2(5, 0),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
                2000,
                Infinity
            )
        },
        path: {
            show: debug,
            trailTime: 120, // Seconds before current time to show
            leadTime: 0,   // Seconds after current time to show
            width: 10,
            resolution: 1,
            material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.3,
                taperPower: 0.3,
                color: Cesium.Color.AQUAMARINE,
            }),
        },
        trackingReferenceFrame: Cesium.TrackingReferenceFrame.INERTIAL,
        model: {
            uri: modelUri,
            minimumPixelSize: 32,
            scale: 1,
            runAnimations: false,
        },
        viewFrom: new Cesium.Cartesian3(75, -20, 20),  // E, N, U
    });

    // Load and apply model configuration (rotation, color, etc.)
    const modelConfig = await loadModelConfig(modelUri);
    if (modelConfig) {
        // Store rotation offset (in degrees) to apply to orientation
        if (typeof modelConfig.rotate === 'number') {
            modelRotationOffsetDeg = modelConfig.rotate;
            log(`[Model] Model rotation offset set to ${modelRotationOffsetDeg}°`);
        }

        // Apply body color if specified
        if (typeof modelConfig.bodyColor === 'string') {
            try {
                const color = Cesium.Color.fromCssColorString(modelConfig.bodyColor);
                aircraftEntity.model.color = color;
                log(`[Model] Applied color ${modelConfig.bodyColor} to ${modelUri}`);
            } catch (error) {
                log(`[Model] Invalid color format: ${modelConfig.bodyColor}`);
            }
        }
    }
    viewer.trackedEntity = aircraftEntity;
}

/**
 * Initializes watched-aircraft state and first samples from incoming plane data.
 * @param {Object} plane Watched aircraft telemetry payload.
 * @returns {Promise<void>} Resolves after first entity/model initialization path completes.
 */
async function processWatchedAircraft(plane) {
    aircraft = plane;
    const sampleTimestampMs = getPlaneSampleTimestampMs(plane, lastWatchedSampleTimestampMs);
    aircraft.isotime = julianFromTimestampMs(sampleTimestampMs);
    const flightText = typeof plane.flight === 'string' ? plane.flight.trim() : '';
    const hexText = typeof plane.hex === 'string' ? plane.hex.trim() : '';
    aircraft.flight = flightText || hexText || 'unknown';
    onGround = getOngroundStatus();
    if (start == undefined) {
        start = julianFromTimestampMs(sampleTimestampMs);
        clock.currentTime = start;
        window.tar1090LatestWatchedSampleTimeMs = sampleTimestampMs;
        lastWatchedSampleTimestampMs = sampleTimestampMs;
        log("Start time set: " + Cesium.JulianDate.toDate(start).toUTCString());
        let coords = getLatLonAltSpeed();
        if (!hasValidPosition(coords)) {
            log("Invalid initial watched-aircraft coordinates, skipping sample init.");
            return;
        }
        if (!isFiniteNumber(coords.alt)) {
            coords.alt = 0;
        }
        if (!isFiniteNumber(coords.speed)) {
            coords.speed = 0;
        }
        if (!isFiniteNumber(coords.vspeed)) {
            coords.vspeed = 0;
        }
        if (!isFiniteNumber(coords.heading)) {
            coords.heading = 0;
        }
        lastCoords = coords;
        position = create3dPosition(coords.lon, coords.lat, coords.alt, onGround);
        if (!position) {
            log("Invalid initial watched-aircraft position, skipping sample init.");
            return;
        }
        pointEntity.addSample(start, position, [getVelocityVector(coords.speed, coords.vspeed, coords.heading, coords.roll)]);
        orientationEntity.addSample(start, getOrientation(position, plane, coords.roll).getValue(start));
        // Initialize smoothing states
        lastRollSampleDeg = coords.roll || 0;
        lastPitchSampleDeg = getPitch(plane.gs, plane.baro_rate);
        let stopTime = Cesium.JulianDate.toDate(start);
        stopTime.setFullYear(stopTime.getFullYear() + 1);
        stop = Cesium.JulianDate.fromDate(stopTime);
        log("Stop time set: " + Cesium.JulianDate.toDate(stop).toUTCString());
        createUriforModel(plane.t);
        await loadModel();
        if (!coords.seen) {
            stopPlayback();
            messageBox("Plane is on the ground and is not being tracked anymore. You can close this window.");
        }
    }
}

/**
 * Computes great-circle distance between two WGS84 points.
 * @param {number} lat1 First latitude in degrees.
 * @param {number} lon1 First longitude in degrees.
 * @param {number} lat2 Second latitude in degrees.
 * @param {number} lon2 Second longitude in degrees.
 * @returns {number} Distance in kilometers.
 */
function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Returns the best available reference position for the watched aircraft.
 * @returns {{lat:number, lon:number}|null} Current or last known watched-aircraft position.
 */
function getWatchedReferencePosition() {
    if (aircraft && aircraft.lat && aircraft.lon) {
        return { lat: aircraft.lat, lon: aircraft.lon };
    }
    if (aircraft && aircraft.lastPosition && aircraft.lastPosition.lat && aircraft.lastPosition.lon) {
        return { lat: aircraft.lastPosition.lat, lon: aircraft.lastPosition.lon };
    }
    return null;
}

/**
 * Adds or updates nearby non-watched aircraft entities relative to watched reference position.
 * @param {Object} plane Non-watched aircraft telemetry payload.
 * @param {{lat:number, lon:number}|null} watchedRef Optional watched-aircraft reference coordinates.
 */
function processOtherAircraft(plane, watchedRef) {
    if (!plane || !plane.hex || !plane.lat || !plane.lon || debug) {
        return;
    }

    const maxDistanceKm = 100;
    const ref = watchedRef || getWatchedReferencePosition();
    if (!ref) {
        return;
    }

    const dist = distanceKm(ref.lat, ref.lon, plane.lat, plane.lon);
    if (dist > maxDistanceKm) {
        if (otherPlanes[plane.hex]) {
            viewer.entities.removeById(plane.hex);
            delete otherPlanes[plane.hex];
        }
        return;
    }

    if (plane.alt_baro == "ground" || plane.alt_baro <= 20 * 3.281 || plane.alt_baro < 0) {
        if (otherPlanes[plane.hex]) {
            viewer.entities.removeById(plane.hex);
            delete otherPlanes[plane.hex];
        }
        return;
    }

    if (plane.lastPosition && plane.lastPosition.seen_pos > 30) {
        viewer.entities.removeById(plane.hex);
        delete otherPlanes[plane.hex];
        return;
    }

    const altitudeFeet = Number(plane.alt_baro);
    if (!Number.isFinite(altitudeFeet)) {
        return;
    }
    const altitudeMeters = altitudeFeet / 3.281;
    const pos = create3dPosition(plane.lon, plane.lat, altitudeMeters);
    if (!pos) {
        return;
    }

    if (!otherPlanes[plane.hex]) {
        const sampleTimestampMs = getPlaneSampleTimestampMs(plane, 0);
        const sampleTime = julianFromTimestampMs(sampleTimestampMs);
        otherPlanes[plane.hex] = {
            ...plane,
            pointEntity: new Cesium.SampledPositionProperty(),
            entity: null,
            lastSampleTimestampMs: sampleTimestampMs,
        };

        const labelText = plane.flight ? plane.flight.trim() : plane.hex.trim();
        otherPlanes[plane.hex].pointEntity.addSample(sampleTime, pos);
        otherPlanes[plane.hex].pointEntity.forwardExtrapolationType = Cesium.ExtrapolationType.EXTRAPOLATE;
        otherPlanes[plane.hex].pointEntity.forwardExtrapolationDuration = 12;
        otherPlanes[plane.hex].pointEntity.setInterpolationOptions({
            interpolationDegree: 5,
            interpolationAlgorithm: Cesium.LinearApproximation,
        });

        otherPlanes[plane.hex].entity = viewer.entities.add({
            id: plane.hex,
            position: otherPlanes[plane.hex].pointEntity,
            point: {
                pixelSize: 5,
                color: Cesium.Color.DEEPSKYBLUE,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 1,
                disableDepthTestDistance: 0,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, Infinity)
            },
            label: {
                text: labelText + "\n" + altitudeMeters.toFixed(0) + " m",
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                fillColor: Cesium.Color.WHITE,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                font: '12px Helvetica',
                pixelOffset: new Cesium.Cartesian2(10, -10),
                showBackground: true,
                backgroundColor: new Cesium.Color(0.2, 0.2, 0.2, 0.4),
                disableDepthTestDistance: 0,
                scaleByDistance: undefined,
                backgroundPadding: new Cesium.Cartesian2(3, 0),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(500, Infinity)
            },
            path: {
                show: true,
                trailTime: 120,
                leadTime: 0,
                width: 10,
                resolution: 1,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.3,
                    taperPower: 0.3,
                    color: Cesium.Color.BLUE,
                }),
            }
        });
    } else {
        const sampleTimestampMs = getPlaneSampleTimestampMs(
            plane,
            otherPlanes[plane.hex].lastSampleTimestampMs || 0
        );
        const sampleTime = julianFromTimestampMs(sampleTimestampMs);
        otherPlanes[plane.hex].lastSampleTimestampMs = sampleTimestampMs;
        otherPlanes[plane.hex].pointEntity.addSample(sampleTime, pos);
        if (otherPlanes[plane.hex].entity && otherPlanes[plane.hex].entity.label) {
            const labelText = plane.flight ? plane.flight.trim() : plane.hex.trim();
            otherPlanes[plane.hex].entity.label.text = labelText + "\n" + altitudeMeters.toFixed(0) + " m";
        }
    }
}

/**
 * Starts Cesium clock playback if not already animating.
 */
function startPlayback() {
    if (isAnimating) return;
    isAnimating = true;
    clock.shouldAnimate = true;
    clock.multiplier = 1.0;
    if (overlay) overlay.style.display = 'none';
}

/**
 * Stops Cesium clock playback and freezes simulation time.
 */
function stopPlayback() {
    if (!isAnimating) return;
    isAnimating = false;
    clock.shouldAnimate = false;
    clock.multiplier = 0.0;
}

/**
 * Inserts intermediate arc samples between two fixes for smoother curved turns.
 * @param {{lat:number, lon:number, alt:number, speed:number, vspeed:number, heading:number, roll:number|null}} prevCoords Previous sample payload.
 * @param {number} prevTimeMs Previous sample timestamp in milliseconds.
 * @param {{lat:number, lon:number, alt:number, speed:number, vspeed:number, heading:number, roll:number|null}} coords Current sample payload.
 * @param {number} sampleTimeMs Current sample timestamp in milliseconds.
 */
function addArcSamplesIfNeeded(prevCoords, prevTimeMs, coords, sampleTimeMs) {
    const dtMs = sampleTimeMs - prevTimeMs;
    if (dtMs <= 0) return;

    // Insert one intermediate sample roughly every ARC_TARGET_INTERVAL_SEC.
    const targetIntervalMs = ARC_TARGET_INTERVAL_SEC * 1000;
    const N = Math.min(
        MAX_ARC_INTERMEDIATE_SAMPLES,
        Math.max(0, Math.floor(dtMs / targetIntervalMs) - 1)
    );
    if (N < 1) return;

    // Aircraft heading in degrees (0 = North, CW positive)
    const h1Deg = Cesium.Math.toDegrees(prevCoords.heading) - 90;
    const h2Deg = Cesium.Math.toDegrees(coords.heading) - 90;

    // Signed shortest heading delta
    let dhDeg = h2Deg - h1Deg;
    while (dhDeg > 180) dhDeg -= 360;
    while (dhDeg < -180) dhDeg += 360;

    // Convert initial aircraft heading to standard math angle (from East axis, CCW positive)
    const phi1 = Cesium.Math.toRadians(90 - h1Deg);
    // Math-angle change is the negative of the heading change (CW heading = CCW in math)
    const dphiRad = Cesium.Math.toRadians(-dhDeg);

    // Chord vector in local flat-Earth ENU (metres)
    const cosLat = Math.cos(prevCoords.lat * Math.PI / 180);
    if (Math.abs(cosLat) < 1e-6) return;
    const R_earth = 6371000;
    const chordEast = (coords.lon - prevCoords.lon) * Math.PI / 180 * R_earth * cosLat;
    const chordNorth = (coords.lat - prevCoords.lat) * Math.PI / 180 * R_earth;
    const chordLen = Math.sqrt(chordEast * chordEast + chordNorth * chordNorth);
    if (chordLen < 10) return;

    // Use circular-arc geometry when the heading change is meaningful;
    // otherwise fall back to linear interpolation between fixes.
    const sinHalfDphi = Math.sin(dphiRad / 2);
    const useArcGeometry = Math.abs(sinHalfDphi) >= 0.001;
    let turnR = 0;
    if (useArcGeometry) {
        // Turn radius from chord geometry: chord = 2R |sin(Δφ/2)|
        turnR = chordLen / (2 * Math.abs(sinHalfDphi));
    }

    // Pre-compute rotation correction so the arc endpoint matches the actual chord direction.
    // Arc endpoint (ENU) before correction:
    const signDphi = dphiRad >= 0 ? 1 : -1;
    let cosCorrAngle = 1;
    let sinCorrAngle = 0;
    if (useArcGeometry) {
        const arcEndEast = turnR * signDphi * (Math.sin(phi1 + dphiRad) - Math.sin(phi1));
        const arcEndNorth = turnR * signDphi * (Math.cos(phi1) - Math.cos(phi1 + dphiRad));
        const arcEndAngle = Math.atan2(arcEndNorth, arcEndEast);  // atan2(y,x) standard
        const chordAngle = Math.atan2(chordNorth, chordEast);
        const corrAngle = chordAngle - arcEndAngle;
        cosCorrAngle = Math.cos(corrAngle);
        sinCorrAngle = Math.sin(corrAngle);
    }

    const prevHasTelemetryRoll = isFiniteNumber(prevCoords.roll);
    const currHasTelemetryRoll = isFiniteNumber(coords.roll);

    for (let i = 1; i <= N; i++) {
        const frac = i / (N + 1);
        const t = frac * dtMs / 1000;            // seconds from prevCoords

        // Arc ENU offsets at this fraction of the turn.
        // For near-straight segments, use linear interpolation.
        let east;
        let north;
        if (useArcGeometry) {
            const phiAtF = phi1 + dphiRad * frac;
            const rawEast = turnR * signDphi * (Math.sin(phiAtF) - Math.sin(phi1));
            const rawNorth = turnR * signDphi * (Math.cos(phi1) - Math.cos(phiAtF));

            // Apply rotation correction (2-D rotation in ENU plane)
            east = rawEast * cosCorrAngle - rawNorth * sinCorrAngle;
            north = rawEast * sinCorrAngle + rawNorth * cosCorrAngle;
        } else {
            east = chordEast * frac;
            north = chordNorth * frac;
        }

        const lat = prevCoords.lat + (north / R_earth) * (180 / Math.PI);
        const lon = prevCoords.lon + (east / (R_earth * cosLat)) * (180 / Math.PI);
        // Interpolate speed and vspeed at this fraction for realistic pitch and velocity.
        const speedKphAtF = prevCoords.speed + (coords.speed - prevCoords.speed) * frac;
        const vspeedMsAtF = prevCoords.vspeed + (coords.vspeed - prevCoords.vspeed) * frac;
        const speedKnotsAtF = speedKphAtF / 1.852;
        const baroRateFpmAtF = vspeedMsAtF / 0.00508;
        // Linearly interpolate altitude between the two fixes (clamped ≥ 0).
        const alt = Math.max(0, prevCoords.alt + (coords.alt - prevCoords.alt) * frac);

        // Heading at this fraction (Cesium convention: degrees + 90, converted to radians)
        const headingAtF = Cesium.Math.toRadians(h1Deg + dhDeg * frac + 90 + MODEL_HEADING_OFFSET_DEG);
        const headingDegAtF = h1Deg + dhDeg * frac;

        // Prefer telemetry roll in arc samples when available; otherwise estimate bank from turn rate.
        let telemetryRollDeg = null;
        if (prevHasTelemetryRoll && currHasTelemetryRoll) {
            telemetryRollDeg = prevCoords.roll + (coords.roll - prevCoords.roll) * frac;
        } else if (currHasTelemetryRoll) {
            telemetryRollDeg = coords.roll;
        } else if (prevHasTelemetryRoll) {
            telemetryRollDeg = prevCoords.roll;
        }

        // Estimate roll at this fraction using resolveRollDeg fallback when telemetry is unavailable.
        const planeAtF = {
            gs: speedKnotsAtF,
            roll: telemetryRollDeg,
            true_heading: headingDegAtF,
            now: prevTimeMs + dtMs * frac / 1000
        };
        const computedRollDeg = resolveRollDeg(planeAtF, telemetryRollDeg, headingDegAtF);
        // Apply step-limiting to smooth roll transitions across arc samples
        let rollDegAtF = clampNumber(
            computedRollDeg,
            lastRollSampleDeg - MAX_ROLL_STEP_DEG,
            lastRollSampleDeg + MAX_ROLL_STEP_DEG
        );
        // If telemetry roll is valid, don't allow estimated roll to exceed it
        if (Number.isFinite(telemetryRollDeg) && Math.abs(telemetryRollDeg) > 0) {
            const maxRollFromTelemetry = Math.abs(telemetryRollDeg);
            rollDegAtF = clampNumber(rollDegAtF, -maxRollFromTelemetry, maxRollFromTelemetry);
        }
        lastRollSampleDeg = rollDegAtF;

        const sampleTime = julianFromTimestampMs(prevTimeMs + dtMs * frac);
        const pos = create3dPosition(lon, lat, alt, false);
        if (!pos) continue;
        pointEntity.addSample(sampleTime, pos, [
            getVelocityVector(speedKphAtF, vspeedMsAtF, headingAtF, rollDegAtF)
        ]);
        // Compute pitch from interpolated speed and baro-rate at this fraction.
        // Uses the same formula as getPitch() but without touching lastPitchDeg.
        let pitchAtF = 0;
        if (speedKnotsAtF > MIN_GS_KNOTS_FOR_PITCH) {
            const gsFpmAtF = speedKnotsAtF * GS_KNOT_TO_FPM;
            const deadbandedBaroRate = Math.abs(baroRateFpmAtF) < BARO_RATE_DEADBAND_FPM ? 0 : baroRateFpmAtF;
            const clampedBaroRate = clampNumber(deadbandedBaroRate, -MAX_ABS_BARO_RATE_FPM, MAX_ABS_BARO_RATE_FPM);
            if (Number.isFinite(gsFpmAtF) && gsFpmAtF > 0) {
                const rawPitch = -Cesium.Math.toDegrees(Math.atan2(clampedBaroRate, gsFpmAtF));
                if (Number.isFinite(rawPitch)) {
                    pitchAtF = clampNumber(rawPitch, -MAX_ABS_PITCH_DEG, MAX_ABS_PITCH_DEG);
                }
            }
        }
        // Apply step-limiting to smooth pitch transitions across arc samples
        const pitchAtFSmoothed = clampNumber(
            pitchAtF,
            lastPitchSampleDeg - MAX_PITCH_STEP_DEG,
            lastPitchSampleDeg + MAX_PITCH_STEP_DEG
        );
        lastPitchSampleDeg = pitchAtFSmoothed;
        const rollAtF = clampNumber(-rollDegAtF, -MAX_ABS_ROLL_DEG, MAX_ABS_ROLL_DEG);
        const headingAtFWithOffset = headingAtF + Cesium.Math.toRadians(modelRotationOffsetDeg);
        const hprAtF = new Cesium.HeadingPitchRoll(
            headingAtFWithOffset,
            Cesium.Math.toRadians(pitchAtFSmoothed),
            Cesium.Math.toRadians(rollAtF)
        );
        const orientationAtF = Cesium.Transforms.headingPitchRollQuaternion(pos, hprAtF);
        orientationEntity.addSample(sampleTime, orientationAtF);
        log(`Added arc sample at t+${t.toFixed(1)}s: lat=${lat.toFixed(5)}, lon=${lon.toFixed(5)}, alt=${alt.toFixed(1)}, heading=${headingDegAtF.toFixed(1)}, roll=${rollDegAtF.toFixed(1)}, pitch=${pitchAtFSmoothed.toFixed(1)}`);
    }
}

/**
 * Applies the latest watched-aircraft telemetry sample to Cesium sampled properties.
 */
function update3dView() {
    var coords = getLatLonAltSpeed();
    if (!hasValidPosition(coords)) {
        log("Invalid watched-aircraft coordinates, skipping sample update.");
        return;
    }
    if (!isFiniteNumber(coords.alt)) {
        coords.alt = 0;
    }
    if (!isFiniteNumber(coords.speed)) {
        coords.speed = 0;
    }
    if (!isFiniteNumber(coords.vspeed)) {
        coords.vspeed = 0;
    }
    if (!isFiniteNumber(coords.heading)) {
        coords.heading = 0;
    }
    if (lastCoords && coords && lastCoords.lat === coords.lat && lastCoords.lon === coords.lon && lastCoords.alt === coords.alt) {
        // log("Same coordinates as last update, skipping...");
        return;
    }
    const prevCoords = lastCoords;
    const prevTimestampMs = lastWatchedSampleTimestampMs;
    lastCoords = coords;
    if (coords.seen) {
        lastWatchedDataReceivedTimeMs = Date.now(); // Update data received time when valid data arrives
        clearMessageBox(); // Clear any "No consistent data" message
        const sampleTimestampMs = getPlaneSampleTimestampMs(aircraft, lastWatchedSampleTimestampMs);
        const sampleTime = julianFromTimestampMs(sampleTimestampMs);
        window.tar1090LatestWatchedSampleTimeMs = sampleTimestampMs;
        lastWatchedSampleTimestampMs = sampleTimestampMs;
        // log("Adding sample: " + Cesium.JulianDate.toDate(sampleTime).toUTCString() + " - " + coords.lat + ", " + coords.lon + ", " + Math.max(coords.alt, 0));
        position = create3dPosition(coords.lon, coords.lat, coords.alt, onGround);
        if (!position) {
            log("Invalid watched-aircraft position, skipping sample update.");
            return;
        }
        if (prevCoords && prevTimestampMs > 0) {
            addArcSamplesIfNeeded(prevCoords, prevTimestampMs, coords, sampleTimestampMs);
        }
        pointEntity.addSample(sampleTime, position, [getVelocityVector(coords.speed, coords.vspeed, coords.heading, coords.roll)]);
        orientationEntity.addSample(sampleTime, getOrientation(position, aircraft, coords.roll).getValue(sampleTime));
        // Reset roll and pitch smoothing state for next arc sequence
        lastRollSampleDeg = resolveRollDeg(aircraft, coords.roll, isFiniteNumber(aircraft.true_heading) ? Number(aircraft.true_heading) : (isFiniteNumber(aircraft.track) ? Number(aircraft.track) : 0));
        lastPitchSampleDeg = getPitch(aircraft.gs, aircraft.baro_rate);
        if (isAnimating)
            flightMessage();
    }
}

/**
 * Processes buffered payload frames and updates watched/other aircraft entities.
 * @returns {Promise<void>} Resolves after one buffered frame is processed.
 */
async function getAirplaneData() {
    try {
        let planeData = posBuffer.shift();
        if (!planeData) {
            log("No plane data in buffer.");
            return;
        }

        // First pass: update watched aircraft so we always use current watched lat/lon.
        const watchedHex = typeof callsign === 'string' ? callsign.trim().toLowerCase() : '';
        for (let i = 0; i <= planeData.resultCount - 1; i++) {
            let plane = planeData.aircraft[i];
            plane.now = planeData.now;
            const planeHex = typeof plane.hex === 'string' ? plane.hex.trim().toLowerCase() : '';
            if (planeHex && watchedHex && planeHex === watchedHex) {
                await processWatchedAircraft(plane);
            }
        }

        // Reference point for 100 km filtering: current watched aircraft position.
        const watchedRef = (aircraft && aircraft.lat && aircraft.lon)
            ? { lat: aircraft.lat, lon: aircraft.lon }
            : (aircraft && aircraft.lastPosition && aircraft.lastPosition.lat && aircraft.lastPosition.lon)
                ? { lat: aircraft.lastPosition.lat, lon: aircraft.lastPosition.lon }
                : null;

        // Second pass: process other aircraft using current watched aircraft coordinates.
        for (let i = 0; i <= planeData.resultCount - 1; i++) {
            let plane = planeData.aircraft[i];
            plane.now = planeData.now;
            const planeHex = typeof plane.hex === 'string' ? plane.hex.trim().toLowerCase() : '';
            if (!watchedHex || planeHex !== watchedHex) {
                processOtherAircraft(plane, watchedRef);
            }
        }
        update3dView();
        startPlayback();
    }
    catch (e) {
        log("Error processing airplane data: " + e);
    }
}

/**
 * Entry point for incoming message payloads; routes to variable-interval or legacy processing.
 * @param {string} data Serialized aircraft payload.
 */
function postData(data) {
    if (typeof postDataVariableInterval !== 'undefined') {
        postDataVariableInterval(data);
    } else {
        // fallback to old method
        let planeData = JSON.parse(data);
        callsign = (planeData.callsign || '').toString().trim().toLowerCase();
        posBuffer.push(planeData);
        getAirplaneData();
    }
}

/**
 * Starts periodic monitoring for watched-aircraft data timeout notifications.
 */
function startWatchedAircraftDataTimeoutMonitor() {
    if (watchedAircraftDataTimeoutIntervalId !== null) {
        return; // Already running
    }
    watchedAircraftDataTimeoutIntervalId = setInterval(() => {
        const timeSinceLastDataMs = Date.now() - lastWatchedDataReceivedTimeMs;
        if (timeSinceLastDataMs > 10000) { // More than 10 seconds
            messageBox("No consistent data is received", { persistent: true });
        }
    }, 1000); // Check every second
}

/**
 * Stops periodic watched-aircraft data-timeout monitoring.
 */
function stopWatchedAircraftDataTimeoutMonitor() {
    if (watchedAircraftDataTimeoutIntervalId !== null) {
        clearInterval(watchedAircraftDataTimeoutIntervalId);
        watchedAircraftDataTimeoutIntervalId = null;
    }
}

// Main *************************************

/**
 * Registers the window message listener used to ingest live aircraft data.
 */
function addMainListener() {
    mainMessageListener = (event) => {
        if (event.data && typeof event.data === 'object' && event.data.type === 'tar1090-3d-close') {
            cleanup3DScene();
            return;
        }

        if (event.data && typeof event.data === 'object' && event.data.type === 'tar1090-3d-resize') {
            forceViewerResize();
            requestAnimationFrame(forceViewerResize);
            return;
        }

        if (event.origin !== "http://planes.ami") {
            log("Received message from unauthorized origin: " + event.origin);
            return;
        }
        // console.log('Received:', event.data);
        postData(event.data);
    };
    window.addEventListener('message', mainMessageListener);
    startWatchedAircraftDataTimeoutMonitor();
}

/**
 * Releases Cesium resources, listeners, caches, and playback state for clean shutdown.
 */
function cleanup3DScene() {
    try {
        stopPlayback();

        if (window.__infoBoxHideTimer) {
            clearTimeout(window.__infoBoxHideTimer);
            window.__infoBoxHideTimer = null;
        }

        if (typeof stopVariableIntervalMonitoring === 'function') {
            stopVariableIntervalMonitoring();
        }

        stopWatchedAircraftDataTimeoutMonitor();

        if (mainMessageListener) {
            window.removeEventListener('message', mainMessageListener);
            mainMessageListener = null;
        }

        // Remove event listeners
        if (renderErrorHandler) {
            viewer.scene.renderError.removeEventListener(renderErrorHandler);
            renderErrorHandler = null;
        }
        window.removeEventListener('resize', forceViewerResize);
        window.removeEventListener('beforeunload', cleanup3DScene);
        window.removeEventListener('pagehide', cleanup3DScene);

        // Remove post-process stages (e.g., lens flare)
        if (viewer && viewer.scene && viewer.scene.postProcessStages) {
            while (viewer.scene.postProcessStages.length > 0) {
                viewer.scene.postProcessStages.remove(viewer.scene.postProcessStages.get(0));
            }
        }

        // Explicitly clear otherPlanes references before deleting
        for (const hex in otherPlanes) {
            if (otherPlanes[hex]) {
                if (otherPlanes[hex].pointEntity) {
                    otherPlanes[hex].pointEntity = null;
                }
                if (otherPlanes[hex].entity) {
                    otherPlanes[hex].entity = null;
                }
            }
        }

        // Clear sampled properties
        if (pointEntity) {
            pointEntity = null;
        }
        if (orientationEntity) {
            orientationEntity = null;
        }

        if (viewer && !viewer.isDestroyed()) {
            viewer.entities.removeAll();
            viewer.trackedEntity = undefined;
            viewer.destroy();
        }
    } catch (e) {
        log('Cleanup error: ' + e);
    }

    // Clear global caches after viewer is destroyed
    for (const key in MODEL_URI_CACHE) {
        delete MODEL_URI_CACHE[key];
    }
    for (const key in MODEL_CONFIG_CACHE) {
        delete MODEL_CONFIG_CACHE[key];
    }

    viewer = undefined;
    scene = undefined;
    camera = undefined;
    clock = undefined;
    viewModel = undefined;
    pointEntity = undefined;
    orientationEntity = undefined;
    aircraftEntity = undefined;
    aircraft = undefined;
    google3dTileset = undefined;
    terrainProvider = undefined;
    renderErrorHandler = null;
    isAnimating = false;
    start = undefined;
    stop = undefined;
    lastCoords = undefined;
    lastRollSampleDeg = 0;
    lastPitchSampleDeg = 0;
    window.tar1090LatestWatchedSampleTimeMs = 0;
    lastWatchedSampleTimestampMs = 0;
    posBuffer = [];
    otherPlanes = {};

    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Bootstraps the 3D page lifecycle and attaches runtime event listeners.
 * @returns {Promise<void>} Resolves after initialization sequence completes.
 */
async function main() {
    createViewer();
    await setupEnvironment();
    messageBox("Waiting for data...", { persistent: true });
    addMainListener();

    window.addEventListener('resize', forceViewerResize);

    // Ensure cleanup when iframe/modal is closed or page is unloaded.
    window.addEventListener('beforeunload', cleanup3DScene);
    window.addEventListener('pagehide', cleanup3DScene);
}

main();
