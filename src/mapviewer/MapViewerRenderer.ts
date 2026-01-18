import {
    GridEdgeProximity,
    GridRenderer2D,
    GridSettings,
    MAXIMUM_GRID_SIZE,
    MINIMUM_GRID_SIZE,
    getCursorForEdge,
} from "../components/renderer/GridRenderer2D";
import { Renderer } from "../components/renderer/Renderer";
import { SceneBuilder } from "../rs/scene/SceneBuilder";
import { clamp } from "../util/MathUtil";
import { getAxisDeadzone } from "./InputManager";
import { MapManager, MapSquare } from "./MapManager";
import { MapViewer } from "./MapViewer";
import { MapViewerRendererType } from "./MapViewerRenderers";

// Stores the initial state when a grid resize drag begins
interface GridResizeStart {
    dragX: number;
    dragY: number;
    worldX: number;
    worldZ: number;
    widthInCells: number;
    heightInCells: number;
}

export abstract class MapViewerRenderer<T extends MapSquare = MapSquare> extends Renderer {
    abstract type: MapViewerRendererType;

    mapManager: MapManager<T>;
    gridRenderer: GridRenderer2D;

    // Export render dimensions - when set, render() should use these instead of app dimensions
    protected exportRenderWidth: number | null = null;
    protected exportRenderHeight: number | null = null;

    // Tracks the starting state of a grid resize operation
    // This allows calculating total delta from drag start, avoiding per-frame rounding issues
    private gridResizeStart: GridResizeStart | null = null;

    constructor(public mapViewer: MapViewer) {
        super();
        this.gridRenderer = new GridRenderer2D();
        this.mapManager = new MapManager(
            mapViewer.workerPool.size * 2,
            this.queueLoadMap.bind(this),
        );
    }

    override async init() {
        this.mapViewer.inputManager.init(this.canvas);
    }

    override cleanUp(): void {
        this.mapViewer.inputManager.cleanUp();
    }

    initCache(): void {
        this.mapManager.init(
            this.mapViewer.mapFileIndex,
            SceneBuilder.fillEmptyTerrain(this.mapViewer.loadedCache.info),
        );
        this.mapManager.update(
            this.mapViewer.camera,
            this.stats.frameCount,
            this.mapViewer.renderDistance,
            this.mapViewer.unloadDistance,
        );
    }

    getControls(): Record<string, never> {
        return {};
    }

    queueLoadMap(mapX: number, mapY: number): void {}

    handleInput(deltaTime: number) {
        this.handleKeyInput(deltaTime);
        this.handleMouseInput();
        this.handleControllerInput(deltaTime);
        this.mapViewer.camera.updateAnimation(deltaTime);
    }

    handleKeyInput(deltaTime: number) {
        const deltaTimeSec = deltaTime / 1000;

        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        let cameraSpeedMult = 1.0;
        if (inputManager.isShiftDown()) {
            cameraSpeedMult = 10.0;
        }
        if (inputManager.isKeyDown("Tab")) {
            cameraSpeedMult = 0.1;
        }

        // camera position controls
        let deltaX = 0;
        let deltaY = 0;
        let deltaZ = 0;

        const deltaPos = 16 * (this.mapViewer.cameraSpeed * cameraSpeedMult) * deltaTimeSec;
        const deltaHeight = 8 * (this.mapViewer.cameraSpeed * cameraSpeedMult) * deltaTimeSec;

        if (inputManager.isKeyDown("KeyW") || inputManager.isKeyDown("ArrowUp")) {
            // Forward
            deltaZ -= deltaPos;
        }
        if (inputManager.isKeyDown("KeyA") || inputManager.isKeyDown("ArrowLeft")) {
            // Left
            deltaX += deltaPos;
        }
        if (inputManager.isKeyDown("KeyS") || inputManager.isKeyDown("ArrowDown")) {
            // Back
            deltaZ += deltaPos;
        }
        if (inputManager.isKeyDown("KeyD") || inputManager.isKeyDown("ArrowRight")) {
            // Right
            deltaX -= deltaPos;
        }

        if (deltaX !== 0 || deltaZ !== 0) {
            camera.move(deltaX, 0, deltaZ);
        }
        if (deltaY !== 0) {
            camera.move(0, deltaY, 0);
        }
    }

