import { mat4, vec2, vec4 } from "gl-matrix";

import { Camera, ProjectionType } from "../../mapviewer/Camera";
import { RS_TO_RADIANS } from "../../rs/MathConstants";

export interface GridSettings {
    enabled: boolean;
    widthPx: number;
    color: {
        r: number;
        g: number;
        b: number;
        a?: number;
    };
    dashedLine: boolean;
    dashLengthPx: number;
    gapLengthPx: number;

    // Grid Size Config
    automaticGridSize: boolean;
    widthInCells: number;
    heightInCells: number;
}

export interface MaxGridSize {
    maxWidthInCells: number;
    maxHeightInCells: number;
}

export type GridSizeUpdate = MaxGridSize & {
    automaticGridSize: boolean;
    widthInCells: number;
    heightInCells: number;
};

type MaxGridSizeCallback = (gridSizeUpdate: GridSizeUpdate) => void;

export const MINIMUM_GRID_SIZE: number = 4;

const GRID_SETTINGS_STORAGE_KEY = "osrs-battlemap-grid-settings";

type PersistedGridSettings = Pick<
    GridSettings,
    "enabled" | "widthPx" | "color" | "dashedLine" | "dashLengthPx" | "gapLengthPx"
>;

export class GridRenderer2D {
    private settings: GridSettings = {
        enabled: true,
        widthPx: 1,
        color: {
            r: 0,
            g: 0,
            b: 0,
            a: 0.65,
        },
        dashedLine: false,
        dashLengthPx: 5,
        gapLengthPx: 5,
        automaticGridSize: true,
        // Defaults set high because they should be automatically shrunk on draw
        widthInCells: 100,
        heightInCells: 100,
    };

    // Grid can't exceed that which fits on the screen (these default values will shrink
    // on draw)
    maxGridSize: MaxGridSize = {
        maxWidthInCells: 100,
        maxHeightInCells: 100,
    };

    // This can probably be removed, given it never has any effect
    private worldGridCellSize: number = 1;
    private maxGridSizeChangedListeners: Set<MaxGridSizeCallback> = new Set();

    // Static vector/matrix for temporary calculations
    private static tempVec4: vec4 = vec4.create();

    constructor() {
        this.loadSettingsFromStorage();
    }

