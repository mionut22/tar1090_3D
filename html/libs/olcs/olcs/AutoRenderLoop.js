/**
 * By default Cesium (used to?) renders as often as possible.
 * This is a waste of resources (CPU/GPU/battery).
 * An alternative mechanism in Cesium is on-demand rendering.
 * This class makes use of this alternative method and add some additionnal render points.
 */
export default class AutoRenderLoop {
    ol3d;
    scene_;
    canvas_;
    _boundNotifyRepaintRequired;
    repaintEventNames_ = [
        'mousemove', 'mousedown', 'mouseup',
        'touchstart', 'touchend', 'touchmove',
        'pointerdown', 'pointerup', 'pointermove',
        'wheel'
    ];
    /**
     * @param ol3d
     */
    constructor(ol3d) {
        this.ol3d = ol3d;
        this.scene_ = ol3d.getCesiumScene();
        this.canvas_ = this.scene_.canvas;
        this._boundNotifyRepaintRequired = this.notifyRepaintRequired.bind(this);
        this.enable();
    }
    /**
     * Enable.
     */
    enable() {
        this.scene_.requestRenderMode = true;
        this.scene_.maximumRenderTimeChange = 1000;
        for (const repaintKey of this.repaintEventNames_) {
            this.canvas_.addEventListener(repaintKey, this._boundNotifyRepaintRequired, false);
        }
        window.addEventListener('resize', this._boundNotifyRepaintRequired, false);
        // Listen for changes on the layer group
        this.ol3d.getOlMap().getLayerGroup().on('change', this._boundNotifyRepaintRequired);
    }
    /**
     * Disable.
     */
    disable() {
        for (const repaintKey of this.repaintEventNames_) {
            this.canvas_.removeEventListener(repaintKey, this._boundNotifyRepaintRequired, false);
        }
        window.removeEventListener('resize', this._boundNotifyRepaintRequired, false);
        this.ol3d.getOlMap().getLayerGroup().un('change', this._boundNotifyRepaintRequired);
        this.scene_.requestRenderMode = false;
    }
    /**
     * Restart render loop.
     * Force a restart of the render loop.
     */
    restartRenderLoop() {
        this.notifyRepaintRequired();
    }
    notifyRepaintRequired() {
        if (!this.scene_.isDestroyed()) {
            this.scene_.requestRender();
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXV0b1JlbmRlckxvb3AuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvb2xjcy9BdXRvUmVuZGVyTG9vcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFHQTs7Ozs7R0FLRztBQUNILE1BQU0sQ0FBQyxPQUFPLE9BQU8sY0FBYztJQUNqQyxJQUFJLENBQVc7SUFDUCxNQUFNLENBQVE7SUFDZCxPQUFPLENBQW9CO0lBQzNCLDJCQUEyQixDQUFvQztJQUMvRCxrQkFBa0IsR0FBRztRQUMzQixXQUFXLEVBQUUsV0FBVyxFQUFFLFNBQVM7UUFDbkMsWUFBWSxFQUFFLFVBQVUsRUFBRSxXQUFXO1FBQ3JDLGFBQWEsRUFBRSxXQUFXLEVBQUUsYUFBYTtRQUN6QyxPQUFPO0tBQ0MsQ0FBQztJQUVYOztPQUVHO0lBQ0gsWUFBWSxJQUFjO1FBQ3hCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDbEMsSUFBSSxDQUFDLDJCQUEyQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU07UUFDSixJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQztRQUNyQyxJQUFJLENBQUMsTUFBTSxDQUFDLHVCQUF1QixHQUFHLElBQUksQ0FBQztRQUMzQyxLQUFLLE1BQU0sVUFBVSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ2pELElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQywyQkFBMkIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNyRixDQUFDO1FBRUQsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFM0Usd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsYUFBYSxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUN0RixDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPO1FBQ0wsS0FBSyxNQUFNLFVBQVUsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUNqRCxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEYsQ0FBQztRQUVELE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLDJCQUEyQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTlFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsYUFBYSxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsMkJBQTJCLENBQUMsQ0FBQztRQUNwRixJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQztJQUN4QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsaUJBQWlCO1FBQ2YsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7SUFDL0IsQ0FBQztJQUVELHFCQUFxQjtRQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDOUIsQ0FBQztJQUNILENBQUM7Q0FDRiJ9