    handleMouseInput() {
        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        // Check for grid edge proximity and update cursor when not dragging
        // Use CSS pixel dimensions (clientWidth/Height) not canvas pixel dimensions (width/height)
        // because mouse coordinates from getMousePos are in CSS pixels
        if (!inputManager.isDragging() && inputManager.isFocused()) {
            const edgeProximity = this.gridRenderer.getEdgeProximity(
                inputManager.mouseX,
                inputManager.mouseY,
                camera,
                this.canvas.clientWidth,
                this.canvas.clientHeight,
            );
            inputManager.setCursor(getCursorForEdge(edgeProximity));

            // Store edge proximity for potential resize on next mousedown
            // This is checked in the mousedown handler to decide resize vs pan
            if (edgeProximity) {
                inputManager.startGridResize(edgeProximity);
            } else {
                inputManager.stopGridResize();
            }

            // Clear resize start state when not dragging
            this.gridResizeStart = null;
        }

        // Handle grid resize drag
        if (inputManager.isDragging() && inputManager.isResizingGrid()) {
            // Initialize resize start state on first frame of drag
            if (!this.gridResizeStart) {
                const settings = this.gridRenderer.getSettings();
                this.gridResizeStart = {
                    dragX: inputManager.dragX,
                    dragY: inputManager.dragY,
                    worldX: settings.worldX,
                    worldZ: settings.worldZ,
                    widthInCells: settings.widthInCells,
                    heightInCells: settings.heightInCells,
                };
            }

            // Calculate total delta from the start of the drag (not per-frame delta)
            // This avoids rounding errors when converting small pixel movements to grid cells
            const totalDeltaX = this.gridResizeStart.dragX - inputManager.mouseX;
            const totalDeltaY = this.gridResizeStart.dragY - inputManager.mouseY;

            this.handleGridResize(totalDeltaX, totalDeltaY, inputManager.resizingEdge!);
        } else if (inputManager.isDragging()) {
            // Normal camera pan mode
            const deltaMouseX = inputManager.getDeltaMouseX();
            const deltaMouseY = inputManager.getDeltaMouseY();

            if (deltaMouseX !== 0 || deltaMouseY !== 0) {
                // Pan camera - scale inversely with zoom so it feels like dragging the map
                const panScale = 4 / camera.orthoZoom;
                camera.move(-deltaMouseX * panScale, 0, deltaMouseY * panScale);
            }
        }

        const deltaScroll = inputManager.getDeltaMouseScroll();

        if (deltaScroll !== 0) {
            camera.orthoZoom = clamp(camera.orthoZoom - deltaScroll, 15, 200);
            camera.updated = true;
        }

        // Pinch zoom (trackpad and mobile)
        const deltaPinch = inputManager.getDeltaPinchZoom();

        if (deltaPinch !== 0) {
            camera.orthoZoom = clamp(camera.orthoZoom + deltaPinch, 15, 200);
            camera.updated = true;
        }
    }

