/// <reference path="../FeatureConverter.d.ts" />
import OLCesium from '../OLCesium';
import Observable from 'ol/Observable.js';
import type OLMap from 'ol/Map.js';
import type { Extent } from 'ol/extent.js';
import type { Matrix4, Rectangle, Scene } from 'cesium';
/**
 * @typedef {Object} ManagerOptions
 * @property {import('ol/Map.js').default} map
 * @property {import('ol/extent.js').Extent} [cameraExtentInRadians]
 * @property {string} [cesiumIonDefaultAccessToken]
 */
export default class Manager extends Observable {
    private cesiumUrl_;
    private boundingSphere_;
    private promise_;
    private cesiumIonDefaultAccessToken_;
    protected map: OLMap;
    protected cameraExtentInRadians: Extent;
    protected ol3d: OLCesium;
    private cesiumInitialTilt_;
    protected fogDensity: number;
    protected fogSSEFactor: number;
    protected minimumZoomDistance: number;
    /**
     * Limit the maximum distance to the earth to 10'000km.
     */
    protected maximumZoomDistance: number;
    protected limitCameraToBoundingSphereRatio: (height: number) => 3 | 9;
    /**
     * @param {string} cesiumUrl
     * @param {olcsx.contrib.ManagerOptions} options
     * @api
     */
    constructor(cesiumUrl: string, { map, cameraExtentInRadians, cesiumIonDefaultAccessToken }: {
        map: OLMap;
        cameraExtentInRadians?: Extent;
        cesiumIonDefaultAccessToken?: string;
    });
    /**
     * Lazy load Cesium.
     */
    load(): Promise<OLCesium>;
    /**
     * Hook called when Cesium has been lazy loaded.
     */
    protected onCesiumLoaded(): OLCesium;
    /**
     * Application code should override this method.
     */
    instantiateOLCesium(): OLCesium;
    /**
     * Override with custom performance optimization logics, if needed.
     */
    protected configureForPerformance(scene: Scene): void;
    /**
     * Override with custom usabliity logics, id needed.
     */
    configureForUsability(scene: Scene): void;
    /**
     * Constrain the camera so that it stays close to the bounding sphere of the map extent.
     * Near the ground the allowed distance is shorter.
     */
    protected limitCameraToBoundingSphere(): void;
    /**
     * Enable or disable ol3d with a default animation.
     */
    toggle3d(): Promise<void>;
    /**
     * Enable ol3d with a view built from parameters.
     */
    set3dWithView(lon: number, lat: number, elevation: number, headingDeg: number, pitchDeg: number): Promise<void>;
    /**
     * Whether OL-Cesium has been loaded and 3D mode is enabled.
     */
    is3dEnabled(): boolean;
    /**
     * @return {number}
     */
    getHeading(): number;
    /**
     * @return {number|undefined}
     */
    getTiltOnGlobe(): number;
    /**
     * Set heading.
     * This assumes ol3d has been loaded.
     */
    setHeading(angle: number): void;
    getOl3d(): OLCesium;
    getCesiumViewMatrix(): Matrix4;
    getCesiumScene(): Scene;
    /**
     * Fly to some rectangle.
     * This assumes ol3d has been loaded.
     */
    flyToRectangle(rectangle: Rectangle, offset?: number): Promise<void>;
}
//# sourceMappingURL=Manager.d.ts.map