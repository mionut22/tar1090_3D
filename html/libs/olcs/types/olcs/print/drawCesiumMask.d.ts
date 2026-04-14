/// <reference path="../FeatureConverter.d.ts" />
import type { Scene } from 'cesium';
export declare class MaskDrawer {
    private gl;
    private programInfo;
    private positionBuffer;
    constructor(gl: WebGL2RenderingContext | WebGLRenderingContext);
    getVertexShaderSource(): string;
    getFragmentShaderSource(): string;
    /**
     *
     */
    private initShaderProgram;
    /**
     *
     * @param {number[]} scaling scaling
     */
    drawMask(scaling: number[]): void;
    /**
     */
    private static loadShader;
}
/**
 *
 */
export declare function autoDrawMask(scene: Scene, getScalings: () => number[]): void;
//# sourceMappingURL=drawCesiumMask.d.ts.map