    /**
     * Handles grid resize based on which edge is being dragged.
     * Converts screen delta to world delta and adjusts grid settings accordingly.
     * Uses gridResizeStart to calculate new positions from the initial state,
     * avoiding cumulative rounding errors.
     */
    private handleGridResize(
        totalDeltaScreenX: number,
        totalDeltaScreenY: number,
        edge: GridEdgeProximity,
    ): void {
        if (!this.gridResizeStart) return;

        const camera = this.mapViewer.camera;
        const startSettings = this.gridResizeStart;

        // Convert total screen delta to world delta
        const { deltaWorldX, deltaWorldZ } = this.gridRenderer.screenDeltaToWorldDelta(
            totalDeltaScreenX,
            totalDeltaScreenY,
            camera,
        );

        // Start from the initial settings at drag start
        // Grid bounds:
        // gridMinX = worldX (left edge)
        // gridMaxX = worldX + widthInCells (right edge)
        // gridMinZ = worldZ - heightInCells (bottom/south edge)
        // gridMaxZ = worldZ (top/north edge)

        let newWorldX = startSettings.worldX;
        let newWorldZ = startSettings.worldZ;
        let newWidth = startSettings.widthInCells;
        let newHeight = startSettings.heightInCells;

        // Handle horizontal edges (left/right) - affect X and width
        if (edge.left) {
            // Moving left edge: worldX changes, width adjusts to keep right edge fixed
            const rightEdge = startSettings.worldX + startSettings.widthInCells;
            newWorldX = Math.round(startSettings.worldX + deltaWorldX);
            newWidth = rightEdge - newWorldX;
        }
        if (edge.right) {
            // Moving right edge: width changes, worldX stays fixed
            newWidth = Math.round(startSettings.widthInCells + deltaWorldX);
        }

        // Handle vertical edges (top/bottom) - affect Z and height
        if (edge.top) {
            // Moving top (north) edge: worldZ changes, height adjusts to keep bottom edge fixed
            const bottomEdge = startSettings.worldZ - startSettings.heightInCells;
            newWorldZ = Math.round(startSettings.worldZ + deltaWorldZ);
            newHeight = newWorldZ - bottomEdge;
        }
        if (edge.bottom) {
            // Moving bottom (south) edge: height changes, worldZ stays fixed
            newHeight = Math.round(startSettings.heightInCells - deltaWorldZ);
        }

        // Clamp dimensions to valid range
        newWidth = clamp(newWidth, MINIMUM_GRID_SIZE, MAXIMUM_GRID_SIZE);
        newHeight = clamp(newHeight, MINIMUM_GRID_SIZE, MAXIMUM_GRID_SIZE);

        // If clamping affected width, adjust worldX for left edge to keep right edge fixed
        if (edge.left) {
            const rightEdge = startSettings.worldX + startSettings.widthInCells;
            newWorldX = rightEdge - newWidth;
        }

        // If clamping affected height, adjust worldZ for top edge to keep bottom edge fixed
        if (edge.top) {
            const bottomEdge = startSettings.worldZ - startSettings.heightInCells;
            newWorldZ = bottomEdge + newHeight;
        }

        // Apply changes
        this.gridRenderer.setSettings({
            worldX: newWorldX,
            worldZ: newWorldZ,
            widthInCells: newWidth,
            heightInCells: newHeight,
        });
    }

    handleControllerInput(deltaTime: number) {
        const deltaPitch = deltaTime;
        const deltaYaw = deltaTime;

        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        // controller
        const gamepad = inputManager.getGamepad();

        if (gamepad && gamepad.connected && gamepad.mapping === "standard") {
            let cameraSpeedMult = 0.01;
            // X, R1
            if (gamepad.buttons[0].pressed || gamepad.buttons[5].pressed) {
                cameraSpeedMult = 0.1;
            }

            const zone = 0.1;

            const leftX = getAxisDeadzone(gamepad.axes[0], zone);
            const leftY = getAxisDeadzone(-gamepad.axes[1], zone);
            const leftTrigger = gamepad.buttons[6].value;

            const rightX = getAxisDeadzone(gamepad.axes[2], zone);
            const rightY = getAxisDeadzone(-gamepad.axes[3], zone);
            const rightTrigger = gamepad.buttons[7].value;

            const trigger = leftTrigger - rightTrigger;

            if (leftX !== 0 || leftY !== 0 || trigger !== 0) {
                camera.move(
                    leftX * cameraSpeedMult * -deltaTime,
                    0,
                    leftY * cameraSpeedMult * -deltaTime,
                    false,
                );
                camera.move(0, trigger * cameraSpeedMult * -deltaTime, 0);
            }

            if (rightX !== 0) {
                camera.updateYaw(camera.yaw, deltaYaw * 1.5 * rightX);
            }
            if (rightY !== 0) {
                camera.updatePitch(camera.pitch, deltaPitch * 1.5 * rightY);
            }
        }
    }

