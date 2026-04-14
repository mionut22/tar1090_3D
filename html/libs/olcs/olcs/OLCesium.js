import olGeomPoint from 'ol/geom/Point.js';
import { supportsImageRenderingPixelated, imageRenderingValue } from "./util.js";
import { ol4326CoordinateToCesiumCartesian } from "./core.js";
import { getTransform } from 'ol/proj.js';
import olcsAutoRenderLoop from "./AutoRenderLoop.js";
import olcsCamera from "./Camera.js";
import olcsRasterSynchronizer from "./RasterSynchronizer.js";
import olcsVectorSynchronizer from "./VectorSynchronizer.js";
import olcsOverlaySynchronizer from "./OverlaySynchronizer.js";
/**
 * Moved from Cesium
 * The state of a BoundingSphere computation being performed by a {@link Visualizer}.
 */
const BoundingSphereState = {
    /**
     * The BoundingSphere has been computed.
     */
    DONE: 0,
    /**
     * The BoundingSphere is still being computed.
     */
    PENDING: 1,
    /**
     * The BoundingSphere does not exist.
     */
    FAILED: 2,
};
/**
 * @typedef {Object} OLCesiumOptions
 * @property {import('ol/Map.js').default} map The OpenLayers map we want to show on a Cesium scene.
 * @property {Element|string} [target] Target element for the Cesium scene.
 * @property {function(!import('ol/Map.js').default, !Cesium.Scene, !Cesium.DataSourceCollection): Array<import('olcs/AbstractSynchronizer.js').default>}
 *      [createSynchronizers] Callback function which will be called by the {@link olcs.OLCesium}
 *      constructor to create custom synchronizers. Receives an `ol.Map` and a `Cesium.Scene` as arguments,
 *      and needs to return an array of {@link import('olcs/AbstractSynchronizer.js').default}.
 * @property {function(): Cesium.JulianDate} [time] Control the current time used by Cesium.
 * @property {boolean} [stopOpenLayersEventsPropagation] Prevent propagation of mouse/touch events to
 *      OpenLayers when Cesium is active.
 * @property {Cesium.SceneOptions} [sceneOptions] Allows the passing of property value to the
 *      `Cesium.Scene`.
 */
