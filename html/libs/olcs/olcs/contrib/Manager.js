import olcsContribLazyLoader from "./LazyLoader.js";
import OLCesium from "../OLCesium.js";
import { resetToNorthZenith, rotateAroundBottomCenter, computeSignedTiltAngleOnGlobe, pickBottomPoint, setHeadingUsingBottomCenter, limitCameraToBoundingSphere } from "../core.js";
import { toRadians } from "../math.js";
import Observable from 'ol/Observable.js';
/**
 * @typedef {Object} ManagerOptions
 * @property {import('ol/Map.js').default} map
 * @property {import('ol/extent.js').Extent} [cameraExtentInRadians]
 * @property {string} [cesiumIonDefaultAccessToken]
 */
export default class Manager extends Observable {
    cesiumUrl_;
    boundingSphere_;
    promise_;
    cesiumIonDefaultAccessToken_;
    map;
    cameraExtentInRadians;
    ol3d;
    cesiumInitialTilt_ = toRadians(50);
    fogDensity = 0.0001;
    fogSSEFactor = 25;
    minimumZoomDistance = 2;
    /**
     * Limit the maximum distance to the earth to 10'000km.
     */
    maximumZoomDistance = 10000000;
    // when closer to 3000m, restrict the available positions harder
    limitCameraToBoundingSphereRatio = (height) => (height > 3000 ? 9 : 3);
    /**
     * @param {string} cesiumUrl
     * @param {olcsx.contrib.ManagerOptions} options
     * @api
     */
    constructor(cesiumUrl, { map, cameraExtentInRadians, cesiumIonDefaultAccessToken }) {
        super();
        this.cesiumUrl_ = cesiumUrl;
        console.assert(map);
        this.map = map;
        this.cameraExtentInRadians = cameraExtentInRadians || null;
        this.cesiumIonDefaultAccessToken_ = cesiumIonDefaultAccessToken;
    }
    /**
     * Lazy load Cesium.
     */
    load() {
        if (!this.promise_) {
            const cesiumLazyLoader = new olcsContribLazyLoader(this.cesiumUrl_);
            this.promise_ = cesiumLazyLoader.load().then(() => this.onCesiumLoaded());
        }
        return this.promise_;
    }
    /**
     * Hook called when Cesium has been lazy loaded.
     */
    onCesiumLoaded() {
        if (this.cameraExtentInRadians) {
            const rect = new Cesium.Rectangle(...this.cameraExtentInRadians);
            // Set the fly home rectangle
            Cesium.Camera.DEFAULT_VIEW_RECTANGLE = rect;
            this.boundingSphere_ = Cesium.BoundingSphere.fromRectangle3D(rect, Cesium.Ellipsoid.WGS84, 300); // lux mean height is 300m
        }
        if (this.cesiumIonDefaultAccessToken_) {
            Cesium.Ion.defaultAccessToken = this.cesiumIonDefaultAccessToken_;
        }
        this.ol3d = this.instantiateOLCesium();
        const scene = this.ol3d.getCesiumScene();
        this.configureForUsability(scene);
        this.configureForPerformance(scene);
        this.dispatchEvent('load');
        return this.ol3d;
    }
    /**
     * Application code should override this method.
     */
    instantiateOLCesium() {
        const ol3d = new OLCesium({ map: this.map });
        const scene = ol3d.getCesiumScene();
        Cesium.createWorldTerrainAsync().then(tp => scene.terrainProvider = tp);
        return ol3d;
    }
    /**
     * Override with custom performance optimization logics, if needed.
     */
    configureForPerformance(scene) {
        const fog = scene.fog;
        fog.enabled = true;
        fog.density = this.fogDensity;
        fog.screenSpaceErrorFactor = this.fogSSEFactor;
    }
    /**
     * Override with custom usabliity logics, id needed.
     */
    configureForUsability(scene) {
        const sscController = scene.screenSpaceCameraController;
        sscController.minimumZoomDistance = this.minimumZoomDistance;
        sscController.maximumZoomDistance = this.maximumZoomDistance;
        // Do not see through the terrain. Seeing through the terrain does not make
        // sense anyway, except for debugging
        scene.globe.depthTestAgainstTerrain = true;
        // Use white instead of the black default colour for the globe when tiles are missing
        scene.globe.baseColor = Cesium.Color.WHITE;
        scene.backgroundColor = Cesium.Color.WHITE;
        if (this.boundingSphere_) {
            scene.postRender.addEventListener(this.limitCameraToBoundingSphere.bind(this));
        }
        // Stop rendering Cesium when there is nothing to do. This drastically reduces CPU/GPU consumption.
        this.ol3d.enableAutoRenderLoop();
    }
    /**
     * Constrain the camera so that it stays close to the bounding sphere of the map extent.
     * Near the ground the allowed distance is shorter.
     */
    limitCameraToBoundingSphere() {
        const scene = this.ol3d.getCesiumScene();
        limitCameraToBoundingSphere(scene.camera, this.boundingSphere_, this.limitCameraToBoundingSphereRatio);
    }
    /**
     * Enable or disable ol3d with a default animation.
     */
    toggle3d() {
        return this.load().then((/** @const {!olcs.OLCesium} */ ol3d) => {
            const is3DCurrentlyEnabled = ol3d.getEnabled();
            const scene = ol3d.getCesiumScene();
            if (is3DCurrentlyEnabled) {
                // Disable 3D
                console.assert(this.map);
                return resetToNorthZenith(this.map, scene).then(() => {
                    ol3d.setEnabled(false);
                    this.dispatchEvent('toggle');
                });
            }
            else {
                // Enable 3D
                ol3d.setEnabled(true);
                this.dispatchEvent('toggle');
                return rotateAroundBottomCenter(scene, this.cesiumInitialTilt_);
            }
        });
    }
    /**
     * Enable ol3d with a view built from parameters.
     */
    set3dWithView(lon, lat, elevation, headingDeg, pitchDeg) {
        return this.load().then((ol3d) => {
            const is3DCurrentlyEnabled = ol3d.getEnabled();
            const scene = ol3d.getCesiumScene();
            const camera = scene.camera;
            const destination = Cesium.Cartesian3.fromDegrees(lon, lat, elevation);
            const heading = Cesium.Math.toRadians(headingDeg);
            const pitch = Cesium.Math.toRadians(pitchDeg);
            const roll = 0;
            const orientation = { heading, pitch, roll };
            if (!is3DCurrentlyEnabled) {
                ol3d.setEnabled(true);
                this.dispatchEvent('toggle');
            }
            camera.setView({
                destination,
                orientation
            });
        });
    }
    /**
     * Whether OL-Cesium has been loaded and 3D mode is enabled.
     */
    is3dEnabled() {
        return !!this.ol3d && this.ol3d.getEnabled();
    }
    /**
     * @return {number}
     */
    getHeading() {
        return this.map ? this.map.getView().getRotation() || 0 : 0;
    }
    /**
     * @return {number|undefined}
     */
    getTiltOnGlobe() {
        const scene = this.ol3d.getCesiumScene();
        const tiltOnGlobe = computeSignedTiltAngleOnGlobe(scene);
        return -tiltOnGlobe;
    }
    /**
     * Set heading.
     * This assumes ol3d has been loaded.
     */
    setHeading(angle) {
        const scene = this.ol3d.getCesiumScene();
        const bottom = pickBottomPoint(scene);
        if (bottom) {
            setHeadingUsingBottomCenter(scene, angle, bottom);
        }
    }
    getOl3d() {
        return this.ol3d;
    }
    getCesiumViewMatrix() {
        return this.ol3d.getCesiumScene().camera.viewMatrix;
    }
    getCesiumScene() {
        return this.ol3d.getCesiumScene();
    }
    /**
     * Fly to some rectangle.
     * This assumes ol3d has been loaded.
     */
    flyToRectangle(rectangle, offset = 0) {
        const camera = this.getCesiumScene().camera;
        const destination = camera.getRectangleCameraCoordinates(rectangle);
        const mag = Cesium.Cartesian3.magnitude(destination) + offset;
        Cesium.Cartesian3.normalize(destination, destination);
        Cesium.Cartesian3.multiplyByScalar(destination, mag, destination);
        return new Promise((resolve, reject) => {
            if (!this.cameraExtentInRadians) {
                reject();
                return;
            }
            camera.flyTo({
                destination,
                complete: () => resolve(),
                cancel: () => reject(),
                endTransform: Cesium.Matrix4.IDENTITY
            });
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9vbGNzL2NvbnRyaWIvTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLHFCQUFxQixNQUFNLGNBQWMsQ0FBQztBQUNqRCxPQUFPLFFBQVEsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxFQUFDLGtCQUFrQixFQUFFLHdCQUF3QixFQUFFLDZCQUE2QixFQUFFLGVBQWUsRUFBRSwyQkFBMkIsRUFBRSwyQkFBMkIsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUMvSyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBQ2xDLE9BQU8sVUFBVSxNQUFNLGtCQUFrQixDQUFDO0FBTTFDOzs7OztHQUtHO0FBR0gsTUFBTSxDQUFDLE9BQU8sT0FBTyxPQUFRLFNBQVEsVUFBVTtJQUNyQyxVQUFVLENBQVM7SUFDbkIsZUFBZSxDQUFpQjtJQUNoQyxRQUFRLENBQW9CO0lBQzVCLDRCQUE0QixDQUFTO0lBQ25DLEdBQUcsQ0FBUTtJQUNYLHFCQUFxQixDQUFTO0lBQzlCLElBQUksQ0FBVztJQUNqQixrQkFBa0IsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7SUFFakMsVUFBVSxHQUFHLE1BQU0sQ0FBQztJQUVwQixZQUFZLEdBQUcsRUFBRSxDQUFDO0lBRWxCLG1CQUFtQixHQUFHLENBQUMsQ0FBQztJQUVsQzs7T0FFRztJQUNPLG1CQUFtQixHQUFXLFFBQVEsQ0FBQztJQUVqRCxnRUFBZ0U7SUFDdEQsZ0NBQWdDLEdBQUcsQ0FBQyxNQUFjLEVBQUUsRUFBRSxDQUFDLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUV6Rjs7OztPQUlHO0lBQ0gsWUFBWSxTQUFpQixFQUFFLEVBQUMsR0FBRyxFQUFFLHFCQUFxQixFQUFFLDJCQUEyQixFQUFxRjtRQUMx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