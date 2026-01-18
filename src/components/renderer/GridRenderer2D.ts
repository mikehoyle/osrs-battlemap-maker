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

    // World position (top-left corner of grid)
    worldX: number;
    worldZ: number;
    // Grid dimensions in cells
    widthInCells: number;
    heightInCells: number;
}

/**
 * Flags indicating which grid edges the mouse is near.
 * Multiple flags can be set for corners.
 */
export interface GridEdgeProximity {
    top: boolean; // North edge (gridMaxZ)
    bottom: boolean; // South edge (gridMinZ)
    left: boolean; // West edge (gridMinX)
    right: boolean; // East edge (gridMaxX)
}

/**
 * Get the appropriate cursor style for a given edge proximity state.
 */
export function getCursorForEdge(edge: GridEdgeProximity | null): string {
    if (!edge) return "grab";

    const { top, bottom, left, right } = edge;

    // Corners
    if ((top && left) || (bottom && right)) return "nwse-resize";
    if ((top && right) || (bottom && left)) return "nesw-resize";

    // Single edges
    if (top || bottom) return "ns-resize";
    if (left || right) return "ew-resize";

    return "grab";
}

export const MINIMUM_GRID_SIZE: number = 2;
export const MAXIMUM_GRID_SIZE: number = 150;

const GRID_SETTINGS_STORAGE_KEY = "osrs-battlemap-grid-settings";

type PersistedGridSettings = Pick<
    GridSettings,
    | "enabled"
    | "widthPx"
    | "color"
    | "dashedLine"
    | "dashLengthPx"
    | "gapLengthPx"
    | "worldX"
    | "worldZ"
    | "widthInCells"
    | "heightInCells"
>;

