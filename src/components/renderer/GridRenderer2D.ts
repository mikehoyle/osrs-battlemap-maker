import { mat4, vec4 } from "gl-matrix";

import { Camera, ProjectionType } from "../../mapviewer/Camera";

export interface GridSettings {
    enabled: boolean;
    // Line width (in pixels)
    width: number;
    // CSS color string (e.g., 'rgba(255, 255, 255, 0.4)')
    color: {
        r: number;
        g: number;
        b: number;
        a?: number;
    };
}

export class GridRenderer2D {
    private settings: GridSettings = {
        enabled: true,
        width: 1,
        color: {
            r: 255,
            g: 255,
            b: 255,
            a: 0.4,
        },
    };

    private worldGridSize: number = 1;

    // Static vector/matrix for temporary calculations
    private static tempVec4: vec4 = vec4.create();

    constructor(private readonly camera: Camera) {}

    setSettings(newSettings: Partial<GridSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
    }

    getSettings(): GridSettings {
        return this.settings;
    }

    private projectWorldToScreen(
        Xw: number,
        Yw: number,
        Zw: number,
        viewProjMatrix: mat4,
        canvasWidth: number,
        canvasHeight: number,
    ): { x: number; y: number } {
        vec4.set(GridRenderer2D.tempVec4, Xw, Yw, Zw, 1.0); // Assuming world vector is (X, Y, Z, 1)

        vec4.transformMat4(GridRenderer2D.tempVec4, GridRenderer2D.tempVec4, viewProjMatrix);

        // Perform Perspective Divide (W-divide) to get NDC
        const w = GridRenderer2D.tempVec4[3];
        // Check for points behind the camera (Shouldn't happen here, but you never know)
        if (w === 0) return { x: NaN, y: NaN };

        const ndcX = GridRenderer2D.tempVec4[0] / w; // [-1, 1]
        const ndcY = GridRenderer2D.tempVec4[1] / w; // [-1, 1]

        // 4. Viewport Transform (NDC to Screen Pixels)
        // NDC x = -1 is screen x = 0
        // NDC x = +1 is screen x = canvasWidth
        const screenX = (ndcX * 0.5 + 0.5) * canvasWidth;

        // NOTE on Y-axis: NDC Y=1 is usually screen Y=0 (top), but your setup might vary.
        // A common pattern is: (NDC Y=-1 is screen Y=canvasHeight)
        const screenY = (ndcY * -0.5 + 0.5) * canvasHeight;

        return { x: screenX, y: screenY };
    }

    draw(overlayCanvas: HTMLCanvasElement, camera: Camera): void {
        const ctx = overlayCanvas.getContext("2d");
        if (!ctx || !this.settings.enabled || camera.projectionType !== ProjectionType.ORTHO) {
            // Clear if disabled or not in Ortho mode
            if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            return;
        }

        // --- Camera and Canvas Info ---
        const width = overlayCanvas.width;
        const height = overlayCanvas.height;
        const viewProjMatrix = camera.viewProjMatrix;
        const gridSize = this.worldGridSize;
        const camPos = camera.pos;
        const zoom = camera.orthoZoom;

        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = this.cssColor;
        ctx.lineWidth = this.settings.width;

        const worldSpanX = width / zoom;
        const worldSpanY = height / zoom;

        const camX = camPos[0];
        const camZ = camPos[2];

        const minX = camX - worldSpanX;
        const maxX = camX + worldSpanX;
        const minZ = camZ - worldSpanY;
        const maxZ = camZ + worldSpanY;

        // Find the first grid line that is a multiple of gridSize
        let firstX = Math.floor(minX / gridSize) * gridSize;
        let firstZ = Math.floor(minZ / gridSize) * gridSize;

        // --- 2. Draw Vertical Lines (X-axis in world) ---
        for (let Xw = firstX; Xw <= maxX + gridSize; Xw += gridSize) {
            // Project two points along the Z-range of the screen
            // The map plane is at Y=0 (vertical world component)
            const p1 = this.projectWorldToScreen(Xw, 0, maxZ, viewProjMatrix, width, height);
            const p2 = this.projectWorldToScreen(Xw, 0, minZ, viewProjMatrix, width, height);

            if (!isNaN(p1.x) && !isNaN(p2.x)) {
                ctx.beginPath();
                // Ensure lines are slightly blurred if needed, or use Math.round(x) + 0.5
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }

        // --- 3. Draw Horizontal Lines (Z-axis in world) ---
        for (let Zw = firstZ; Zw <= maxZ + gridSize; Zw += gridSize) {
            // Project two points along the X-range of the screen
            const p1 = this.projectWorldToScreen(minX, 0, Zw, viewProjMatrix, width, height);
            const p2 = this.projectWorldToScreen(maxX, 0, Zw, viewProjMatrix, width, height);

            if (!isNaN(p1.x) && !isNaN(p2.x)) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    }

    private get cssColor(): string {
        return `rgba(${this.settings.color.r}, ${this.settings.color.g}, ${
            this.settings.color.b
        }, ${this.settings.color.a ?? 1})`;
    }
}
