import { Schema } from "leva/dist/declarations/src/types";

import { GridRenderer2D, GridSettings } from "../components/renderer/GridRenderer2D";
import { Renderer } from "../components/renderer/Renderer";
import { SceneBuilder } from "../rs/scene/SceneBuilder";
import { clamp } from "../util/MathUtil";
import { getAxisDeadzone } from "./InputManager";
import { MapManager, MapSquare } from "./MapManager";
import { MapViewer } from "./MapViewer";
import { MapViewerRendererType } from "./MapViewerRenderers";

export abstract class MapViewerRenderer<T extends MapSquare = MapSquare> extends Renderer {
    abstract type: MapViewerRendererType;

    mapManager: MapManager<T>;
    gridRenderer: GridRenderer2D;

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

    getControls(): Schema {
        return {};
    }

    queueLoadMap(mapX: number, mapY: number): void {}

    handleInput(deltaTime: number) {
        this.handleKeyInput(deltaTime);
        this.handleMouseInput();
        this.handleControllerInput(deltaTime);
        this.handleJoystickInput(deltaTime);
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

        // mouse/touch controls - drag to pan
        const deltaMouseX = inputManager.getDeltaMouseX();
        const deltaMouseY = inputManager.getDeltaMouseY();

        if (deltaMouseX !== 0 || deltaMouseY !== 0) {
            // Pan camera - scale inversely with zoom so it feels like dragging the map
            const panScale = 4 / camera.orthoZoom;
            camera.move(-deltaMouseX * panScale, 0, deltaMouseY * panScale);
        }

        const deltaScroll = inputManager.getDeltaMouseScroll();

        if (deltaScroll !== 0) {
            camera.orthoZoom = clamp(camera.orthoZoom - deltaScroll, 15, 200);
            camera.updated = true;
        }
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

    handleJoystickInput(deltaTime: number) {
        const deltaTimeSec = deltaTime / 1000;

        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        const deltaPitch = 64 * 5 * deltaTimeSec;
        const deltaYaw = 64 * 5 * deltaTimeSec;

        // joystick controls
        const positionJoystickEvent = inputManager.positionJoystickEvent;
        const cameraJoystickEvent = inputManager.cameraJoystickEvent;

        if (positionJoystickEvent) {
            const moveX = positionJoystickEvent.x ?? 0;
            const moveY = positionJoystickEvent.y ?? 0;

            camera.move(moveX * 32 * -deltaTimeSec, 0, moveY * 32 * -deltaTimeSec);
        }

        if (cameraJoystickEvent) {
            const moveX = cameraJoystickEvent.x ?? 0;
            const moveY = cameraJoystickEvent.y ?? 0;
            camera.updatePitch(camera.pitch, deltaPitch * 1.5 * moveY);
            camera.updateYaw(camera.yaw, deltaYaw * 1.5 * moveX);
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
}
