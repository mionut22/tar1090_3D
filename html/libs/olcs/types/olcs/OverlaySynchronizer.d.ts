/// <reference path="FeatureConverter.d.ts" />
import type { Map as OLMap, Overlay } from 'ol';
import type { Scene } from 'cesium';
export default class OverlaySynchronizer {
    protected map: OLMap;
    protected scene: Scene;
    private overlayCollection_;
    private overlayContainerStopEvent_;
    private overlayContainer_;
    private overlayMap_;
    private overlayEvents;
    private listenerKeys_;
    /**
    * @param map
    * @param scene
    * @constructor
    * @api
    */
    constructor(map: OLMap, scene: Scene);
    /**
    * Get the element that serves as a container for overlays that don't allow
    * event propagation. Elements added to this container won't let mousedown and
    * touchstart events through to the map, so clicks and gestures on an overlay
    * don't trigger any {@link ol.MapBrowserEvent}.
    * @return The map's overlay container that stops events.
    */
    getOverlayContainerStopEvent(): Element;
    /**
    * Get the element that serves as a container for overlays.
    * @return The map's overlay container.
    */
    getOverlayContainer(): Element;
    /**
    * Destroy all and perform complete synchronization of the overlays.
    * @api
    */
    synchronize(): void;
    /**
    * @api
    */
    addOverlay(overlay: Overlay): void;
    /**
    * Removes an overlay from the scene
    * @api
    */
    removeOverlay(overlay: Overlay): void;
    /**
    * Destroys all the created Cesium objects.
    */
    protected destroyAll(): void;
}
//# sourceMappingURL=OverlaySynchronizer.d.ts.map