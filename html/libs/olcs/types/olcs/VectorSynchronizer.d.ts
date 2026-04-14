import olcsAbstractSynchronizer from './AbstractSynchronizer';
import olcsFeatureConverter from './FeatureConverter';
import type VectorLayerCounterpart from './core/VectorLayerCounterpart';
import type Map from 'ol/Map.js';
import { type LayerWithParents } from './core';
import type { PrimitiveCollection, Scene } from 'cesium';
export default class VectorSynchronizer extends olcsAbstractSynchronizer<VectorLayerCounterpart> {
    protected converter: olcsFeatureConverter;
    private csAllPrimitives_;
    /**
     * Unidirectionally synchronize OpenLayers vector layers to Cesium.
     */
    constructor(map: Map, scene: Scene, opt_converter?: olcsFeatureConverter);
    addCesiumObject(counterpart: VectorLayerCounterpart): void;
    destroyCesiumObject(object: VectorLayerCounterpart): void;
    removeSingleCesiumObject(object: VectorLayerCounterpart, destroy: boolean): void;
    removeAllCesiumObjects(destroy: boolean): void;
    /**
     * Synchronizes the layer visibility properties
     * to the given Cesium Primitive.
     */
    updateLayerVisibility(olLayerWithParents: LayerWithParents, csPrimitive: PrimitiveCollection): void;
    createSingleLayerCounterparts(olLayerWithParents: LayerWithParents): VectorLayerCounterpart[];
}
//# sourceMappingURL=VectorSynchronizer.d.ts.map