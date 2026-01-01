import { mat4 } from "gl-matrix";
import {
    App as PicoApp,
    PicoGL,
    Program,
    Texture,
} from "picogl";

import { createTextureArray } from "../picogl/PicoTexture";
import { Model } from "../rs/model/Model";
import { TokenMaker } from "./TokenMaker";
import tokenVertShader from "./shaders/token.vert.glsl";
import tokenFragShader from "./shaders/token.frag.glsl";

const TEXTURE_SIZE = 128;
const MAX_TEXTURES = 512;

export class TokenMakerRenderer {
    canvas: HTMLCanvasElement;
    tokenMaker: TokenMaker;

    app!: PicoApp;
    gl!: WebGL2RenderingContext;

    program?: Program;
    textureArray?: Texture;

    // Cached model data
    currentNpcId: number | null = null;
    currentSeqId: number | null = null;
    currentFrame: number = -1;

    vao?: WebGLVertexArrayObject;
    vertexBuffer?: WebGLBuffer;
    indexBuffer?: WebGLBuffer;
    indexCount: number = 0;

    // Matrices
    projectionMatrix: mat4 = mat4.create();
    viewMatrix: mat4 = mat4.create();

    // State
    running: boolean = false;
    animationId?: number;

    // Texture mapping
    textureIdIndexMap: Map<number, number> = new Map();
    loadedTextureIds: Set<number> = new Set();

    constructor(canvas: HTMLCanvasElement, tokenMaker: TokenMaker) {
        this.canvas = canvas;
        this.tokenMaker = tokenMaker;
    }

    async init(): Promise<void> {
        this.app = PicoGL.createApp(this.canvas, {
            preserveDrawingBuffer: true,
            alpha: true,
        });
        this.gl = this.app.gl as WebGL2RenderingContext;

        // Create shader program
        this.program = this.app.createProgram(tokenVertShader, tokenFragShader);

        // Initialize texture array
        await this.initTextures();

        // Set up initial camera
        this.updateCamera();
    }

    async initTextures(): Promise<void> {
        const textureLoader = this.tokenMaker.textureLoader;
        const textureIds = textureLoader.getTextureIds();

        // Build texture index mapping
        let textureIndex = 1; // 0 is reserved for no-texture
        for (const id of textureIds) {
            if (textureIndex >= MAX_TEXTURES) break;
            this.textureIdIndexMap.set(id, textureIndex);
            textureIndex++;
        }

        // Create texture array
        const imageData = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4 * MAX_TEXTURES);

        // Load textures
        for (const [id, index] of this.textureIdIndexMap.entries()) {
            const pixels = textureLoader.getPixelsArgb(id, TEXTURE_SIZE, false, 1.0);
            if (pixels) {
                const offset = index * TEXTURE_SIZE * TEXTURE_SIZE * 4;
                for (let j = 0; j < TEXTURE_SIZE * TEXTURE_SIZE; j++) {
                    const argb = pixels[j];
                    const pixelOffset = offset + j * 4;
                    imageData[pixelOffset] = (argb >> 16) & 0xff; // R
                    imageData[pixelOffset + 1] = (argb >> 8) & 0xff; // G
                    imageData[pixelOffset + 2] = argb & 0xff; // B
                    imageData[pixelOffset + 3] = (argb >> 24) & 0xff; // A
                }
                this.loadedTextureIds.add(id);
            }
        }

        this.textureArray = createTextureArray(
            this.app,
            imageData,
            TEXTURE_SIZE,
            TEXTURE_SIZE,
            MAX_TEXTURES,
            {
                internalFormat: PicoGL.RGBA8,
                minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
                magFilter: PicoGL.LINEAR,
                wrapS: PicoGL.CLAMP_TO_EDGE,
                wrapT: PicoGL.CLAMP_TO_EDGE,
            },
        );

