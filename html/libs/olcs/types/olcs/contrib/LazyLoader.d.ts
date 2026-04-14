export default class LazyLoader {
    private promise;
    private url_;
    /**
     * @param url
     * @api
     */
    constructor(url: string);
    /**
     * Load Cesium by injecting a script tag.
     * @api
     */
    load(): Promise<void>;
}
//# sourceMappingURL=LazyLoader.d.ts.map