    override onFrameEnd(): void {
        super.onFrameEnd();

        this.gridRenderer.draw(this.overlayCanvas, this.mapViewer.camera);

        if (window.wallpaperFpsLimit !== undefined) {
            this.fpsLimit = window.wallpaperFpsLimit;
        }

        if (this.mapViewer.camera.updated) {
            this.mapViewer.updateSearchParams();
        }

        this.mapViewer.inputManager.onFrameEnd();
        this.mapViewer.camera.onFrameEnd();

        // this.mapViewer.debugText = `Frame Time Js: ${this.stats.frameTimeJs.toFixed(3)}`;
    }

    /**
     * Called after resize but before rendering for export.
     * Subclasses can override to prepare resources at the new resolution (e.g., recreate framebuffers).
     */
    protected prepareForExport(): void {
        // Base implementation does nothing - subclasses override as needed
    }

    /**
     * Called before capturing the canvas for export.
     * Subclasses can override to ensure rendering is complete (e.g., gl.finish()).
     */
    protected waitForRenderComplete(): void {
        // Base implementation does nothing - subclasses override for GPU sync
    }

    /**
     * Renders a single frame at a specific resolution for export.
     * Temporarily modifies canvas size and camera, renders, captures the result,
     * then restores state.
     * @param targetWidth Target canvas width in pixels
     * @param targetHeight Target canvas height in pixels
     * @param orthoZoom Camera orthoZoom value for the export
     * @returns Promise with ImageBitmap of the rendered frame
     */
    async renderForExport(
        targetWidth: number,
        targetHeight: number,
        orthoZoom: number,
    ): Promise<ImageBitmap> {
        // Save current state
        const originalWidth = this.canvas.width;
        const originalHeight = this.canvas.height;
        const originalOverlayWidth = this.overlayCanvas.width;
        const originalOverlayHeight = this.overlayCanvas.height;
        const originalOrthoZoom = this.mapViewer.camera.orthoZoom;

        // Clear any pending scroll input to prevent it from modifying orthoZoom during render
        // This fixes a race condition where user scroll events could corrupt export resolution
        this.mapViewer.inputManager.getDeltaMouseScroll();

        // Temporarily resize BOTH canvases
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
        this.overlayCanvas.width = targetWidth;
        this.overlayCanvas.height = targetHeight;
        this.onResize(targetWidth, targetHeight);

        // Prepare renderer resources for export (e.g., recreate framebuffers at new size)
        this.prepareForExport();

        // Temporarily adjust camera
        this.mapViewer.camera.orthoZoom = orthoZoom;
        this.mapViewer.camera.updated = true;
        this.mapViewer.camera.update(targetWidth, targetHeight);

        // Set export dimensions so render() uses these instead of app dimensions
        // This bypasses potential issues with app.resize() not updating correctly
        this.exportRenderWidth = targetWidth;
        this.exportRenderHeight = targetHeight;

        // Render a single frame
        const time = performance.now();
        this.render(time, 0, true);

        // Clear export dimensions
        this.exportRenderWidth = null;
        this.exportRenderHeight = null;

        // Ensure GPU has finished rendering before capturing
        // This prevents race conditions at higher resolutions where GPU work takes longer
        this.waitForRenderComplete();

        // Capture the rendered frame before restoring
        const bitmap = await createImageBitmap(this.canvas);

        // Restore original state
        this.canvas.width = originalWidth;
        this.canvas.height = originalHeight;
        this.overlayCanvas.width = originalOverlayWidth;
        this.overlayCanvas.height = originalOverlayHeight;
        this.onResize(originalWidth, originalHeight);

        // Restore renderer resources to original dimensions
        this.prepareForExport();

        this.mapViewer.camera.orthoZoom = originalOrthoZoom;
        this.mapViewer.camera.updated = true;
        this.mapViewer.camera.update(originalWidth, originalHeight);

        return bitmap;
    }
}