    private loadSettingsFromStorage(): void {
        try {
            if (typeof localStorage === "undefined") {
                return;
            }
            const stored = localStorage.getItem(GRID_SETTINGS_STORAGE_KEY);
            if (stored) {
                const parsed: PersistedGridSettings = JSON.parse(stored);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch {
            // Ignore errors (localStorage unavailable, invalid JSON, etc.)
        }
    }

    private saveSettingsToStorage(): void {
        try {
            if (typeof localStorage === "undefined") {
                return;
            }
            const toSave: PersistedGridSettings = {
                enabled: this.settings.enabled,
                widthPx: this.settings.widthPx,
                color: this.settings.color,
                dashedLine: this.settings.dashedLine,
                dashLengthPx: this.settings.dashLengthPx,
                gapLengthPx: this.settings.gapLengthPx,
            };
            localStorage.setItem(GRID_SETTINGS_STORAGE_KEY, JSON.stringify(toSave));
        } catch {
            // Ignore errors (localStorage unavailable, quota exceeded, etc.)
        }
    }

    setSettings(newSettings: Partial<GridSettings>): void {
        const oldSettings = this.settings;
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettingsToStorage();

        if (!oldSettings.automaticGridSize && newSettings.automaticGridSize) {
            this.settings.widthInCells = this.maxGridSize.maxWidthInCells;
            this.settings.heightInCells = this.maxGridSize.maxHeightInCells;
            this.setMaxGridSize(
                this.maxGridSize.maxWidthInCells,
                this.maxGridSize.maxHeightInCells,
            );
            return;
        }

        if (
            this.settings.automaticGridSize &&
            (this.settings.widthInCells < this.maxGridSize.maxWidthInCells ||
                this.settings.heightInCells > this.maxGridSize.maxHeightInCells)
        ) {
            this.settings.automaticGridSize = false;
            this.setMaxGridSize(
                this.maxGridSize.maxWidthInCells,
                this.maxGridSize.maxHeightInCells,
            );
            return;
        }
    }

    getSettings(): GridSettings {
        return this.settings;
    }

    onMaxGridSizeChanged(callback: MaxGridSizeCallback): () => void {
        this.maxGridSizeChangedListeners.add(callback);
        return () => this.maxGridSizeChangedListeners.delete(callback);
    }

    setMaxGridSize(maxWidthInCells: number, maxHeightInCells: number): void {
        this.maxGridSize = {
            maxWidthInCells,
            maxHeightInCells,
        };
        if (this.settings.automaticGridSize) {
            this.settings.widthInCells = maxWidthInCells;
            this.settings.heightInCells = maxHeightInCells;
        }

        for (const listener of this.maxGridSizeChangedListeners) {
            listener({
                maxWidthInCells,
                maxHeightInCells,
                automaticGridSize: this.settings.automaticGridSize,
                widthInCells: this.settings.widthInCells,
                heightInCells: this.settings.heightInCells,
            });
        }
    }

    private projectWorldToScreen(
        Xw: number,
        Yw: number,
        Zw: number,
        viewProjMatrix: mat4,
        canvasWidth: number,
        canvasHeight: number,
    ): vec2 {
        vec4.set(GridRenderer2D.tempVec4, Xw, Yw, Zw, 1.0);

        vec4.transformMat4(GridRenderer2D.tempVec4, GridRenderer2D.tempVec4, viewProjMatrix);

        // Perform Perspective Divide (W-divide) to get NDC
        const w = GridRenderer2D.tempVec4[3];
        // Check for points behind the camera (Shouldn't happen here, but you never know)
        if (w === 0) return [NaN, NaN];

        const ndcX = GridRenderer2D.tempVec4[0] / w; // [-1, 1]
        const ndcY = GridRenderer2D.tempVec4[1] / w; // [-1, 1]

        // 4. Viewport Transform (NDC to Screen Pixels)
        // NDC x = -1 is screen x = 0
        // NDC x = +1 is screen x = canvasWidth
        const screenX = (ndcX * 0.5 + 0.5) * canvasWidth;

        // NOTE on Y-axis: NDC Y=1 is usually screen Y=0 (top), but your setup might vary.
        // A common pattern is: (NDC Y=-1 is screen Y=canvasHeight)
        const screenY = (ndcY * -0.5 + 0.5) * canvasHeight;

        return [screenX, screenY];
    }

    draw(overlayCanvas: HTMLCanvasElement, camera: Camera): void {
        const ctx = overlayCanvas.getContext("2d");
        const devicePixelRatio = window.devicePixelRatio || 1;
        if (!ctx || !this.settings.enabled || camera.projectionType !== ProjectionType.ORTHO) {
            // Clear if disabled or not in Ortho mode
            // (the latter should never happen in this version, but who knows)
            if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            return;
        }

        // --- Camera and Canvas Info ---
        const width = overlayCanvas.width;
        const height = overlayCanvas.height;
        const viewProjMatrix = camera.viewProjMatrix;
        const gridSize = this.worldGridCellSize;
        const camPos = camera.pos;
        const zoom = camera.orthoZoom;

        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = this.cssColor;
        ctx.lineWidth = this.settings.widthPx * devicePixelRatio;

        const baseHalfWorldSpanX = width / zoom;
        const baseHalfWorldSpanY = height / zoom;

        // Account for camera yaw rotation when calculating world bounds.
        // When the camera is rotated, the visible area is a rotated rectangle.
        // We need to expand the axis-aligned bounds to cover the rotated view.
        const yaw = (camera.getYaw() - 1024) * RS_TO_RADIANS;
        const cosYaw = Math.abs(Math.cos(yaw));
        const sinYaw = Math.abs(Math.sin(yaw));

        // The rotated rectangle's axis-aligned bounding box dimensions
        const halfWorldSpanX = baseHalfWorldSpanX * cosYaw + baseHalfWorldSpanY * sinYaw;
        const halfWorldSpanY = baseHalfWorldSpanX * sinYaw + baseHalfWorldSpanY * cosYaw;

        const camX = camPos[0];
        const camZ = camPos[2];

        const minX = camX - halfWorldSpanX;
        const maxX = camX + halfWorldSpanX;
        const minZ = camZ - halfWorldSpanY;
        const maxZ = camZ + halfWorldSpanY;

        // Find the first grid line that is a multiple of gridSize
        let firstX = Math.floor(minX / gridSize) * gridSize;
        let firstZ = Math.floor(minZ / gridSize) * gridSize;

        // Vertical Lines (X-axis)
        for (let Xw = firstX; Xw <= maxX + gridSize; Xw += gridSize) {
            const p1 = this.projectWorldToScreen(Xw, 0, maxZ, viewProjMatrix, width, height);
            const p2 = this.projectWorldToScreen(Xw, 0, minZ, viewProjMatrix, width, height);

            if (!isNaN(p1[0]) && !isNaN(p2[0])) {
                this.drawLine(ctx, p1, p2);
            }
        }

        // Horizontal Lines (Z-axis)
        for (let Zw = firstZ; Zw <= maxZ + gridSize; Zw += gridSize) {
            const p1 = this.projectWorldToScreen(minX, 0, Zw, viewProjMatrix, width, height);
            const p2 = this.projectWorldToScreen(maxX, 0, Zw, viewProjMatrix, width, height);

            if (!isNaN(p1[0]) && !isNaN(p2[0])) {
                this.drawLine(ctx, p1, p2);
            }
        }

        // Use base (non-rotated) spans for max grid size since this represents
        // the logical grid dimensions, not the expanded drawing area
        const maxWidthInCells = Math.floor(baseHalfWorldSpanX) * 2;
        const maxHeightInCells = Math.floor(baseHalfWorldSpanY) * 2;
        if (
            maxWidthInCells !== this.maxGridSize.maxWidthInCells ||
            maxHeightInCells !== this.maxGridSize.maxHeightInCells
        ) {
            this.setMaxGridSize(maxWidthInCells, maxHeightInCells);
        }

        // Draw the border rect which occludes the not-in-play grid cells
        const selectedGridBounds = this.getSelectedGridBounds(overlayCanvas, camera);

        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.moveTo(selectedGridBounds.topLeft[0], selectedGridBounds.topLeft[1]);
        ctx.rect(
            selectedGridBounds.topLeft[0],
            selectedGridBounds.topLeft[1],
            selectedGridBounds.width,
            selectedGridBounds.height,
        );
        // Even-odd will fill the outer "border" rect
        ctx.fill("evenodd");
    }

    getSelectedGridBounds(
        overlayCanvas: HTMLCanvasElement,
        camera: Camera,
    ): { topLeft: vec2; width: number; height: number } {
        const width = overlayCanvas.width;
        const height = overlayCanvas.height;
        const cellSizePx = width / ((width / camera.orthoZoom) * 2 * this.worldGridCellSize);

        return {
            topLeft: [
                (width - this.settings.widthInCells * cellSizePx) / 2,
                (height - this.settings.heightInCells * cellSizePx) / 2,
            ],
            width: this.settings.widthInCells * cellSizePx,
            height: this.settings.heightInCells * cellSizePx,
        };
    }

    private drawLine(ctx: CanvasRenderingContext2D, p1: vec2, p2: vec2) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        ctx.beginPath();
        if (this.settings.dashedLine && this.settings.dashLengthPx && this.settings.gapLengthPx) {
            ctx.setLineDash([
                this.settings.dashLengthPx * devicePixelRatio,
                this.settings.gapLengthPx * devicePixelRatio,
            ]);
        } else {
            ctx.setLineDash([]);
        }
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
    }

    private get cssColor(): string {
        return `rgba(${this.settings.color.r}, ${this.settings.color.g}, ${
            this.settings.color.b
        }, ${this.settings.color.a ?? 1})`;
    }
}
