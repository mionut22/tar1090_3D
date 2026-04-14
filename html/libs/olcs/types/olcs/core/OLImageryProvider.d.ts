/// <reference path="../FeatureConverter.d.ts" />
import { type TileImage } from 'ol/source.js';
import type { Map } from 'ol';
import type { Projection } from 'ol/proj.js';
import type { Credit, Event, ImageryLayerFeatureInfo, ImageryProvider, ImageryTypes, Proxy, Rectangle, Request, TileDiscardPolicy, TilingScheme } from 'cesium';
export declare function createEmptyCanvas(): HTMLCanvasElement;
export default class OLImageryProvider implements ImageryProvider {
    private source_;
    private projection_;
    private fallbackProj_;
    private map_;
    private shouldRequestNextLevel;
    private emptyCanvas_;
    private emptyCanvasPromise_;
    private tilingScheme_;
    private ready_;
    private rectangle_;
    /**
   * When <code>true</code>, this model is ready to render, i.e., the external binary, image,
   * and shader files were downloaded and the WebGL resources were created.
   */
    get ready(): boolean;
    /**
   * Gets the rectangle, in radians, of the imagery provided by the instance.
   */
    get rectangle(): Rectangle;
    /**
     * Gets the tiling scheme used by the provider.
     */
    get tilingScheme(): TilingScheme;
    /**
     * Gets an event that is raised when the imagery provider encounters an asynchronous error.  By subscribing
     * to the event, you will be notified of the error and can potentially recover from it.  Event listeners
     * are passed an instance of {@link Cesium.TileProviderError}.
     */
    readonly errorEvent: Event;
    /**
     * Gets the credit to display when this imagery provider is active.  Typically this is used to credit
     * the source of the imagery.
     */
    readonly credit: Credit;
    /**
     * Gets the proxy used by this provider.
     */
    readonly proxy: Proxy;
    get _ready(): boolean;
    /**
     * Gets the width of each tile, in pixels.
     */
    get tileWidth(): number;
    /**
     * Gets the height of each tile, in pixels.
     */
    get tileHeight(): number;
    /**
     * Gets the maximum level-of-detail that can be requested.
     */
    get maximumLevel(): number;
    /**
     * Gets the minimum level-of-detail that can be requested.  Generally,
     * a minimum level should only be used when the rectangle of the imagery is small
     * enough that the number of tiles at the minimum level is small.  An imagery
     * provider with more than a few tiles at the minimum level will lead to
     * rendering problems.
     */
    get minimumLevel(): number;
    /**
     * Gets the tile discard policy.  If not undefined, the discard policy is responsible
     * for filtering out "missing" tiles via its shouldDiscardImage function.  If this function
     * returns undefined, no tiles are filtered.
     */
    get tileDiscardPolicy(): TileDiscardPolicy;
    /**
     * Gets a value indicating whether or not the images provided by this imagery provider
     * include an alpha channel.  If this property is false, an alpha channel, if present, will
     * be ignored.  If this property is true, any images without an alpha channel will be treated
     * as if their alpha is 1.0 everywhere.  When this property is false, memory usage
     * and texture upload time are reduced.
     */
    get hasAlphaChannel(): boolean;
    /**
     * Asynchronously determines what features, if any, are located at a given longitude and latitude within
     * a tile.
     * This function is optional, so it may not exist on all ImageryProviders.
     * @param x - The tile X coordinate.
     * @param y - The tile Y coordinate.
     * @param level - The tile level.
     * @param longitude - The longitude at which to pick features.
     * @param latitude - The latitude at which to pick features.
     * @return A promise for the picked features that will resolve when the asynchronous
     *                   picking completes.  The resolved value is an array of {@link ImageryLayerFeatureInfo}
     *                   instances.  The array may be empty if no features are found at the given location.
     *                   It may also be undefined if picking is not supported.
     */
    pickFeatures(x: number, y: number, level: number, longitude: number, latitude: number): Promise<ImageryLayerFeatureInfo[]> | undefined;
    /**
     * Special class derived from Cesium.ImageryProvider
     * that is connected to the given ol.source.TileImage.
     * @param olMap OL map
     * @param source Tile image source
     * @param [opt_fallbackProj] Projection to assume if source has no projection
     */
    constructor(olMap: Map, source: TileImage, opt_fallbackProj: Projection);
    /**
     * Checks if the underlying source is ready and cached required data.
     */
    private handleSourceChanged_;
    /**
     * Generates the proper attributions for a given position and zoom
     * level.
     * @implements
     */
    getTileCredits(x: number, y: number, level: number): Credit[];
    /**
     * @implements
     */
    requestImage(x: number, y: number, level: number, request?: Request): Promise<ImageryTypes> | undefined;
}
//# sourceMappingURL=OLImageryProvider.d.ts.map