export default class OLCesium {
    autoRenderLoop_ = null;
    map_;
    time_;
    to4326Transform_;
    resolutionScale_ = 1.0;
    canvasClientWidth_ = 0.0;
    canvasClientHeight_ = 0.0;
    resolutionScaleChanged_ = true; // force resize
    container_;
    isOverMap_;
    canvas_;
    enabled_ = false;
    pausedInteractions_ = [];
    hiddenRootGroup_ = null;
    scene_;
    camera_;
    globe_;
    dataSourceCollection_;
    dataSourceDisplay_;
    /** Time of the last rendered frame, as returned by `performance.now()`. */
    lastFrameTime_ = 0;
    /** The identifier returned by `requestAnimationFrame`. */
    renderId_;
    /** Target frame rate for the render loop.  */
    targetFrameRate_ = Number.POSITIVE_INFINITY;
    /** If the Cesium render loop is being blocked. */
    blockCesiumRendering_ = false;
    /** If the warmup routine is active. */
    warmingUp_ = false;
    trackedFeature_ = null;
    trackedEntity_ = null;
    entityView_ = null;
    needTrackedEntityUpdate_ = false;
    boundingSphereScratch_ = new Cesium.BoundingSphere();
    synchronizers_;
    refresh2DAfterCameraMoveEndOnly = false;
    moveEndRemoveCallback_;
    constructor(options) {
        this.map_ = options.map;
        this.time_ = options.time || function () {
            return Cesium.JulianDate.now();
        };
        /**
         * No change of the view projection.
         */
        this.to4326Transform_ = getTransform(this.map_.getView().getProjection(), 'EPSG:4326');
        const fillArea = 'position:absolute;top:0;left:0;width:100%;height:100%;touch-action:none;';
        this.container_ = document.createElement('DIV');
        const containerAttribute = document.createAttribute('style');
        containerAttribute.value = `${fillArea}visibility:hidden;`;
        this.container_.setAttributeNode(containerAttribute);
        let targetElement = options.target || this.map_.getViewport();
        if (typeof targetElement === 'string') {
            targetElement = document.getElementById(targetElement);
        }
        targetElement.appendChild(this.container_);
        /**
         * Whether the Cesium container is placed over the ol map.
         * a target => side by side mode
         * no target => over map mode
         */
        this.isOverMap_ = !options.target;
        if (this.isOverMap_ && options.stopOpenLayersEventsPropagation) {
            const overlayEvents = ['click', 'dblclick', 'mousedown', 'touchstart', 'pointerdown', 'mousewheel', 'wheel'];
            for (let i = 0, ii = overlayEvents.length; i < ii; ++i) {
                this.container_.addEventListener(overlayEvents[i], evt => evt.stopPropagation());
            }
        }
        this.canvas_ = document.createElement('canvas');
        const canvasAttribute = document.createAttribute('style');
        canvasAttribute.value = fillArea;
        this.canvas_.setAttributeNode(canvasAttribute);
        if (supportsImageRenderingPixelated()) {
            // non standard CSS4
            this.canvas_.style['imageRendering'] = imageRenderingValue();
        }
        this.canvas_.oncontextmenu = function () {
            return false;
        };
        this.canvas_.onselectstart = function () {
            return false;
        };
        this.container_.appendChild(this.canvas_);
        const sceneOptions = options.sceneOptions !== undefined ?
            { ...options.sceneOptions, canvas: this.canvas_, scene3DOnly: true } :
            { canvas: this.canvas_, scene3DOnly: true };
        this.scene_ = new Cesium.Scene(sceneOptions);
        const sscc = this.scene_.screenSpaceCameraController;
        if (!Array.isArray(sscc.tiltEventTypes)) {
            console.log('sscc is not an array');
        }
        else {
            sscc.tiltEventTypes.push({
                'eventType': Cesium.CameraEventType.LEFT_DRAG,
                'modifier': Cesium.KeyboardEventModifier.SHIFT
            });
            sscc.tiltEventTypes.push({
                'eventType': Cesium.CameraEventType.LEFT_DRAG,
                'modifier': Cesium.KeyboardEventModifier.ALT
            });
        }
        sscc.enableLook = false;
        this.scene_.camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;
        this.camera_ = new olcsCamera(this.scene_, this.map_);
        this.globe_ = new Cesium.Globe(Cesium.Ellipsoid.WGS84);
        this.globe_.baseColor = Cesium.Color.WHITE;
        this.scene_.globe = this.globe_;
        this.scene_.skyAtmosphere = new Cesium.SkyAtmosphere();
        // The first layer of Cesium is special; using a 1x1 transparent image to workaround it.
        // See https://github.com/AnalyticalGraphicsInc/cesium/issues/1323 for details.
        const firstImageryProvider = new Cesium.SingleTileImageryProvider({
            tileHeight: 1,
            tileWidth: 1,
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            rectangle: Cesium.Rectangle.fromDegrees(0, 0, 1, 1) // the Rectangle dimensions are arbitrary
        });
        this.globe_.imageryLayers.addImageryProvider(firstImageryProvider, 0);
        this.dataSourceCollection_ = new Cesium.DataSourceCollection();
        this.dataSourceDisplay_ = new Cesium.DataSourceDisplay({
            scene: this.scene_,
            dataSourceCollection: this.dataSourceCollection_
        });
        this.synchronizers_ = options.createSynchronizers ?
            options.createSynchronizers(this.map_, this.scene_, this.dataSourceCollection_) : [
            new olcsRasterSynchronizer(this.map_, this.scene_),
            new olcsVectorSynchronizer(this.map_, this.scene_),
            new olcsOverlaySynchronizer(this.map_, this.scene_)
        ];
        // Assures correct canvas size after initialisation
        this.handleResize_();
        for (let i = this.synchronizers_.length - 1; i >= 0; --i) {
            this.synchronizers_[i].synchronize();
        }
        const eventHelper = new Cesium.EventHelper();
        eventHelper.add(this.scene_.postRender, OLCesium.prototype.updateTrackedEntity_, this);
        this.moveEndRemoveCallback_ = this.scene_.camera.moveEnd.addEventListener(() => {
            if (this.refresh2DAfterCameraMoveEndOnly) {
                this.camera_.checkCameraChange();
            }
        });
    }
    /**
     * Destroys the Cesium resources held by this object.
     */
    destroy() {
        cancelAnimationFrame(this.renderId_);
        this.renderId_ = undefined;
        this.synchronizers_.forEach(synchronizer => synchronizer.destroyAll());
        this.camera_.destroy();
        this.scene_.destroy();
        // @ts-ignore TS2341
        this.scene_._postRender = null;
        this.moveEndRemoveCallback_();
        this.container_.remove();
    }
    /**
     * Render the Cesium scene.
     */
    render_() {
        // if a call to `requestAnimationFrame` is pending, cancel it
        if (this.renderId_ !== undefined) {
            cancelAnimationFrame(this.renderId_);
            this.renderId_ = undefined;
        }
        // only render if Cesium is enabled/warming and rendering hasn't been blocked
        if ((this.enabled_ || this.warmingUp_) && !this.blockCesiumRendering_) {
            this.renderId_ = requestAnimationFrame(this.onAnimationFrame_.bind(this));
        }
    }
    /**
     * Callback for `requestAnimationFrame`.
     * @param {number} frameTime The frame time, from `performance.now()`.
     */
    onAnimationFrame_(frameTime) {
        this.renderId_ = undefined;
        // check if a frame was rendered within the target frame rate
        const interval = 1000.0 / this.targetFrameRate_;
        const delta = frameTime - this.lastFrameTime_;
        if (delta < interval) {
            // too soon, don't render yet
            this.render_();
            return;
        }
        // time to render a frame, save the time
        this.lastFrameTime_ = frameTime;
        const julianDate = this.time_();
        // initializeFrame private property
        // @ts-ignore TS2341
        this.scene_.initializeFrame();
        this.handleResize_();
        this.dataSourceDisplay_.update(julianDate);
        // Update tracked entity
        if (this.entityView_) {
            const trackedEntity = this.trackedEntity_;
            // getBoundingSphere private property
            // @ts-ignore TS2341
            const trackedState = this.dataSourceDisplay_.getBoundingSphere(trackedEntity, false, this.boundingSphereScratch_);
            if (trackedState === BoundingSphereState.DONE) {
                this.boundingSphereScratch_.radius = 1; // a radius of 1 is enough for tracking points
                this.entityView_.update(julianDate, this.boundingSphereScratch_);
            }
        }
        this.scene_.render(julianDate);
        if (!this.refresh2DAfterCameraMoveEndOnly) {
            this.camera_.checkCameraChange();
        }
        // request the next render call after this one completes to ensure the browser doesn't get backed up
        this.render_();
    }
    updateTrackedEntity_() {
        if (!this.needTrackedEntityUpdate_) {
            return;
        }
        const trackedEntity = this.trackedEntity_;
        const scene = this.scene_;
        // getBoundingSphere private property
        // @ts-ignore TS2341
        const state = this.dataSourceDisplay_.getBoundingSphere(trackedEntity, false, this.boundingSphereScratch_);
        if (state === BoundingSphereState.PENDING) {
            return;
        }
        scene.screenSpaceCameraController.enableTilt = false;
        const bs = state !== BoundingSphereState.FAILED ? this.boundingSphereScratch_ : undefined;
        if (bs) {
            bs.radius = 1;
        }
        this.entityView_ = new Cesium.EntityView(trackedEntity, scene, scene.mapProjection.ellipsoid);
        this.entityView_.update(this.time_(), bs);
        this.needTrackedEntityUpdate_ = false;
    }
    handleResize_() {
        let width = this.canvas_.clientWidth;
        let height = this.canvas_.clientHeight;
        if (width === 0 || height === 0) {
            // The canvas DOM element is not ready yet.
            return;
        }
        if (width === this.canvasClientWidth_ &&
            height === this.canvasClientHeight_ &&
            !this.resolutionScaleChanged_) {
            return;
        }
        let resolutionScale = this.resolutionScale_;
        if (!supportsImageRenderingPixelated()) {
            resolutionScale *= window.devicePixelRatio || 1.0;
        }
        this.resolutionScaleChanged_ = false;
        this.canvasClientWidth_ = width;
        this.canvasClientHeight_ = height;
        width *= resolutionScale;
        height *= resolutionScale;
        this.canvas_.width = width;
        this.canvas_.height = height;
        this.scene_.camera.frustum.aspectRatio = width / height;
    }
    getCamera() {
        return this.camera_;
    }
    getOlMap() {
        return this.map_;
    }
    getOlView() {
        const view = this.map_.getView();
        console.assert(view);
        return view;
    }
    getCesiumScene() {
        return this.scene_;
    }
    getDataSources() {
        return this.dataSourceCollection_;
    }
    getDataSourceDisplay() {
        return this.dataSourceDisplay_;
    }
    getEnabled() {
        return this.enabled_;
    }
    /**
     * Enables/disables the Cesium.
     * This modifies the visibility style of the container element.
     */
    setEnabled(enable) {
        if (this.enabled_ === enable) {
            return;
        }
        this.enabled_ = enable;
        // some Cesium operations are operating with canvas.clientWidth,
        // so we can't remove it from DOM or even make display:none;
        this.container_.style.visibility = this.enabled_ ? 'visible' : 'hidden';
        let interactions;
        if (this.enabled_) {
            this.throwOnUnitializedMap_();
            if (this.isOverMap_) {
                interactions = this.map_.getInteractions();
                interactions.forEach((el, i, arr) => {
                    this.pausedInteractions_.push(el);
                });
                interactions.clear();
                this.map_.addInteraction = interaction => this.pausedInteractions_.push(interaction);
                this.map_.removeInteraction = (interaction) => {
                    let interactionRemoved = false;
                    this.pausedInteractions_ = this.pausedInteractions_.filter((i) => {
                        const removed = i !== interaction;
                        if (!interactionRemoved) {
                            interactionRemoved = removed;
                        }
                        return removed;
                    });
                    return interactionRemoved ? interaction : undefined;
                };
                const rootGroup = this.map_.getLayerGroup();
                if (rootGroup.getVisible()) {
                    this.hiddenRootGroup_ = rootGroup;
                    this.hiddenRootGroup_.setVisible(false);
                }
                this.map_.getOverlayContainer().classList.add('olcs-hideoverlay');
            }
            this.camera_.readFromView();
            this.render_();
        }
        else {
            if (this.isOverMap_) {
                interactions = this.map_.getInteractions();
                this.pausedInteractions_.forEach((interaction) => {
                    interactions.push(interaction);
                });
                this.pausedInteractions_.length = 0;
                this.map_.addInteraction = interaction => this.map_.getInteractions().push(interaction);
                this.map_.removeInteraction = interaction => this.map_.getInteractions().remove(interaction);
                this.map_.getOverlayContainer().classList.remove('olcs-hideoverlay');
                if (this.hiddenRootGroup_) {
                    this.hiddenRootGroup_.setVisible(true);
                    this.hiddenRootGroup_ = null;
                }
            }
            this.camera_.updateView();
        }
    }
    /**
     * Preload Cesium so that it is ready when transitioning from 2D to 3D.
     * @param {number} height Target height of the camera
     * @param {number} timeout Milliseconds after which the warming will stop
    */
    warmUp(height, timeout) {
        if (this.enabled_) {
            // already enabled
            return;
        }
        this.throwOnUnitializedMap_();
        this.camera_.readFromView();
        const ellipsoid = this.globe_.ellipsoid;
        const csCamera = this.scene_.camera;
        const position = ellipsoid.cartesianToCartographic(csCamera.position);
        if (position.height < height) {
            position.height = height;
            csCamera.position = ellipsoid.cartographicToCartesian(position);
        }
        this.warmingUp_ = true;
        this.render_();
        setTimeout(() => {
            this.warmingUp_ = false;
        }, timeout);
    }
    /**
     * Block Cesium rendering to save resources.
     * @param {boolean} block True to block.
    */
    setBlockCesiumRendering(block) {
        if (this.blockCesiumRendering_ !== block) {
            this.blockCesiumRendering_ = block;
            // reset the render loop
            this.render_();
        }
    }
    /**
     * Render the globe only when necessary in order to save resources.
     * Experimental.
     */
    enableAutoRenderLoop() {
        if (!this.autoRenderLoop_) {
            this.autoRenderLoop_ = new olcsAutoRenderLoop(this);
        }
    }
    /**
     * Get the autorender loop.
    */
    getAutoRenderLoop() {
        return this.autoRenderLoop_;
    }
    /**
     * The 3D Cesium globe is rendered in a canvas with two different dimensions:
     * clientWidth and clientHeight which are the dimension on the screen and
     * width and height which are the dimensions of the drawing buffer.
     *
     * By using a resolution scale lower than 1.0, it is possible to render the
     * globe in a buffer smaller than the canvas client dimensions and improve
     * performance, at the cost of quality.
     *
     * Pixel ratio should also be taken into account; by default, a device with
     * pixel ratio of 2.0 will have a buffer surface 4 times bigger than the client
     * surface.
     */
    setResolutionScale(value) {
        value = Math.max(0, value);
        if (value !== this.resolutionScale_) {
            this.resolutionScale_ = Math.max(0, value);
            this.resolutionScaleChanged_ = true;
            if (this.autoRenderLoop_) {
                this.autoRenderLoop_.restartRenderLoop();
            }
        }
    }
    /**
     * Set the target frame rate for the renderer. Set to `Number.POSITIVE_INFINITY`
     * to render as quickly as possible.
     * @param {number} value The frame rate, in frames per second.
     */
    setTargetFrameRate(value) {
        if (this.targetFrameRate_ !== value) {
            this.targetFrameRate_ = value;
            // reset the render loop
            this.render_();
        }
    }
    /**
     * Set if the synchronization back to the OL 2D map happens continuously or only after the camera is at rest again.
     * @param {boolean} value true: synch after camera move end only; false: synch continuously
     */
    setRefresh2DAfterCameraMoveEndOnly(value) {
        this.refresh2DAfterCameraMoveEndOnly = value;
    }
    /**
     * Check if OpenLayers map is not properly initialized.
     */
    throwOnUnitializedMap_() {
        const map = this.map_;
        const view = map.getView();
        const center = view.getCenter();
        if (!view.isDef() || isNaN(center[0]) || isNaN(center[1])) {
            throw new Error(`The OpenLayers map is not properly initialized: ${center} / ${view.getResolution()}`);
        }
    }
    get trackedFeature() {
        return this.trackedFeature_;
    }
    set trackedFeature(feature) {
        if (this.trackedFeature_ !== feature) {
            const scene = this.scene_;
            //Stop tracking
            if (!feature || !feature.getGeometry()) {
                this.needTrackedEntityUpdate_ = false;
                scene.screenSpaceCameraController.enableTilt = true;
                if (this.trackedEntity_) {
                    this.dataSourceDisplay_.defaultDataSource.entities.remove(this.trackedEntity_);
                }
                this.trackedEntity_ = null;
                this.trackedFeature_ = null;
                this.entityView_ = null;
                scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
                return;
            }
            this.trackedFeature_ = feature;
            //We can't start tracking immediately, so we set a flag and start tracking
            //when the bounding sphere is ready (most likely next frame).
            this.needTrackedEntityUpdate_ = true;
            const to4326Transform = this.to4326Transform_;
            const toCesiumPosition = function () {
                const geometry = feature.getGeometry();
                console.assert(geometry instanceof olGeomPoint);
                const coo = geometry instanceof olGeomPoint ? geometry.getCoordinates() : [];
                const coo4326 = to4326Transform(coo, undefined, coo.length);
                return ol4326CoordinateToCesiumCartesian(coo4326);
            };
            // Create an invisible point entity for tracking.
            // It is independent of the primitive/geometry created by the vector synchronizer.
            const options = {
                // @ts-ignore according to Cesium types, not possible to pass CallbackProperty
                position: new Cesium.CallbackProperty((time, result) => toCesiumPosition(), false),
                point: {
                    pixelSize: 1,
                    color: Cesium.Color.TRANSPARENT
                }
            };
            this.trackedEntity_ = this.dataSourceDisplay_.defaultDataSource.entities.add(options);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT0xDZXNpdW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvb2xjcy9PTENlc2l1bS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLFdBQVcsTUFBTSxrQkFBa0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsK0JBQStCLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFDNUUsT0FBTyxFQUFDLGlDQUFpQyxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQ3pELE9BQU8sRUFBQyxZQUFZLEVBQXlCLE1BQU0sWUFBWSxDQUFDO0FBQ2hFLE9BQU8sa0JBQWtCLE1BQU0sa0JBQWtCLENBQUM7QUFDbEQsT0FBTyxVQUFVLE1BQU0sVUFBVSxDQUFDO0FBQ2xDLE9BQU8sc0JBQXNCLE1BQU0sc0JBQXNCLENBQUM7QUFDMUQsT0FBTyxzQkFBc0IsTUFBTSxzQkFBc0IsQ0FBQztBQUMxRCxPQUFPLHVCQUF1QixNQUFNLHVCQUF1QixDQUFDO0FBb0I1RDs7O0dBR0c7QUFDSCxNQUFNLG1CQUFtQixHQUEyQjtJQUNsRDs7T0FFRztJQUNILElBQUksRUFBRSxDQUFDO0lBQ1A7O09BRUc7SUFDSCxPQUFPLEVBQUUsQ0FBQztJQUNWOztPQUVHO0lBQ0gsTUFBTSxFQUFFLENBQUM7Q0FDVixDQUFDO0FBOEJGOzs7Ozs7Ozs7Ozs7O0dBYUc7QUFDSCxNQUFNLENBQUMsT0FBTyxPQUFPLFFBQVE7SUFDbkIsZUFBZSxHQUE4QixJQUFJLENBQUM7SUFDbEQsSUFBSSxDQUFNO0lBQ1YsS0FBSyxDQUFtQjtJQUN4QixnQkFBZ0IsQ0FBb0I7SUFDcEMsZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0lBQ3ZCLGtCQUFrQixHQUFHLEdBQUcsQ0FBQztJQUN6QixtQkFBbUIsR0FBRyxHQUFHLENBQUM7SUFDMUIsdUJBQXVCLEdBQUcsSUFBSSxDQUFDLENBQUMsZUFBZTtJQUMvQyxVQUFVLENBQWM7SUFDeEIsVUFBVSxDQUFVO0lBQ3BCLE9BQU8sQ0FBb0I7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