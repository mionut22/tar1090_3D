/// <reference path="FeatureConverter.d.ts" />
import OLOverlay from 'ol/Overlay.js';
import type { Scene } from 'cesium';
import type OverlaySynchronizer from './OverlaySynchronizer';
interface SynchronizedOverlayOptions {
    scene: Scene;
    parent: OLOverlay;
    synchronizer: OverlaySynchronizer;
}
export default class SynchronizedOverlay extends OLOverlay {
    private scenePostRenderListenerRemover_?;
    private scene_;
    private synchronizer_;
    private parent_;
    private positionWGS84_;
    private observer_;
    private attributeObserver_;
    private listenerKeys_;
    /**
     * @param options SynchronizedOverlay Options.
     * @api
     */
    constructor(options: SynchronizedOverlayOptions);
    /**
     * @param target
     */
    private observeTarget_;
    /**
     *
     * @param event
     */
    private setPropertyFromEvent_;
    /**
     * Get the scene associated with this overlay.
     * @see ol.Overlay.prototype.getMap
     * @return The scene that the overlay is part of.
     * @api
     */
    getScene(): Scene;
    /**
     * @override
     */
    handleMapChanged(): void;
    /**
     * @override
     */
    handlePositionChanged(): void;
    /**
     * @override
     */
    handleElementChanged(): void;
    /**
     * @override
     */
    updatePixelPosition(): void;
    /**
     * Destroys the overlay, removing all its listeners and elements
     * @api
     */
    destroy(): void;
}
export {};
//# sourceMappingURL=SynchronizedOverlay.d.ts.map