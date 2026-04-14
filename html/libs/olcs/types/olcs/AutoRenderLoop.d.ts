import type OLCesium from './OLCesium';
/**
 * By default Cesium (used to?) renders as often as possible.
 * This is a waste of resources (CPU/GPU/battery).
 * An alternative mechanism in Cesium is on-demand rendering.
 * This class makes use of this alternative method and add some additionnal render points.
 */
export default class AutoRenderLoop {
    ol3d: OLCesium;
    private scene_;
    private canvas_;
    private _boundNotifyRepaintRequired;
    private repaintEventNames_;
    /**
     * @param ol3d
     */
    constructor(ol3d: OLCesium);
    /**
     * Enable.
     */
    enable(): void;
    /**
     * Disable.
     */
    disable(): void;
    /**
     * Restart render loop.
     * Force a restart of the render loop.
     */
    restartRenderLoop(): void;
    notifyRepaintRequired(): void;
}
//# sourceMappingURL=AutoRenderLoop.d.ts.map