        // Generate mipmaps
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.textureArray.texture);
        this.gl.generateMipmap(this.gl.TEXTURE_2D_ARRAY);
    }

    updateCamera(modelSize?: number): void {
        const width = this.canvas.width || 300;
        const height = this.canvas.height || 300;
        const aspect = width / height;

        // Orthographic projection looking down
        // Adjust zoom based on model size (default to reasonable size if unknown)
        const zoom = modelSize ? (modelSize / 128) * 1.5 : 3;
        mat4.ortho(
            this.projectionMatrix,
            -zoom * aspect,
            zoom * aspect,
            -zoom,
            zoom,
            -100,
            100,
        );

        // View matrix: looking straight down (top-down view)
        mat4.identity(this.viewMatrix);
        mat4.rotateX(this.viewMatrix, this.viewMatrix, -Math.PI / 2); // Look down
    }

    calculateModelSize(model: Model): number {
        const verticesX = model.verticesX;
        const verticesZ = model.verticesZ;

        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let i = 0; i < model.verticesCount; i++) {
            minX = Math.min(minX, verticesX[i]);
            maxX = Math.max(maxX, verticesX[i]);
            minZ = Math.min(minZ, verticesZ[i]);
            maxZ = Math.max(maxZ, verticesZ[i]);
        }

        const modelWidth = maxX - minX;
        const modelDepth = maxZ - minZ;
        return Math.max(modelWidth, modelDepth, 100); // minimum size of 100
    }

    buildModelBuffers(model: Model): void {
        const gl = this.gl;

        // Get model faces
        const faces = this.getModelFaces(model);
        if (faces.length === 0) {
            this.indexCount = 0;
            return;
        }

        // Build vertex data
        const vertexData: number[] = [];
        const indices: number[] = [];

        const verticesX = model.verticesX;
        const verticesY = model.verticesY;
        const verticesZ = model.verticesZ;

        const facesA = model.indices1;
        const facesB = model.indices2;
        const facesC = model.indices3;

        const modelTexCoords = model.uvs;

        for (const face of faces) {
            const index = face.index;
            const alpha = face.alpha;
            const priority = face.priority;
            const textureId = face.textureId;
            const textureIndex = this.textureIdIndexMap.get(textureId) ?? -1;

            let hslA = model.faceColors1[index];
            let hslB = model.faceColors2[index];
            let hslC = model.faceColors3[index];

            if (hslC === -1) {
                hslC = hslB = hslA;
            }

            let u0 = 0, v0 = 0, u1 = 0, v1 = 0, u2 = 0, v2 = 0;

            if (modelTexCoords) {
                const texCoordIdx = index * 6;
                u0 = modelTexCoords[texCoordIdx];
                v0 = modelTexCoords[texCoordIdx + 1];
                u1 = modelTexCoords[texCoordIdx + 2];
                v1 = modelTexCoords[texCoordIdx + 3];
                u2 = modelTexCoords[texCoordIdx + 4];
                v2 = modelTexCoords[texCoordIdx + 5];
            }

            const fa = facesA[index];
            const fb = facesB[index];
            const fc = facesC[index];

            const baseIndex = vertexData.length / 3;

            // Add vertex A
            vertexData.push(...this.packVertex(
                verticesX[fa], verticesY[fa], verticesZ[fa],
                hslA, alpha, u0, v0, textureIndex, priority,
            ));
            // Add vertex B
            vertexData.push(...this.packVertex(
                verticesX[fb], verticesY[fb], verticesZ[fb],
                hslB, alpha, u1, v1, textureIndex, priority,
            ));
            // Add vertex C
            vertexData.push(...this.packVertex(
                verticesX[fc], verticesY[fc], verticesZ[fc],
                hslC, alpha, u2, v2, textureIndex, priority,
            ));

            indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        }

        // Clean up old buffers
        if (this.vao) {
            gl.deleteVertexArray(this.vao);
        }
        if (this.vertexBuffer) {
            gl.deleteBuffer(this.vertexBuffer);
        }
        if (this.indexBuffer) {
            gl.deleteBuffer(this.indexBuffer);
        }

        // Create VAO
        this.vao = gl.createVertexArray()!;
        gl.bindVertexArray(this.vao);

        // Create vertex buffer
        const vertexArray = new Uint32Array(vertexData);
        this.vertexBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);

        // Set up vertex attribute (3 x uint32 per vertex)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribIPointer(0, 3, gl.UNSIGNED_INT, 12, 0);

        // Create index buffer
        this.indexBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        this.indexCount = indices.length;
    }

    packVertex(
        x: number, y: number, z: number,
        hsl: number, alpha: number,
        u: number, v: number,
        textureId: number, priority: number,
    ): [number, number, number] {
        const isTextured = textureId !== -1;
        if (isTextured) {
            hsl &= 127;
            hsl |= (textureId & 0x1ff) << 7;
        }

        const xPos = Math.max(0, Math.min(x + 0x4000, 0x8000));
        const yPos = Math.max(0, Math.min(-y + 0x4000, 0x8000));
        const zPos = Math.max(0, Math.min(z + 0x4000, 0x8000));

        priority &= 0x7;

        const uPacked = Math.max(0, Math.min(Math.floor(u * 2048), 0x7ff));
        const vPacked = Math.max(0, Math.min(Math.floor(v * 2048), 0x7ff));

        const v0 = (xPos << 17) | ((uPacked & 0x3f) << 11) | vPacked;
        const v1 = yPos | (hsl << 15) | (Number(isTextured) << 31);
        const v2 =
            (zPos << 17) |
            (alpha << 9) |
            (priority << 6) |
            (((textureId >> 9) & 0x1) << 5) |
            (uPacked >> 6);

        return [v0, v1, v2];
    }

    getModelFaces(model: Model): ModelFace[] {
        const faces: ModelFace[] = [];
        const faceTransparencies = model.faceAlphas;
        const priorities = model.faceRenderPriorities;

        for (let index = 0; index < model.faceCount; index++) {
            const hslC = model.faceColors3[index];
            if (hslC === -2) continue;

            let textureId = -1;
            if (model.faceTextures) {
                textureId = model.faceTextures[index];
            }

            let alpha = 0xff;
            if (faceTransparencies && textureId === -1) {
                alpha = 0xff - (faceTransparencies[index] & 0xff);
            }

            if (alpha === 0 || alpha === 0x1) continue;

            let priority = 0;
            if (priorities) {
                priority = priorities[index];
            }

            faces.push({ index, alpha, priority, textureId });
        }

        return faces;
    }

    start(): void {
        this.running = true;
        this.animationId = requestAnimationFrame(this.frameCallback);
    }

    stop(): void {
        this.running = false;
        if (this.animationId !== undefined) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
    }

    frameCallback = (): void => {
        if (!this.running) return;

        this.render();
        this.animationId = requestAnimationFrame(this.frameCallback);
    };

    render(): void {
        const gl = this.gl;
        const tokenMaker = this.tokenMaker;

        // Resize canvas if needed (with minimum size fallback)
        const displayWidth = Math.max(this.canvas.clientWidth, 1);
        const displayHeight = Math.max(this.canvas.clientHeight, 1);
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            // Recalculate camera with current model if we have one
            if (this.currentNpcId !== null) {
                const model = tokenMaker.getModel();
                if (model) {
                    const modelSize = this.calculateModelSize(model);
                    this.updateCamera(modelSize);
                }
            } else {
                this.updateCamera();
            }
        }

        // Check if we need to rebuild model buffers
        const needsRebuild =
            tokenMaker.selectedNpcId !== this.currentNpcId ||
            tokenMaker.selectedSeqId !== this.currentSeqId ||
            tokenMaker.currentFrame !== this.currentFrame;

        if (needsRebuild) {
            const model = tokenMaker.getModel();
            if (model) {
                this.buildModelBuffers(model);
                // Update camera based on model size
                const modelSize = this.calculateModelSize(model);
                this.updateCamera(modelSize);
                this.currentNpcId = tokenMaker.selectedNpcId;
                this.currentSeqId = tokenMaker.selectedSeqId;
                this.currentFrame = tokenMaker.currentFrame;
            } else {
                this.indexCount = 0;
            }
        }

        // Clear
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (this.indexCount === 0 || !this.program || !this.vao || !this.textureArray) {
            return;
        }

        // Enable depth testing
        gl.enable(gl.DEPTH_TEST);
        // Disable culling for now - top-down view might see "back" faces
        gl.disable(gl.CULL_FACE);

        // Use program
        gl.useProgram(this.program.program);

        // Set uniforms
        const projLoc = gl.getUniformLocation(this.program.program, "u_projectionMatrix");
        const viewLoc = gl.getUniformLocation(this.program.program, "u_viewMatrix");
        const brightnessLoc = gl.getUniformLocation(this.program.program, "u_brightness");
        const colorBandingLoc = gl.getUniformLocation(this.program.program, "u_colorBanding");
        const texturesLoc = gl.getUniformLocation(this.program.program, "u_textures");

        gl.uniformMatrix4fv(projLoc, false, this.projectionMatrix);
        gl.uniformMatrix4fv(viewLoc, false, this.viewMatrix);
        gl.uniform1f(brightnessLoc, 1.0);
        gl.uniform1f(colorBandingLoc, 255.0);

        // Bind texture array
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textureArray.texture);
        gl.uniform1i(texturesLoc, 0);

        // Bind VAO and draw
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
    }

    async exportToken(): Promise<Blob | null> {
        const tokenMaker = this.tokenMaker;
        const resolution = tokenMaker.exportResolution;

        // Create offscreen canvas at target resolution
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = resolution;
        exportCanvas.height = resolution;

        // Create offscreen WebGL context
        const offscreenApp = PicoGL.createApp(exportCanvas, {
            preserveDrawingBuffer: true,
            alpha: true,
        });
        const offscreenGl = offscreenApp.gl as WebGL2RenderingContext;

        // Create program for offscreen rendering
        const offscreenProgram = offscreenApp.createProgram(tokenVertShader, tokenFragShader);

        // Get model
        const model = tokenMaker.getModel();
        if (!model) return null;

        // Build vertex buffers for offscreen
        const faces = this.getModelFaces(model);
        if (faces.length === 0) return null;

        const vertexData: number[] = [];
        const indices: number[] = [];

        const verticesX = model.verticesX;
        const verticesY = model.verticesY;
        const verticesZ = model.verticesZ;

        const facesA = model.indices1;
        const facesB = model.indices2;
        const facesC = model.indices3;

        const modelTexCoords = model.uvs;

        for (const face of faces) {
            const index = face.index;
            const alpha = face.alpha;
            const priority = face.priority;
            const textureId = face.textureId;
            const textureIndex = this.textureIdIndexMap.get(textureId) ?? -1;

            let hslA = model.faceColors1[index];
            let hslB = model.faceColors2[index];
            let hslC = model.faceColors3[index];

            if (hslC === -1) {
                hslC = hslB = hslA;
            }

            let u0 = 0, v0 = 0, u1 = 0, v1 = 0, u2 = 0, v2 = 0;

            if (modelTexCoords) {
                const texCoordIdx = index * 6;
                u0 = modelTexCoords[texCoordIdx];
                v0 = modelTexCoords[texCoordIdx + 1];
                u1 = modelTexCoords[texCoordIdx + 2];
                v1 = modelTexCoords[texCoordIdx + 3];
                u2 = modelTexCoords[texCoordIdx + 4];
                v2 = modelTexCoords[texCoordIdx + 5];
            }

            const fa = facesA[index];
            const fb = facesB[index];
            const fc = facesC[index];

            const baseIndex = vertexData.length / 3;

            vertexData.push(...this.packVertex(
                verticesX[fa], verticesY[fa], verticesZ[fa],
                hslA, alpha, u0, v0, textureIndex, priority,
            ));
            vertexData.push(...this.packVertex(
                verticesX[fb], verticesY[fb], verticesZ[fb],
                hslB, alpha, u1, v1, textureIndex, priority,
            ));
            vertexData.push(...this.packVertex(
                verticesX[fc], verticesY[fc], verticesZ[fc],
                hslC, alpha, u2, v2, textureIndex, priority,
            ));

            indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        }

        // Create VAO
        const vao = offscreenGl.createVertexArray()!;
        offscreenGl.bindVertexArray(vao);

        // Create vertex buffer
        const vertexBuffer = offscreenGl.createBuffer()!;
        offscreenGl.bindBuffer(offscreenGl.ARRAY_BUFFER, vertexBuffer);
        offscreenGl.bufferData(offscreenGl.ARRAY_BUFFER, new Uint32Array(vertexData), offscreenGl.STATIC_DRAW);

        // Set up vertex attribute
        offscreenGl.enableVertexAttribArray(0);
        offscreenGl.vertexAttribIPointer(0, 3, offscreenGl.UNSIGNED_INT, 12, 0);

        // Create index buffer
        const indexBuffer = offscreenGl.createBuffer()!;
        offscreenGl.bindBuffer(offscreenGl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        offscreenGl.bufferData(offscreenGl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), offscreenGl.STATIC_DRAW);

        offscreenGl.bindVertexArray(null);

        // Calculate model bounds for camera
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < model.verticesCount; i++) {
            minX = Math.min(minX, verticesX[i]);
            maxX = Math.max(maxX, verticesX[i]);
            minZ = Math.min(minZ, verticesZ[i]);
            maxZ = Math.max(maxZ, verticesZ[i]);
        }
        const modelWidth = maxX - minX;
        const modelDepth = maxZ - minZ;
        const modelSize = Math.max(modelWidth, modelDepth);
        const zoom = (modelSize / 128) * 1.5;

        // Set up camera
        const projectionMatrix = mat4.create();
        const viewMatrix = mat4.create();
        mat4.ortho(projectionMatrix, -zoom, zoom, -zoom, zoom, -100, 100);
        mat4.identity(viewMatrix);
        mat4.rotateX(viewMatrix, viewMatrix, -Math.PI / 2);

        // Clear with transparency
        offscreenGl.viewport(0, 0, resolution, resolution);
        offscreenGl.clearColor(0, 0, 0, 0);
        offscreenGl.clear(offscreenGl.COLOR_BUFFER_BIT | offscreenGl.DEPTH_BUFFER_BIT);

        offscreenGl.enable(offscreenGl.DEPTH_TEST);
        // Disable culling - top-down view might see "back" faces
        offscreenGl.disable(offscreenGl.CULL_FACE);

        // Use program and set uniforms
        offscreenGl.useProgram(offscreenProgram.program);

        const projLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_projectionMatrix");
        const viewLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_viewMatrix");
        const brightnessLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_brightness");
        const colorBandingLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_colorBanding");
        const texturesLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_textures");

        offscreenGl.uniformMatrix4fv(projLoc, false, projectionMatrix);
        offscreenGl.uniformMatrix4fv(viewLoc, false, viewMatrix);
        offscreenGl.uniform1f(brightnessLoc, 1.0);
        offscreenGl.uniform1f(colorBandingLoc, 255.0);

        // Bind texture array
        offscreenGl.activeTexture(offscreenGl.TEXTURE0);
        offscreenGl.bindTexture(offscreenGl.TEXTURE_2D_ARRAY, this.textureArray!.texture);
        offscreenGl.uniform1i(texturesLoc, 0);

        // Draw
        offscreenGl.bindVertexArray(vao);
        offscreenGl.drawElements(offscreenGl.TRIANGLES, indices.length, offscreenGl.UNSIGNED_INT, 0);
        offscreenGl.bindVertexArray(null);

        // Read pixels and apply token effects
        const pixels = new Uint8Array(resolution * resolution * 4);
        offscreenGl.readPixels(0, 0, resolution, resolution, offscreenGl.RGBA, offscreenGl.UNSIGNED_BYTE, pixels);

        // Create 2D canvas for post-processing
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = resolution;
        finalCanvas.height = resolution;
        const ctx = finalCanvas.getContext("2d")!;

        // Create ImageData from pixels (flip Y)
        const imageData = ctx.createImageData(resolution, resolution);
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const srcIdx = ((resolution - 1 - y) * resolution + x) * 4;
                const dstIdx = (y * resolution + x) * 4;
                imageData.data[dstIdx] = pixels[srcIdx];
                imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
                imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
                imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
            }
        }
        ctx.putImageData(imageData, 0, 0);

        // Apply circular mask with border
        const borderWidth = tokenMaker.borderWidth;
        const borderColor = tokenMaker.borderColor;
        const innerRadius = resolution / 2 - borderWidth;

        // Apply circular mask
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = resolution;
        maskCanvas.height = resolution;
        const maskCtx = maskCanvas.getContext("2d")!;

        maskCtx.drawImage(finalCanvas, 0, 0);
        maskCtx.globalCompositeOperation = "destination-in";
        maskCtx.beginPath();
        maskCtx.arc(resolution / 2, resolution / 2, innerRadius, 0, Math.PI * 2);
        maskCtx.fill();

        // Draw border
        maskCtx.globalCompositeOperation = "source-over";
        maskCtx.strokeStyle = borderColor;
        maskCtx.lineWidth = borderWidth;
        maskCtx.beginPath();
        maskCtx.arc(resolution / 2, resolution / 2, resolution / 2 - borderWidth / 2, 0, Math.PI * 2);
        maskCtx.stroke();

        // Clean up
        offscreenGl.deleteBuffer(vertexBuffer);
        offscreenGl.deleteBuffer(indexBuffer);
        offscreenGl.deleteVertexArray(vao);

        // Export as PNG
        return new Promise((resolve) => {
            maskCanvas.toBlob(resolve, "image/png");
        });
    }
}

type ModelFace = {
    index: number;
    alpha: number;
    priority: number;
    textureId: number;
};
