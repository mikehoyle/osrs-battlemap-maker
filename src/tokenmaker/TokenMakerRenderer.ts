import { mat4 } from "gl-matrix";
import {
    App as PicoApp,
    PicoGL,
    Program,
    Texture,
} from "picogl";

import { createTextureArray } from "../picogl/PicoTexture";
import { Model } from "../rs/model/Model";
import { TokenMaker, TextureFilterMode, getMaxAnisotropy } from "./TokenMaker";
import tokenVertShader from "./shaders/token.vert.glsl";
import tokenFragShader from "./shaders/token.frag.glsl";
import tokenHdVertShader from "./shaders/token-hd.vert.glsl";
import tokenHdFragShader from "./shaders/token-hd.frag.glsl";
import tokenShadowVertShader from "./shaders/token-shadow.vert.glsl";
import tokenShadowFragShader from "./shaders/token-shadow.frag.glsl";

const TEXTURE_SIZE = 128;
const MAX_TEXTURES = 512;

export class TokenMakerRenderer {
    canvas: HTMLCanvasElement;
    overlayCanvas: HTMLCanvasElement;
    tokenMaker: TokenMaker;

    app!: PicoApp;
    gl!: WebGL2RenderingContext;

    program?: Program;
    hdProgram?: Program;
    shadowProgram?: Program;
    textureArray?: Texture;

    // Cached model data
    currentNpcId: number | null = null;
    currentSeqId: number | null = null;
    currentFrame: number = -1;

    vao?: WebGLVertexArrayObject;
    vertexBuffer?: WebGLBuffer;
    normalBuffer?: WebGLBuffer;
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

    // Current settings (for change detection)
    currentTextureFilterMode: TextureFilterMode = TextureFilterMode.ANISOTROPIC_16X;
    currentSmoothModel: boolean = false;

    // Model ground level (minimum Y for shadow projection)
    modelGroundLevel: number = 0;

    // Current zoom level for offset calculations
    currentZoom: number = 1.5;

    // Track model offset for change detection
    currentModelOffsetX: number = 0;
    currentModelOffsetY: number = 0;

    // Track model rotation for change detection
    currentModelRotation: number = 0;

    constructor(canvas: HTMLCanvasElement, tokenMaker: TokenMaker, overlayCanvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.overlayCanvas = overlayCanvas;
        this.tokenMaker = tokenMaker;
    }

