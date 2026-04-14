/// <reference path="FeatureConverter.d.ts" />
import type { Map, View } from 'ol';
import type { Scene } from 'cesium';
/**
 * @param input Input coordinate array.
 * @param opt_output Output array of coordinate values.
 * @param opt_dimension Dimension.
 * @return Input coordinate array (same array as input).
 */
export declare function identityProjection(input: number[], opt_output?: number[], opt_dimension?: number): number[];
export default class Camera {
    private scene_;
    private cam_;
    private map_;
    private view_;
    private viewListenKey_;
    private toLonLat_;
    private fromLonLat_;
    /**
     * 0 -- topdown, PI/2 -- the horizon
     */
    private tilt_;
    private distance_;
    private lastCameraViewMatrix_;
    /**
     * This is used to discard change events on view caused by updateView method.
     */
    private viewUpdateInProgress_;
    /**
     * This object takes care of additional 3d-specific properties of the view and
     * ensures proper synchronization with the underlying raw Cesium.Camera object.
     */
    constructor(scene: Scene, map: Map);
    destroy(): void;
    /**
     * @param {?ol.View} view New view to use.
     * @private
     */
    setView_(view: View | undefined): void;
    private handleViewChangedEvent_;
    /**
     * @deprecated
     * @param heading In radians.
     */
    setHeading(heading: number): void;
    /**
     * @deprecated
     * @return Heading in radians.
     */
    getHeading(): number | undefined;
    /**
     * @param tilt In radians.
     */
    setTilt(tilt: number): void;
    /**
     * @return Tilt in radians.
     */
    getTilt(): number;
    /**
     * @param distance In meters.
     */
    setDistance(distance: number): void;
    /**
     * @return Distance in meters.
     */
    getDistance(): number;
    /**
     * @deprecated
     * Shortcut for ol.View.setCenter().
     * @param center Same projection as the ol.View.
     */
    setCenter(center: number[]): void;
    /**
     * @deprecated
     * Shortcut for ol.View.getCenter().
     * @return {ol.Coordinate|undefined} Same projection as the ol.View.
     * @api
     */
    getCenter(): import("ol/coordinate").Coordinate;
    /**
     * Sets the position of the camera.
     * @param position Same projection as the ol.View.
     */
    setPosition(position: number[]): void;
    /**
     * Calculates position under the camera.
     * @return Coordinates in same projection as the ol.View.
     * @api
     */
    getPosition(): number[] | undefined;
    /**
     * @param altitude In meters.
     */
    setAltitude(altitude: number): void;
    /**
     * @return Altitude in meters.
     */
    getAltitude(): number;
    /**
     * Updates the state of the underlying Cesium.Camera
     * according to the current values of the properties.
     */
    private updateCamera_;
    /**
     * Calculates the values of the properties from the current ol.View state.
     */
    readFromView(): void;
    /**
     * Calculates the values of the properties from the current Cesium.Camera state.
     * Modifies the center, resolution and rotation properties of the view.
     */
    updateView(): void;
    /**
     * Check if the underlying camera state has changed and ensure synchronization.
     * @param opt_dontSync Do not synchronize the view.
     */
    checkCameraChange(opt_dontSync?: boolean): void;
    /**
     * calculate the distance between camera and centerpoint based on the resolution and latitude value
     * @param resolution Number of map units per pixel.
     * @param latitude Latitude in radians.
     * @return The calculated distance.
     */
    calcDistanceForResolution(resolution: number, latitude: number): number;
    /**
     * calculate the resolution based on a distance(camera to position) and latitude value
     * @param distance
     * @param latitude
     * @return} The calculated resolution.
     */
    calcResolutionForDistance(distance: number, latitude: number): number;
}
//# sourceMappingURL=Camera.d.ts.map