export class GridRenderer2D {
    private settings: GridSettings = {
        enabled: true,
        widthPx: 0.5,
        color: {
            r: 0,
            g: 0,
            b: 0,
            a: 0.65,
        },
        dashedLine: false,
        dashLengthPx: 5,
        gapLengthPx: 5,
        worldX: 3200,
        worldZ: 3200,
        widthInCells: 30,
        heightInCells: 30,
    };

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
                worldX: this.settings.worldX,
                worldZ: this.settings.worldZ,
                widthInCells: this.settings.widthInCells,
                heightInCells: this.settings.heightInCells,
            };
            localStorage.setItem(GRID_SETTINGS_STORAGE_KEY, JSON.stringify(toSave));
        } catch {
            // Ignore errors (localStorage unavailable, quota exceeded, etc.)
        }
    }

    setSettings(newSettings: Partial<GridSettings>): void {
        this.settings = { ...this.settings, ...newSettings };

        // Clamp grid dimensions to valid range
        this.settings.widthInCells = Math.max(
            MINIMUM_GRID_SIZE,
            Math.min(MAXIMUM_GRID_SIZE, this.settings.widthInCells),
        );
        this.settings.heightInCells = Math.max(
            MINIMUM_GRID_SIZE,
            Math.min(MAXIMUM_GRID_SIZE, this.settings.heightInCells),
        );

        this.saveSettingsToStorage();
    }

    getSettings(): GridSettings {
        return this.settings;
    }

    /**
     * Centers the grid on the given world position
     */
    centerGridOnPosition(worldX: number, worldZ: number): void {
        // worldX/worldZ is top-left corner
        // Grid extends right (+X) and down (-Z)
        this.setSettings({
            worldX: Math.floor(worldX - this.settings.widthInCells / 2),
            worldZ: Math.floor(worldZ + this.settings.heightInCells / 2),
        });
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

    /**
     * Detects if the mouse is near a grid edge and returns which edges.
     * @param mouseX Mouse X position in screen coordinates
     * @param mouseY Mouse Y position in screen coordinates
     * @param camera The camera for projection
     * @param canvasWidth Canvas width in pixels
     * @param canvasHeight Canvas height in pixels
     * @param threshold Distance threshold in pixels to consider "near" an edge
     * @returns GridEdgeProximity object or null if not near any edge
     */
    getEdgeProximity(
        mouseX: number,
        mouseY: number,
        camera: Camera,
        canvasWidth: number,
        canvasHeight: number,
        threshold: number = 12,
    ): GridEdgeProximity | null {
        if (!this.settings.enabled || camera.projectionType !== ProjectionType.ORTHO) {
            return null;
        }

        const viewProjMatrix = camera.viewProjMatrix;

        // Grid world bounds
        const gridMinX = this.settings.worldX;
        const gridMaxX = this.settings.worldX + this.settings.widthInCells;
        const gridMinZ = this.settings.worldZ - this.settings.heightInCells;
        const gridMaxZ = this.settings.worldZ;

        // Project the four corners to screen space
        const topLeft = this.projectWorldToScreen(
            gridMinX,
            0,
            gridMaxZ,
            viewProjMatrix,
            canvasWidth,
            canvasHeight,
        );
        const topRight = this.projectWorldToScreen(
            gridMaxX,
            0,
            gridMaxZ,
            viewProjMatrix,
            canvasWidth,
            canvasHeight,
        );
        const bottomLeft = this.projectWorldToScreen(
            gridMinX,
            0,
            gridMinZ,
            viewProjMatrix,
            canvasWidth,
            canvasHeight,
        );
        const bottomRight = this.projectWorldToScreen(
            gridMaxX,
            0,
            gridMinZ,
            viewProjMatrix,
            canvasWidth,
            canvasHeight,
        );

        // Calculate distance to each edge (as line segments)
        const distToTop = this.distanceToLineSegment(
            mouseX,
            mouseY,
            topLeft[0],
            topLeft[1],
            topRight[0],
            topRight[1],
        );
        const distToBottom = this.distanceToLineSegment(
            mouseX,
            mouseY,
            bottomLeft[0],
            bottomLeft[1],
            bottomRight[0],
            bottomRight[1],
        );
        const distToLeft = this.distanceToLineSegment(
            mouseX,
            mouseY,
            topLeft[0],
            topLeft[1],
            bottomLeft[0],
            bottomLeft[1],
        );
        const distToRight = this.distanceToLineSegment(
            mouseX,
            mouseY,
            topRight[0],
            topRight[1],
            bottomRight[0],
            bottomRight[1],
        );

        const proximity: GridEdgeProximity = {
            top: distToTop <= threshold,
            bottom: distToBottom <= threshold,
            left: distToLeft <= threshold,
            right: distToRight <= threshold,
        };

        // Return null if not near any edge
        if (!proximity.top && !proximity.bottom && !proximity.left && !proximity.right) {
            return null;
        }

        return proximity;
    }

    /**
     * Calculates the shortest distance from a point to a line segment.
     */
    private distanceToLineSegment(
        px: number,
        py: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
    ): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            // Line segment is a point
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }

        // Project point onto line, clamped to segment
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;

        return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
    }

    /**
     * Converts screen delta movement to world coordinate delta.
     * Used for grid resizing based on mouse drag.
     */
    screenDeltaToWorldDelta(
        deltaScreenX: number,
        deltaScreenY: number,
        camera: Camera,
    ): { deltaWorldX: number; deltaWorldZ: number } {
        // In ortho mode, the relationship between screen and world is based on zoom
        // panScale = 4 / camera.orthoZoom (from MapViewerRenderer.handleMouseInput)
        const panScale = 4 / camera.orthoZoom;

        // Screen X increases right -> World X increases right
        // Screen Y increases down -> World Z decreases (south)
        return {
            deltaWorldX: -deltaScreenX * panScale,
            deltaWorldZ: deltaScreenY * panScale,
        };
    }

    draw(overlayCanvas: HTMLCanvasElement, camera: Camera): void {
        const ctx = overlayCanvas.getContext("2d");
        if (!ctx || !this.settings.enabled || camera.projectionType !== ProjectionType.ORTHO) {
            // Clear if disabled or not in Ortho mode
            if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            return;
        }

        const width = overlayCanvas.width;
        const height = overlayCanvas.height;
        const viewProjMatrix = camera.viewProjMatrix;
        const zoom = camera.orthoZoom;

        // Calculate scale factor to match export resolution (base = 64px per cell)
        const cellSizePx = zoom / 2;
        const scaleFactor = cellSizePx / 64;

        ctx.clearRect(0, 0, width, height);

        // Grid world bounds (from settings)
        // X increases going east (right), Z increases going north (up)
        // worldX/worldZ is top-left corner, so grid extends right (+X) and down (-Z)
        const gridMinX = this.settings.worldX;
        const gridMaxX = this.settings.worldX + this.settings.widthInCells;
        const gridMinZ = this.settings.worldZ - this.settings.heightInCells;
        const gridMaxZ = this.settings.worldZ;

        // Draw grid lines
        ctx.strokeStyle = this.cssColor;
        ctx.lineWidth = this.settings.widthPx * scaleFactor;

        // Vertical Lines (X-axis)
        for (let Xw = gridMinX; Xw <= gridMaxX; Xw++) {
            const p1 = this.projectWorldToScreen(Xw, 0, gridMaxZ, viewProjMatrix, width, height);
            const p2 = this.projectWorldToScreen(Xw, 0, gridMinZ, viewProjMatrix, width, height);

            if (!isNaN(p1[0]) && !isNaN(p2[0])) {
                this.drawLine(ctx, p1, p2, scaleFactor);
            }
        }

        // Horizontal Lines (Z-axis)
        for (let Zw = gridMinZ; Zw <= gridMaxZ; Zw++) {
            const p1 = this.projectWorldToScreen(gridMinX, 0, Zw, viewProjMatrix, width, height);
            const p2 = this.projectWorldToScreen(gridMaxX, 0, Zw, viewProjMatrix, width, height);

            if (!isNaN(p1[0]) && !isNaN(p2[0])) {
                this.drawLine(ctx, p1, p2, scaleFactor);
            }
        }

        // Draw grey overlay for non-grid area
        this.drawGreyOverlay(ctx, viewProjMatrix, width, height);

        // Draw frame around grid to indicate it's interactable (browser view only)
        this.drawGridFrame(ctx, viewProjMatrix, width, height, scaleFactor);
    }

    /**
     * Draws a semi-transparent grey overlay over the non-grid area
     */
    private drawGreyOverlay(
        ctx: CanvasRenderingContext2D,
        viewProjMatrix: mat4,
        width: number,
        height: number,
    ): void {
        // Project the four corners of the grid to screen space
        // X increases going east (right), Z increases going north (up)
        // worldX/worldZ is top-left corner, so grid extends right (+X) and down (-Z)
        const gridMinX = this.settings.worldX;
        const gridMaxX = this.settings.worldX + this.settings.widthInCells;
        const gridMinZ = this.settings.worldZ - this.settings.heightInCells;
        const gridMaxZ = this.settings.worldZ;

        // gridMaxZ is north (top of screen), gridMinZ is south (bottom of screen)
        const topLeft = this.projectWorldToScreen(
            gridMinX,
            0,
            gridMaxZ,
            viewProjMatrix,
            width,
            height,
        );
        const topRight = this.projectWorldToScreen(
            gridMaxX,
            0,
            gridMaxZ,
            viewProjMatrix,
            width,
            height,
        );
        const bottomLeft = this.projectWorldToScreen(
            gridMinX,
            0,
            gridMinZ,
            viewProjMatrix,
            width,
            height,
        );
        const bottomRight = this.projectWorldToScreen(
            gridMaxX,
            0,
            gridMinZ,
            viewProjMatrix,
            width,
            height,
        );

        // Draw semi-transparent overlay with grid area cut out
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.rect(0, 0, width, height);

        // Cut out the grid area (draw counter-clockwise for even-odd fill)
        ctx.moveTo(topLeft[0], topLeft[1]);
        ctx.lineTo(topRight[0], topRight[1]);
        ctx.lineTo(bottomRight[0], bottomRight[1]);
        ctx.lineTo(bottomLeft[0], bottomLeft[1]);
        ctx.closePath();

        ctx.fill("evenodd");
    }

    /**
     * Draws a visible frame around the grid to indicate it's interactable.
     * Only shown in browser view, not in exports.
     */
    private drawGridFrame(
        ctx: CanvasRenderingContext2D,
        viewProjMatrix: mat4,
        width: number,
        height: number,
        scaleFactor: number,
    ): void {
        // Grid world bounds
        const gridMinX = this.settings.worldX;
        const gridMaxX = this.settings.worldX + this.settings.widthInCells;
        const gridMinZ = this.settings.worldZ - this.settings.heightInCells;
        const gridMaxZ = this.settings.worldZ;

        // Project corners to screen space
        const topLeft = this.projectWorldToScreen(
            gridMinX,
            0,
            gridMaxZ,
            viewProjMatrix,
            width,
            height,
        );
        const topRight = this.projectWorldToScreen(
            gridMaxX,
            0,
            gridMaxZ,
            viewProjMatrix,
            width,
            height,
        );
        const bottomLeft = this.projectWorldToScreen(
            gridMinX,
            0,
            gridMinZ,
            viewProjMatrix,
            width,
            height,
        );
        const bottomRight = this.projectWorldToScreen(
            gridMaxX,
            0,
            gridMinZ,
            viewProjMatrix,
            width,
            height,
        );

        // Check for valid projections
        if (
            isNaN(topLeft[0]) ||
            isNaN(topRight[0]) ||
            isNaN(bottomLeft[0]) ||
            isNaN(bottomRight[0])
        ) {
            return;
        }

        // Frame styling - white border with slight transparency for visibility
        const frameColor = "rgba(255, 255, 255, 0.85)";
        const frameWidth = Math.max(2, 3 * scaleFactor);
        const handleSize = Math.max(8, 12 * scaleFactor);

        // Draw outer frame border
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = frameWidth;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(topLeft[0], topLeft[1]);
        ctx.lineTo(topRight[0], topRight[1]);
        ctx.lineTo(bottomRight[0], bottomRight[1]);
        ctx.lineTo(bottomLeft[0], bottomLeft[1]);
        ctx.closePath();
        ctx.stroke();

        // Draw a subtle inner shadow line for depth
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = Math.max(1, 1.5 * scaleFactor);
        ctx.beginPath();
        ctx.moveTo(topLeft[0], topLeft[1]);
        ctx.lineTo(topRight[0], topRight[1]);
        ctx.lineTo(bottomRight[0], bottomRight[1]);
        ctx.lineTo(bottomLeft[0], bottomLeft[1]);
        ctx.closePath();
        ctx.stroke();

        // Draw corner handles to indicate resizability
        ctx.fillStyle = frameColor;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.lineWidth = Math.max(1, 1.5 * scaleFactor);

        const corners: vec2[] = [topLeft, topRight, bottomLeft, bottomRight];
        for (const corner of corners) {
            ctx.beginPath();
            ctx.rect(
                corner[0] - handleSize / 2,
                corner[1] - handleSize / 2,
                handleSize,
                handleSize,
            );
            ctx.fill();
            ctx.stroke();
        }

        // Draw edge midpoint handles for single-axis resizing
        const midTop: vec2 = [(topLeft[0] + topRight[0]) / 2, (topLeft[1] + topRight[1]) / 2];
        const midBottom: vec2 = [
            (bottomLeft[0] + bottomRight[0]) / 2,
            (bottomLeft[1] + bottomRight[1]) / 2,
        ];
        const midLeft: vec2 = [(topLeft[0] + bottomLeft[0]) / 2, (topLeft[1] + bottomLeft[1]) / 2];
        const midRight: vec2 = [
            (topRight[0] + bottomRight[0]) / 2,
            (topRight[1] + bottomRight[1]) / 2,
        ];

        const edgeHandleSize = handleSize * 0.7;
        const midpoints: vec2[] = [midTop, midBottom, midLeft, midRight];
        for (const midpoint of midpoints) {
            ctx.beginPath();
            ctx.rect(
                midpoint[0] - edgeHandleSize / 2,
                midpoint[1] - edgeHandleSize / 2,
                edgeHandleSize,
                edgeHandleSize,
            );
            ctx.fill();
            ctx.stroke();
        }
    }

    private drawLine(ctx: CanvasRenderingContext2D, p1: vec2, p2: vec2, scaleFactor: number) {
        ctx.beginPath();
        if (this.settings.dashedLine && this.settings.dashLengthPx && this.settings.gapLengthPx) {
            ctx.setLineDash([
                this.settings.dashLengthPx * scaleFactor,
                this.settings.gapLengthPx * scaleFactor,
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

    /**
     * Renders the grid to a provided canvas at a specific scale.
     * Used for export functionality where we need the grid at a different resolution.
     * Camera should be centered on the grid for export.
     * @param canvas The canvas to render to
     * @param camera The camera to use for projection (should be centered on grid)
     * @param scaleFactor Scale factor for line widths (e.g., 4 for 256px resolution vs 64px base)
     */
    renderToCanvas(canvas: HTMLCanvasElement, camera: Camera, scaleFactor: number = 1): void {
        const ctx = canvas.getContext("2d");
        if (!ctx || !this.settings.enabled || camera.projectionType !== ProjectionType.ORTHO) {
            return;
        }

        const width = canvas.width;
        const height = canvas.height;
        const viewProjMatrix = camera.viewProjMatrix;

        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = this.cssColor;
        ctx.lineWidth = this.settings.widthPx * scaleFactor;

        // Grid world bounds (from settings)
        // X increases going east (right), Z increases going north (up)
        // worldX/worldZ is top-left corner, so grid extends right (+X) and down (-Z)
        const gridMinX = this.settings.worldX;
        const gridMaxX = this.settings.worldX + this.settings.widthInCells;
        const gridMinZ = this.settings.worldZ - this.settings.heightInCells;
        const gridMaxZ = this.settings.worldZ;

        // Vertical Lines (X-axis)
        for (let Xw = gridMinX; Xw <= gridMaxX; Xw++) {
            const p1 = this.projectWorldToScreen(Xw, 0, gridMaxZ, viewProjMatrix, width, height);
            const p2 = this.projectWorldToScreen(Xw, 0, gridMinZ, viewProjMatrix, width, height);

            if (!isNaN(p1[0]) && !isNaN(p2[0])) {
                this.drawLine(ctx, p1, p2, scaleFactor);
            }
        }

        // Horizontal Lines (Z-axis)
        for (let Zw = gridMinZ; Zw <= gridMaxZ; Zw++) {
            const p1 = this.projectWorldToScreen(gridMinX, 0, Zw, viewProjMatrix, width, height);
            const p2 = this.projectWorldToScreen(gridMaxX, 0, Zw, viewProjMatrix, width, height);

            if (!isNaN(p1[0]) && !isNaN(p2[0])) {
                this.drawLine(ctx, p1, p2, scaleFactor);
            }
        }

        // Note: No grey overlay for export - the grid covers the full export area
    }

    get widthInCells(): number {
        return this.settings.widthInCells;
    }

    get heightInCells(): number {
        return this.settings.heightInCells;
    }

    get gridCenter(): vec2 {
        // worldX/worldZ is top-left corner, grid extends right (+X) and down (-Z)
        return [
            this.settings.worldX + this.settings.widthInCells / 2,
            this.settings.worldZ - this.settings.heightInCells / 2,
        ];
    }

    /**
     * Calculates what fraction of the grid is visible on screen (0 to 1).
     * Uses the bounding box of the projected grid corners and calculates
     * the intersection with the viewport.
     */
    getGridVisibilityRatio(camera: Camera, canvasWidth: number, canvasHeight: number): number {
        if (!this.settings.enabled || camera.projectionType !== ProjectionType.ORTHO) {
            return 1; // Consider fully visible when not applicable
        }

        const viewProjMatrix = camera.viewProjMatrix;

        // Grid world bounds
        const gridMinX = this.settings.worldX;
        const gridMaxX = this.settings.worldX + this.settings.widthInCells;
        const gridMinZ = this.settings.worldZ - this.settings.heightInCells;
        const gridMaxZ = this.settings.worldZ;

        // Project the four corners of the grid to screen space
        const corners = [
            this.projectWorldToScreen(gridMinX, 0, gridMaxZ, viewProjMatrix, canvasWidth, canvasHeight),
            this.projectWorldToScreen(gridMaxX, 0, gridMaxZ, viewProjMatrix, canvasWidth, canvasHeight),
            this.projectWorldToScreen(gridMaxX, 0, gridMinZ, viewProjMatrix, canvasWidth, canvasHeight),
            this.projectWorldToScreen(gridMinX, 0, gridMinZ, viewProjMatrix, canvasWidth, canvasHeight),
        ];

        // Check if any corner projection is invalid
        for (const corner of corners) {
            if (isNaN(corner[0]) || isNaN(corner[1])) {
                return 0;
            }
        }

        // Get the axis-aligned bounding box of the projected grid
        const minScreenX = Math.min(...corners.map((c) => c[0]));
        const maxScreenX = Math.max(...corners.map((c) => c[0]));
        const minScreenY = Math.min(...corners.map((c) => c[1]));
        const maxScreenY = Math.max(...corners.map((c) => c[1]));

        // Calculate the total area of the projected grid bounding box
        const totalWidth = maxScreenX - minScreenX;
        const totalHeight = maxScreenY - minScreenY;
        const totalArea = totalWidth * totalHeight;

        if (totalArea <= 0) {
            return 0;
        }

        // Clip the bounding box to the screen bounds
        const clippedMinX = Math.max(0, minScreenX);
        const clippedMaxX = Math.min(canvasWidth, maxScreenX);
        const clippedMinY = Math.max(0, minScreenY);
        const clippedMaxY = Math.min(canvasHeight, maxScreenY);

        // Calculate the visible (clipped) area
        const clippedWidth = Math.max(0, clippedMaxX - clippedMinX);
        const clippedHeight = Math.max(0, clippedMaxY - clippedMinY);
        const clippedArea = clippedWidth * clippedHeight;

        return clippedArea / totalArea;
    }

    /**
     * Checks if any part of the grid is visible on screen.
     * Returns true if the grid overlaps with the visible area at all.
     */
    isGridVisible(camera: Camera, canvasWidth: number, canvasHeight: number): boolean {
        if (!this.settings.enabled || camera.projectionType !== ProjectionType.ORTHO) {
            return true; // Consider visible when not applicable
        }

        const visibleBounds = this.getVisibleWorldBounds(camera, canvasWidth, canvasHeight);

        // Grid world bounds
        const gridMinX = this.settings.worldX;
        const gridMaxX = this.settings.worldX + this.settings.widthInCells;
        const gridMinZ = this.settings.worldZ - this.settings.heightInCells;
        const gridMaxZ = this.settings.worldZ;

        // Check if the two rectangles overlap (AABB intersection test)
        const overlapsX = gridMinX < visibleBounds.maxX && gridMaxX > visibleBounds.minX;
        const overlapsZ = gridMinZ < visibleBounds.maxZ && gridMaxZ > visibleBounds.minZ;

        return overlapsX && overlapsZ;
    }

    /**
     * Calculates the visible world bounds from the camera's orthographic projection.
     * Returns the min/max world coordinates visible on screen.
     */
    getVisibleWorldBounds(
        camera: Camera,
        canvasWidth: number,
        canvasHeight: number,
    ): { minX: number; maxX: number; minZ: number; maxZ: number } {
        // In orthographic mode, the visible area is determined by orthoZoom
        // The visible world width/height is: canvasWidth/height * 2 / orthoZoom
        const worldWidth = (canvasWidth * 2) / camera.orthoZoom;
        const worldHeight = (canvasHeight * 2) / camera.orthoZoom;

        const cameraPosX = camera.getPosX();
        const cameraPosZ = camera.getPosZ();

        return {
            minX: cameraPosX - worldWidth / 2,
            maxX: cameraPosX + worldWidth / 2,
            minZ: cameraPosZ - worldHeight / 2,
            maxZ: cameraPosZ + worldHeight / 2,
        };
    }

    /**
     * Snaps the grid to be entirely within the visible camera area.
     * The grid will be centered on the camera position while respecting
     * the minimum and maximum grid size constraints.
     */
    snapGridToCamera(camera: Camera, canvasWidth: number, canvasHeight: number): void {
        if (camera.projectionType !== ProjectionType.ORTHO) {
            return;
        }

        const bounds = this.getVisibleWorldBounds(camera, canvasWidth, canvasHeight);

        // Calculate the available space
        const availableWidth = bounds.maxX - bounds.minX;
        const availableHeight = bounds.maxZ - bounds.minZ;

        // Determine the grid size to fit within visible area
        // Keep current size if it fits, otherwise shrink to fit
        let newWidth = this.settings.widthInCells;
        let newHeight = this.settings.heightInCells;

        // If current grid is too large to fit, shrink it
        if (newWidth > availableWidth) {
            newWidth = Math.floor(availableWidth);
        }
        if (newHeight > availableHeight) {
            newHeight = Math.floor(availableHeight);
        }

        // Ensure we respect min/max constraints
        newWidth = Math.max(MINIMUM_GRID_SIZE, Math.min(MAXIMUM_GRID_SIZE, newWidth));
        newHeight = Math.max(MINIMUM_GRID_SIZE, Math.min(MAXIMUM_GRID_SIZE, newHeight));

        // Center the grid on the camera position
        const cameraPosX = camera.getPosX();
        const cameraPosZ = camera.getPosZ();

        // worldX/worldZ is the top-left corner
        // Grid extends right (+X) and down (-Z)
        const newWorldX = Math.floor(cameraPosX - newWidth / 2);
        const newWorldZ = Math.floor(cameraPosZ + newHeight / 2);

        this.setSettings({
            worldX: newWorldX,
            worldZ: newWorldZ,
            widthInCells: newWidth,
            heightInCells: newHeight,
        });
    }
}