    async init(): Promise<void> {
        this.app = PicoGL.createApp(this.canvas, {
            preserveDrawingBuffer: true,
            alpha: true,
        });
        this.gl = this.app.gl as WebGL2RenderingContext;

        // Create shader programs
        this.program = this.app.createProgram(tokenVertShader, tokenFragShader);
        this.hdProgram = this.app.createProgram(tokenHdVertShader, tokenHdFragShader);
        this.shadowProgram = this.app.createProgram(tokenShadowVertShader, tokenShadowFragShader);

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
                wrapS: PicoGL.CLAMP_TO_EDGE,
                wrapT: PicoGL.CLAMP_TO_EDGE,
            },
        );

        // Generate mipmaps
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.textureArray.texture);
        this.gl.generateMipmap(this.gl.TEXTURE_2D_ARRAY);

        // Apply initial texture filtering
        this.updateTextureFiltering();
    }

    updateTextureFiltering(): void {
        if (!this.textureArray) {
            return;
        }

        const mode = this.tokenMaker.textureFilterMode;
        this.currentTextureFilterMode = mode;

        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.textureArray.texture);

        if (mode === TextureFilterMode.DISABLED) {
            this.gl.texParameteri(
                this.gl.TEXTURE_2D_ARRAY,
                this.gl.TEXTURE_MIN_FILTER,
                this.gl.NEAREST,
            );
            this.gl.texParameteri(
                this.gl.TEXTURE_2D_ARRAY,
                this.gl.TEXTURE_MAG_FILTER,
                this.gl.NEAREST,
            );
        } else if (mode === TextureFilterMode.BILINEAR) {
            this.gl.texParameteri(
                this.gl.TEXTURE_2D_ARRAY,
                this.gl.TEXTURE_MIN_FILTER,
                this.gl.LINEAR_MIPMAP_NEAREST,
            );
            this.gl.texParameteri(
                this.gl.TEXTURE_2D_ARRAY,
                this.gl.TEXTURE_MAG_FILTER,
                this.gl.LINEAR,
            );
        } else {
            this.gl.texParameteri(
                this.gl.TEXTURE_2D_ARRAY,
                this.gl.TEXTURE_MIN_FILTER,
                this.gl.LINEAR_MIPMAP_LINEAR,
            );
            this.gl.texParameteri(
                this.gl.TEXTURE_2D_ARRAY,
                this.gl.TEXTURE_MAG_FILTER,
                this.gl.LINEAR,
            );
        }

        // Apply anisotropic filtering if supported
        const ext = this.gl.getExtension("EXT_texture_filter_anisotropic");
        if (ext) {
            const maxAniso = this.gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            const anisotropy = Math.min(getMaxAnisotropy(mode), maxAniso);
            this.gl.texParameterf(
                this.gl.TEXTURE_2D_ARRAY,
                ext.TEXTURE_MAX_ANISOTROPY_EXT,
                anisotropy,
            );
        }
    }

    updateCamera(modelSize?: number): void {
        const width = this.canvas.width || 300;
        const height = this.canvas.height || 300;
        const aspect = width / height;

        // Orthographic projection looking down
        // Adjust zoom based on model size (default to reasonable size if unknown)
        // Lower multiplier = larger token in frame (0.65 fills ~70-75% of frame)
        const zoom = modelSize ? (modelSize / 128) * 0.65 : 1.5;
        this.currentZoom = zoom;

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

        // Apply model offset (translate in world space before rotation)
        // After -90° X rotation: World X → Screen X, World Z → Screen Y, World Y → depth
        // Offset is normalized -0.5 to 0.5, multiply by zoom * 2 to get world units
        const offsetX = this.tokenMaker.modelOffsetX * zoom * 2 * aspect;
        const offsetZ = this.tokenMaker.modelOffsetY * zoom * 2; // World Z for screen vertical
        if (offsetX !== 0 || offsetZ !== 0) {
            mat4.translate(this.viewMatrix, this.viewMatrix, [offsetX, 0, offsetZ]);
        }
        this.currentModelOffsetX = this.tokenMaker.modelOffsetX;
        this.currentModelOffsetY = this.tokenMaker.modelOffsetY;

        // Apply model rotation around Y axis (rotates the model when viewed from above)
        const rotationRadians = (this.tokenMaker.modelRotation * Math.PI) / 180;
        if (rotationRadians !== 0) {
            mat4.rotateY(this.viewMatrix, this.viewMatrix, rotationRadians);
        }
        this.currentModelRotation = this.tokenMaker.modelRotation;
    }

    calculateModelSize(model: Model): number {
        const verticesX = model.verticesX;
        const verticesY = model.verticesY;
        const verticesZ = model.verticesZ;

        let minX = Infinity, maxX = -Infinity;
        let maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let i = 0; i < model.verticesCount; i++) {
            minX = Math.min(minX, verticesX[i]);
            maxX = Math.max(maxX, verticesX[i]);
            maxY = Math.max(maxY, verticesY[i]);
            minZ = Math.min(minZ, verticesZ[i]);
            maxZ = Math.max(maxZ, verticesZ[i]);
        }

        // Store ground level for shadow projection
        // In OSRS, Y=0 is typically ground, negative Y is up
        // maxY is the feet/ground level of the model
        this.modelGroundLevel = maxY / 128.0;

        const modelWidth = maxX - minX;
        const modelDepth = maxZ - minZ;
        return Math.max(modelWidth, modelDepth, 100); // minimum size of 100
    }

    buildModelBuffers(model: Model): void {
        const gl = this.gl;
        const smoothModel = this.tokenMaker.smoothModel;
        this.currentSmoothModel = smoothModel;

        // Get model faces
        const faces = this.getModelFaces(model);
        if (faces.length === 0) {
            this.indexCount = 0;
            return;
        }

        // Build vertex data
        const vertexData: number[] = [];
        const normalData: number[] = [];
        const indices: number[] = [];

        const verticesX = model.verticesX;
        const verticesY = model.verticesY;
        const verticesZ = model.verticesZ;

        const facesA = model.indices1;
        const facesB = model.indices2;
        const facesC = model.indices3;

        const modelTexCoords = model.uvs;

        // For smooth shading, first compute vertex normals
        // vertexNormals[vertexIndex] = accumulated normal for that vertex
        const vertexNormals: Map<number, { x: number; y: number; z: number }> = new Map();

        if (smoothModel) {
            // First pass: compute and accumulate face normals to vertices
            for (const face of faces) {
                const index = face.index;
                const fa = facesA[index];
                const fb = facesB[index];
                const fc = facesC[index];

                // Get vertex positions
                const ax = verticesX[fa], ay = verticesY[fa], az = verticesZ[fa];
                const bx = verticesX[fb], by = verticesY[fb], bz = verticesZ[fb];
                const cx = verticesX[fc], cy = verticesY[fc], cz = verticesZ[fc];

                // Compute face normal using cross product
                const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
                const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

                const nx = e1y * e2z - e1z * e2y;
                const ny = e1z * e2x - e1x * e2z;
                const nz = e1x * e2y - e1y * e2x;

                // Accumulate face normal to each vertex of the face
                for (const vertIdx of [fa, fb, fc]) {
                    const existing = vertexNormals.get(vertIdx);
                    if (existing) {
                        existing.x += nx;
                        existing.y += ny;
                        existing.z += nz;
                    } else {
                        vertexNormals.set(vertIdx, { x: nx, y: ny, z: nz });
                    }
                }
            }

            // Normalize accumulated normals
            for (const [, normal] of vertexNormals) {
                const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
                if (len > 0.0001) {
                    normal.x /= len;
                    normal.y /= len;
                    normal.z /= len;
                }
            }
        }

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

            // Pack normals for each vertex
            if (smoothModel) {
                const nA = vertexNormals.get(fa) || { x: 0, y: 1, z: 0 };
                const nB = vertexNormals.get(fb) || { x: 0, y: 1, z: 0 };
                const nC = vertexNormals.get(fc) || { x: 0, y: 1, z: 0 };
                normalData.push(this.packNormal(nA.x, nA.y, nA.z));
                normalData.push(this.packNormal(nB.x, nB.y, nB.z));
                normalData.push(this.packNormal(nC.x, nC.y, nC.z));
            } else {
                // For flat shading, compute face normal
                const ax = verticesX[fa], ay = verticesY[fa], az = verticesZ[fa];
                const bx = verticesX[fb], by = verticesY[fb], bz = verticesZ[fb];
                const cx = verticesX[fc], cy = verticesY[fc], cz = verticesZ[fc];

                const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
                const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

                let nx = e1y * e2z - e1z * e2y;
                let ny = e1z * e2x - e1x * e2z;
                let nz = e1x * e2y - e1y * e2x;

                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (len > 0.0001) {
                    nx /= len;
                    ny /= len;
                    nz /= len;
                }

                const packedNormal = this.packNormal(nx, ny, nz);
                normalData.push(packedNormal);
                normalData.push(packedNormal);
                normalData.push(packedNormal);
            }

            indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        }

        // Clean up old buffers
        if (this.vao) {
            gl.deleteVertexArray(this.vao);
        }
        if (this.vertexBuffer) {
            gl.deleteBuffer(this.vertexBuffer);
        }
        if (this.normalBuffer) {
            gl.deleteBuffer(this.normalBuffer);
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

        // Create normal buffer
        const normalArray = new Uint32Array(normalData);
        this.normalBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normalArray, gl.STATIC_DRAW);

        // Set up normal attribute (1 x uint32 per vertex)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 4, 0);

        // Create index buffer
        this.indexBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        this.indexCount = indices.length;
    }

    // Pack a normalized normal into a uint32
    // Format: nx (10 bits) | ny (10 bits) | nz (10 bits) | 2 unused
    packNormal(nx: number, ny: number, nz: number): number {
        // Convert from -1..1 to 0..1023 (10-bit unsigned with sign encoding)
        // We use two's complement style: values 0-511 are positive, 512-1023 are negative
        const packComponent = (v: number): number => {
            const scaled = Math.round(v * 511);
            if (scaled < 0) {
                return (scaled + 1024) & 0x3FF; // Two's complement in 10 bits
            }
            return scaled & 0x3FF;
        };

        const nxPacked = packComponent(nx);
        const nyPacked = packComponent(ny);
        const nzPacked = packComponent(nz);

        return (nxPacked << 22) | (nyPacked << 12) | (nzPacked << 2);
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

        // Check if texture filtering changed
        if (tokenMaker.textureFilterMode !== this.currentTextureFilterMode) {
            this.updateTextureFiltering();
        }

        // Check if model offset or rotation changed (needs camera update)
        if (
            tokenMaker.modelOffsetX !== this.currentModelOffsetX ||
            tokenMaker.modelOffsetY !== this.currentModelOffsetY ||
            tokenMaker.modelRotation !== this.currentModelRotation
        ) {
            const model = tokenMaker.getModel();
            if (model) {
                const modelSize = this.calculateModelSize(model);
                this.updateCamera(modelSize);
            } else {
                this.updateCamera();
            }
        }

        // Check if we need to rebuild model buffers
        const needsRebuild =
            tokenMaker.selectedNpcId !== this.currentNpcId ||
            tokenMaker.selectedSeqId !== this.currentSeqId ||
            tokenMaker.currentFrame !== this.currentFrame ||
            tokenMaker.smoothModel !== this.currentSmoothModel;

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

        // Clear with transparent background so underlay shows through
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (this.indexCount === 0 || !this.program || !this.hdProgram || !this.shadowProgram || !this.vao || !this.textureArray) {
            return;
        }

        // Enable depth testing
        gl.enable(gl.DEPTH_TEST);
        // Disable culling for now - top-down view might see "back" faces
        gl.disable(gl.CULL_FACE);

        // Render shadow pass first (if enabled)
        if (tokenMaker.shadowEnabled) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            gl.useProgram(this.shadowProgram.program);

            const shadowProjLoc = gl.getUniformLocation(this.shadowProgram.program, "u_projectionMatrix");
            const shadowViewLoc = gl.getUniformLocation(this.shadowProgram.program, "u_viewMatrix");
            const groundLevelLoc = gl.getUniformLocation(this.shadowProgram.program, "u_groundLevel");
            const lightDirLoc = gl.getUniformLocation(this.shadowProgram.program, "u_lightDirection");
            const shadowOpacityLoc = gl.getUniformLocation(this.shadowProgram.program, "u_shadowOpacity");

            gl.uniformMatrix4fv(shadowProjLoc, false, this.projectionMatrix);
            gl.uniformMatrix4fv(shadowViewLoc, false, this.viewMatrix);
            gl.uniform1f(groundLevelLoc, this.modelGroundLevel);
            // Use light direction from user control
            const shadowLightDir = tokenMaker.getLightDirection();
            gl.uniform3f(lightDirLoc, shadowLightDir[0], shadowLightDir[1], shadowLightDir[2]);
            gl.uniform1f(shadowOpacityLoc, tokenMaker.shadowOpacity);

            gl.bindVertexArray(this.vao);
            gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
            gl.bindVertexArray(null);

            // Clear depth buffer so model renders on top of shadow
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.disable(gl.BLEND);
        }

        // Choose program based on HD setting
        const activeProgram = tokenMaker.hdEnabled ? this.hdProgram : this.program;
        gl.useProgram(activeProgram.program);

        // Set common uniforms
        const projLoc = gl.getUniformLocation(activeProgram.program, "u_projectionMatrix");
        const viewLoc = gl.getUniformLocation(activeProgram.program, "u_viewMatrix");
        const brightnessLoc = gl.getUniformLocation(activeProgram.program, "u_brightness");
        const colorBandingLoc = gl.getUniformLocation(activeProgram.program, "u_colorBanding");
        const texturesLoc = gl.getUniformLocation(activeProgram.program, "u_textures");

        gl.uniformMatrix4fv(projLoc, false, this.projectionMatrix);
        gl.uniformMatrix4fv(viewLoc, false, this.viewMatrix);
        // Convert brightness from 0-4 scale to internal format (higher value = darker)
        const brightness = 1.0 - tokenMaker.brightness * 0.1;
        gl.uniform1f(brightnessLoc, brightness);
        gl.uniform1f(colorBandingLoc, 255.0);

        // Set HD-specific uniforms
        if (tokenMaker.hdEnabled) {
            const lightDirLoc = gl.getUniformLocation(activeProgram.program, "u_lightDirection");
            const ambientLoc = gl.getUniformLocation(activeProgram.program, "u_ambientStrength");
            const diffuseLoc = gl.getUniformLocation(activeProgram.program, "u_diffuseStrength");
            const specularLoc = gl.getUniformLocation(activeProgram.program, "u_specularStrength");
            const shininessLoc = gl.getUniformLocation(activeProgram.program, "u_shininess");
            const smoothShadingLoc = gl.getUniformLocation(activeProgram.program, "u_smoothShading");

            // Use light direction from user control
            const hdLightDir = tokenMaker.getLightDirection();
            gl.uniform3f(lightDirLoc, hdLightDir[0], hdLightDir[1], hdLightDir[2]);
            gl.uniform1f(ambientLoc, 0.35);
            gl.uniform1f(diffuseLoc, 0.6);
            gl.uniform1f(specularLoc, 0.25);
            gl.uniform1f(shininessLoc, 16.0);
            gl.uniform1i(smoothShadingLoc, tokenMaker.smoothModel ? 1 : 0);
        }

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

        // Create program for offscreen rendering (choose based on HD setting)
        const offscreenProgram = tokenMaker.hdEnabled
            ? offscreenApp.createProgram(tokenHdVertShader, tokenHdFragShader)
            : offscreenApp.createProgram(tokenVertShader, tokenFragShader);

        // Create shadow program for offscreen rendering
        const offscreenShadowProgram = offscreenApp.createProgram(tokenShadowVertShader, tokenShadowFragShader);

        // Get model
        const model = tokenMaker.getModel();
        if (!model) return null;

        // Build vertex buffers for offscreen
        const faces = this.getModelFaces(model);
        if (faces.length === 0) return null;

        const vertexData: number[] = [];
        const normalData: number[] = [];
        const indices: number[] = [];

        const verticesX = model.verticesX;
        const verticesY = model.verticesY;
        const verticesZ = model.verticesZ;

        const facesA = model.indices1;
        const facesB = model.indices2;
        const facesC = model.indices3;

        const modelTexCoords = model.uvs;

        // For smooth shading, compute vertex normals
        const smoothModel = tokenMaker.smoothModel;
        const vertexNormals: Map<number, { x: number; y: number; z: number }> = new Map();

        if (smoothModel) {
            for (const face of faces) {
                const index = face.index;
                const fa = facesA[index];
                const fb = facesB[index];
                const fc = facesC[index];

                const ax = verticesX[fa], ay = verticesY[fa], az = verticesZ[fa];
                const bx = verticesX[fb], by = verticesY[fb], bz = verticesZ[fb];
                const cx = verticesX[fc], cy = verticesY[fc], cz = verticesZ[fc];

                const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
                const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

                const nx = e1y * e2z - e1z * e2y;
                const ny = e1z * e2x - e1x * e2z;
                const nz = e1x * e2y - e1y * e2x;

                for (const vertIdx of [fa, fb, fc]) {
                    const existing = vertexNormals.get(vertIdx);
                    if (existing) {
                        existing.x += nx;
                        existing.y += ny;
                        existing.z += nz;
                    } else {
                        vertexNormals.set(vertIdx, { x: nx, y: ny, z: nz });
                    }
                }
            }

            for (const [, normal] of vertexNormals) {
                const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
                if (len > 0.0001) {
                    normal.x /= len;
                    normal.y /= len;
                    normal.z /= len;
                }
            }
        }

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

            // Pack normals for each vertex
            if (smoothModel) {
                const nA = vertexNormals.get(fa) || { x: 0, y: 1, z: 0 };
                const nB = vertexNormals.get(fb) || { x: 0, y: 1, z: 0 };
                const nC = vertexNormals.get(fc) || { x: 0, y: 1, z: 0 };
                normalData.push(this.packNormal(nA.x, nA.y, nA.z));
                normalData.push(this.packNormal(nB.x, nB.y, nB.z));
                normalData.push(this.packNormal(nC.x, nC.y, nC.z));
            } else {
                const ax = verticesX[fa], ay = verticesY[fa], az = verticesZ[fa];
                const bx = verticesX[fb], by = verticesY[fb], bz = verticesZ[fb];
                const cx = verticesX[fc], cy = verticesY[fc], cz = verticesZ[fc];

                const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
                const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

                let nx = e1y * e2z - e1z * e2y;
                let ny = e1z * e2x - e1x * e2z;
                let nz = e1x * e2y - e1y * e2x;

                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (len > 0.0001) {
                    nx /= len;
                    ny /= len;
                    nz /= len;
                }

                const packedNormal = this.packNormal(nx, ny, nz);
                normalData.push(packedNormal);
                normalData.push(packedNormal);
                normalData.push(packedNormal);
            }

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

        // Create normal buffer
        const normalBuffer = offscreenGl.createBuffer()!;
        offscreenGl.bindBuffer(offscreenGl.ARRAY_BUFFER, normalBuffer);
        offscreenGl.bufferData(offscreenGl.ARRAY_BUFFER, new Uint32Array(normalData), offscreenGl.STATIC_DRAW);

        // Set up normal attribute
        offscreenGl.enableVertexAttribArray(1);
        offscreenGl.vertexAttribIPointer(1, 1, offscreenGl.UNSIGNED_INT, 4, 0);

        // Create index buffer
        const indexBuffer = offscreenGl.createBuffer()!;
        offscreenGl.bindBuffer(offscreenGl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        offscreenGl.bufferData(offscreenGl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), offscreenGl.STATIC_DRAW);

        offscreenGl.bindVertexArray(null);

        // Calculate model bounds for camera and shadow ground level
        let minX = Infinity, maxX = -Infinity;
        let maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < model.verticesCount; i++) {
            minX = Math.min(minX, verticesX[i]);
            maxX = Math.max(maxX, verticesX[i]);
            maxY = Math.max(maxY, verticesY[i]);
            minZ = Math.min(minZ, verticesZ[i]);
            maxZ = Math.max(maxZ, verticesZ[i]);
        }
        const modelWidth = maxX - minX;
        const modelDepth = maxZ - minZ;
        const modelSize = Math.max(modelWidth, modelDepth);
        const zoom = (modelSize / 128) * 0.65;
        const groundLevel = maxY / 128.0;

        // Set up camera
        const projectionMatrix = mat4.create();
        const viewMatrix = mat4.create();
        mat4.ortho(projectionMatrix, -zoom, zoom, -zoom, zoom, -100, 100);
        mat4.identity(viewMatrix);
        mat4.rotateX(viewMatrix, viewMatrix, -Math.PI / 2);

        // Apply model offset (same as in updateCamera, but aspect=1 for square export)
        // World X → Screen X, World Z → Screen Y
        const offsetX = tokenMaker.modelOffsetX * zoom * 2;
        const offsetZ = tokenMaker.modelOffsetY * zoom * 2;
        if (offsetX !== 0 || offsetZ !== 0) {
            mat4.translate(viewMatrix, viewMatrix, [offsetX, 0, offsetZ]);
        }

        // Apply model rotation around Y axis
        const rotationRadians = (tokenMaker.modelRotation * Math.PI) / 180;
        if (rotationRadians !== 0) {
            mat4.rotateY(viewMatrix, viewMatrix, rotationRadians);
        }

        // Clear with transparency
        offscreenGl.viewport(0, 0, resolution, resolution);
        offscreenGl.clearColor(0, 0, 0, 0);
        offscreenGl.clear(offscreenGl.COLOR_BUFFER_BIT | offscreenGl.DEPTH_BUFFER_BIT);

        offscreenGl.enable(offscreenGl.DEPTH_TEST);
        // Disable culling - top-down view might see "back" faces
        offscreenGl.disable(offscreenGl.CULL_FACE);

        // Render shadow pass first (if enabled)
        let shadowPixels: Uint8Array | null = null;
        if (tokenMaker.shadowEnabled) {
            offscreenGl.enable(offscreenGl.BLEND);
            offscreenGl.blendFunc(offscreenGl.SRC_ALPHA, offscreenGl.ONE_MINUS_SRC_ALPHA);

            offscreenGl.useProgram(offscreenShadowProgram.program);

            const shadowProjLoc = offscreenGl.getUniformLocation(offscreenShadowProgram.program, "u_projectionMatrix");
            const shadowViewLoc = offscreenGl.getUniformLocation(offscreenShadowProgram.program, "u_viewMatrix");
            const groundLevelLoc = offscreenGl.getUniformLocation(offscreenShadowProgram.program, "u_groundLevel");
            const lightDirLoc = offscreenGl.getUniformLocation(offscreenShadowProgram.program, "u_lightDirection");
            const shadowOpacityLoc = offscreenGl.getUniformLocation(offscreenShadowProgram.program, "u_shadowOpacity");

            offscreenGl.uniformMatrix4fv(shadowProjLoc, false, projectionMatrix);
            offscreenGl.uniformMatrix4fv(shadowViewLoc, false, viewMatrix);
            offscreenGl.uniform1f(groundLevelLoc, groundLevel);
            // Use light direction from user control
            const exportShadowLightDir = tokenMaker.getLightDirection();
            offscreenGl.uniform3f(lightDirLoc, exportShadowLightDir[0], exportShadowLightDir[1], exportShadowLightDir[2]);
            offscreenGl.uniform1f(shadowOpacityLoc, tokenMaker.shadowOpacity);

            offscreenGl.bindVertexArray(vao);
            offscreenGl.drawElements(offscreenGl.TRIANGLES, indices.length, offscreenGl.UNSIGNED_INT, 0);
            offscreenGl.bindVertexArray(null);

            // Read shadow pixels
            shadowPixels = new Uint8Array(resolution * resolution * 4);
            offscreenGl.readPixels(0, 0, resolution, resolution, offscreenGl.RGBA, offscreenGl.UNSIGNED_BYTE, shadowPixels);

            // Clear for model render
            offscreenGl.clear(offscreenGl.COLOR_BUFFER_BIT | offscreenGl.DEPTH_BUFFER_BIT);
            offscreenGl.disable(offscreenGl.BLEND);
        }

        // Use program and set uniforms
        offscreenGl.useProgram(offscreenProgram.program);

        const projLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_projectionMatrix");
        const viewLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_viewMatrix");
        const brightnessLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_brightness");
        const colorBandingLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_colorBanding");
        const texturesLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_textures");

        offscreenGl.uniformMatrix4fv(projLoc, false, projectionMatrix);
        offscreenGl.uniformMatrix4fv(viewLoc, false, viewMatrix);
        // Convert brightness from 0-4 scale to internal format (higher value = darker)
        const brightness = 1.0 - tokenMaker.brightness * 0.1;
        offscreenGl.uniform1f(brightnessLoc, brightness);
        offscreenGl.uniform1f(colorBandingLoc, 255.0);

        // Set HD-specific uniforms
        if (tokenMaker.hdEnabled) {
            const lightDirLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_lightDirection");
            const ambientLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_ambientStrength");
            const diffuseLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_diffuseStrength");
            const specularLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_specularStrength");
            const shininessLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_shininess");
            const smoothShadingLoc = offscreenGl.getUniformLocation(offscreenProgram.program, "u_smoothShading");

            // Use light direction from user control
            const exportHdLightDir = tokenMaker.getLightDirection();
            offscreenGl.uniform3f(lightDirLoc, exportHdLightDir[0], exportHdLightDir[1], exportHdLightDir[2]);
            offscreenGl.uniform1f(ambientLoc, 0.35);
            offscreenGl.uniform1f(diffuseLoc, 0.6);
            offscreenGl.uniform1f(specularLoc, 0.25);
            offscreenGl.uniform1f(shininessLoc, 16.0);
            offscreenGl.uniform1i(smoothShadingLoc, tokenMaker.smoothModel ? 1 : 0);
        }

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

        // Create 2D canvas for final output
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = resolution;
        finalCanvas.height = resolution;
        const ctx = finalCanvas.getContext("2d")!;

        // Draw shadow first (behind model) if enabled
        if (shadowPixels) {
            const shadowImageData = ctx.createImageData(resolution, resolution);
            for (let y = 0; y < resolution; y++) {
                for (let x = 0; x < resolution; x++) {
                    const srcIdx = ((resolution - 1 - y) * resolution + x) * 4;
                    const dstIdx = (y * resolution + x) * 4;
                    shadowImageData.data[dstIdx] = shadowPixels[srcIdx];
                    shadowImageData.data[dstIdx + 1] = shadowPixels[srcIdx + 1];
                    shadowImageData.data[dstIdx + 2] = shadowPixels[srcIdx + 2];
                    shadowImageData.data[dstIdx + 3] = shadowPixels[srcIdx + 3];
                }
            }
            ctx.putImageData(shadowImageData, 0, 0);
        }

        // Draw model on top of shadow
        const modelCanvas = document.createElement("canvas");
        modelCanvas.width = resolution;
        modelCanvas.height = resolution;
        const modelCtx = modelCanvas.getContext("2d")!;
        const imageData = modelCtx.createImageData(resolution, resolution);
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
        modelCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(modelCanvas, 0, 0);

        // Clean up
        offscreenGl.deleteBuffer(vertexBuffer);
        offscreenGl.deleteBuffer(normalBuffer);
        offscreenGl.deleteBuffer(indexBuffer);
        offscreenGl.deleteVertexArray(vao);

        // Export as PNG
        return new Promise((resolve) => {
            finalCanvas.toBlob(resolve, "image/png");
        });
    }
}

type ModelFace = {
    index: number;
    alpha: number;
    priority: number;
    textureId: number;
};
