import { vec2 } from "gl-matrix";

export function getMousePos(container: HTMLElement, event: MouseEvent | Touch): vec2 {
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return [x, y];
}

export function getAxisDeadzone(axis: number, zone: number): number {
    if (Math.abs(axis) < zone) {
        return 0;
    } else if (axis < 0) {
        return axis + zone;
    } else {
        return axis - zone;
    }
}

function getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

export class InputManager {
    element?: HTMLElement;

    keys: Map<string, boolean> = new Map();

    mouseX: number = -1;
    mouseY: number = -1;

    lastMouseX: number = -1;
    lastMouseY: number = -1;

    dragX: number = -1;
    dragY: number = -1;

    deltaMouseX: number = 0;
    deltaMouseY: number = 0;
    deltaMouseScroll: number = 0;

    isTouch: boolean = false;

    // Pinch zoom tracking
    isPinching: boolean = false;
    pinchStartDistance: number = 0;
    pinchLastDistance: number = 0;
    deltaPinchZoom: number = 0;

    pickX: number = -1;
    pickY: number = -1;

    gamepadIndex?: number;

    init(element: HTMLElement) {
        if (!this.element) {
            this.cleanUp();
        }
        this.element = element;
        this.element.style.cursor = "grab";

        window.addEventListener("gamepadconnected", this.onGamepadConnected);
        window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected);

        element.addEventListener("keydown", this.onKeyDown);
        element.addEventListener("keyup", this.onKeyUp);

        element.addEventListener("mousedown", this.onMouseDown);
        element.addEventListener("mousemove", this.onMouseMove);
        element.addEventListener("mouseup", this.onMouseUp);
        element.addEventListener("mouseleave", this.onMouseLeave);
        // Use passive: false to allow preventDefault for trackpad pinch zoom
        element.addEventListener("wheel", this.onMouseWheel, { passive: false });

        // Use passive: false to allow preventDefault for touch events (prevents browser zoom/scroll)
        element.addEventListener("touchstart", this.onTouchStart, { passive: false });
        element.addEventListener("touchmove", this.onTouchMove, { passive: false });
        element.addEventListener("touchend", this.onTouchEnd);

        element.addEventListener("contextmenu", this.onContextMenu);

        element.addEventListener("focusout", this.onFocusOut);
    }

    cleanUp() {
        if (!this.element) {
            return;
        }

        window.removeEventListener("gamepadconnected", this.onGamepadConnected);
        window.removeEventListener("gamepaddisconnected", this.onGamepadDisconnected);

        this.element.removeEventListener("keydown", this.onKeyDown);
        this.element.removeEventListener("keyup", this.onKeyUp);

        this.element.removeEventListener("mousedown", this.onMouseDown);
        this.element.removeEventListener("mousemove", this.onMouseMove);
        this.element.removeEventListener("mouseup", this.onMouseUp);
        this.element.removeEventListener("mouseleave", this.onMouseLeave);

        this.element.removeEventListener("touchstart", this.onTouchStart);
        this.element.removeEventListener("touchmove", this.onTouchMove);
        this.element.removeEventListener("touchend", this.onTouchEnd);

        this.element.removeEventListener("contextmenu", this.onContextMenu);

        this.element.removeEventListener("focusout", this.onFocusOut);
    }

    isShiftDown(): boolean {
        return this.isKeyDown("ShiftLeft") || this.isKeyDown("ShiftRight");
    }

    isKeyDown(key: string): boolean {
        return this.keys.has(key);
    }

    isKeyDownEvent(key: string): boolean {
        return !!this.keys.get(key);
    }

    isDragging(): boolean {
        return this.dragX !== -1 && this.dragY !== -1;
    }

    isFocused(): boolean {
        return this.mouseX !== -1 && this.mouseY !== -1;
    }

    hasMovedMouse(): boolean {
        return this.lastMouseX !== this.mouseX || this.lastMouseY !== this.mouseY;
    }

    getDeltaMouseX(): number {
        if (this.isDragging()) {
            return this.dragX - this.mouseX;
        }
        return 0;
    }

    getDeltaMouseY(): number {
        if (this.isDragging()) {
            return this.dragY - this.mouseY;
        }
        return 0;
    }

    getDeltaMouseScroll(): number {
        // TODO: Revisit if needed, kinda jank for now, just getting it working
        const scroll = this.deltaMouseScroll;
        this.deltaMouseScroll = 0;
        return scroll;
    }

    getDeltaPinchZoom(): number {
        const pinch = this.deltaPinchZoom;
        this.deltaPinchZoom = 0;
        return pinch;
    }

    getGamepad(): Gamepad | null {
        let gamepad: Gamepad | null = null;
        if (this.gamepadIndex !== undefined) {
            const gamepads = navigator.getGamepads();
            if (gamepads) {
                gamepad = gamepads[this.gamepadIndex];
            }
        }
        return gamepad;
    }

    private onGamepadConnected = (event: GamepadEvent) => {
        this.gamepadIndex = event.gamepad.index;
    };

    private onGamepadDisconnected = (event: GamepadEvent) => {
        this.gamepadIndex = undefined;
    };

    private onKeyDown = (event: KeyboardEvent) => {
        event.preventDefault();
        this.keys.set(event.code, true);
    };

    private onKeyUp = (event: KeyboardEvent) => {
        event.preventDefault();
        this.keys.delete(event.code);
    };

    private onMouseDown = (event: MouseEvent) => {
        if (event.button !== 0 || !this.element) {
            return;
        }
        const [x, y] = getMousePos(this.element, event);
        this.dragX = x;
        this.dragY = y;
        this.mouseX = x;
        this.mouseY = y;
        this.element.style.cursor = "grabbing";
    };

    private onMouseMove = (event: MouseEvent) => {
        if (!this.element) {
            return;
        }
        const [x, y] = getMousePos(this.element, event);
        this.mouseX = x;
        this.mouseY = y;

        this.isTouch = false;
    };

    private onMouseUp = (event: MouseEvent) => {
        this.dragX = -1;
        this.dragY = -1;
        if (this.element) {
            this.element.style.cursor = "grab";
        }
    };

    private onMouseLeave = (event: MouseEvent) => {
        this.resetMouse();
        if (this.element) {
            this.element.style.cursor = "grab";
        }
    };

    private onMouseWheel = (event: WheelEvent) => {
        // Trackpad pinch gestures fire as wheel events with ctrlKey=true
        // We need to prevent browser zoom and handle it ourselves
        if (event.ctrlKey) {
            event.preventDefault();
            // Pinch zoom: deltaY is positive when pinching out (zoom in), negative when pinching in
            // Use a smaller multiplier for smoother trackpad pinch response
            this.deltaPinchZoom = event.deltaY * 0.5;
        } else {
            this.deltaMouseScroll = event.deltaY;
        }
    };

    private onTouchStart = (event: TouchEvent) => {
        if (!this.element) {
            return;
        }

        // Two-finger pinch zoom
        if (event.touches.length === 2) {
            event.preventDefault();
            this.isPinching = true;
            const distance = getTouchDistance(event.touches[0], event.touches[1]);
            this.pinchStartDistance = distance;
            this.pinchLastDistance = distance;
            // Stop any ongoing drag when starting a pinch
            this.dragX = -1;
            this.dragY = -1;
            return;
        }

        // Single touch - drag to pan
        const [x, y] = getMousePos(this.element, event.touches[0]);
        this.dragX = x;
        this.dragY = y;
        this.mouseX = x;
        this.mouseY = y;
        this.isTouch = true;
        this.element.style.cursor = "grabbing";
    };

    private onTouchMove = (event: TouchEvent) => {
        if (!this.element) {
            return;
        }

        // Two-finger pinch zoom
        if (event.touches.length === 2 && this.isPinching) {
            event.preventDefault();
            const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
            // Calculate delta based on change from last frame, not start
            // Positive delta = fingers moving apart = zoom in (decrease orthoZoom for larger view)
            // Negative delta = fingers moving together = zoom out (increase orthoZoom for smaller view)
            const distanceDelta = this.pinchLastDistance - currentDistance;
            // Scale the delta - larger movements = faster zoom
            this.deltaPinchZoom = distanceDelta * 0.5;
            this.pinchLastDistance = currentDistance;
            return;
        }

        // Single touch drag
        if (event.touches.length === 1 && !this.isPinching) {
            const [x, y] = getMousePos(this.element, event.touches[0]);
            this.mouseX = x;
            this.mouseY = y;
        }
    };

    private onTouchEnd = (event: TouchEvent) => {
        // If we were pinching and a finger was lifted
        if (this.isPinching) {
            // Reset pinch state
            this.isPinching = false;
            this.pinchStartDistance = 0;
            this.pinchLastDistance = 0;

            // If one finger remains, transition to single-touch pan
            if (event.touches.length === 1 && this.element) {
                const [x, y] = getMousePos(this.element, event.touches[0]);
                this.dragX = x;
                this.dragY = y;
                this.mouseX = x;
                this.mouseY = y;
                this.isTouch = true;
                return;
            }
        }

        // All fingers lifted
        if (event.touches.length === 0) {
            this.dragX = -1;
            this.dragY = -1;
            if (this.element) {
                this.element.style.cursor = "grab";
            }
        }
    };

    private onContextMenu = (event: MouseEvent) => {
        if (!this.element) {
            return;
        }
        event.preventDefault();
        const [x, y] = getMousePos(this.element, event);
        this.pickX = x;
        this.pickY = y;
    };

    private onFocusOut = () => {
        console.log("Focus lost");
        this.keys.clear();
        this.resetMouse();
    };

    resetMouse() {
        this.mouseX = -1;
        this.mouseY = -1;
        this.dragX = -1;
        this.dragY = -1;
        // Also reset pinch state
        this.isPinching = false;
        this.pinchStartDistance = 0;
        this.pinchLastDistance = 0;
    }

    onFrameEnd() {
        for (const key of this.keys.keys()) {
            this.keys.set(key, false);
        }
        if (this.isDragging()) {
            this.dragX = this.mouseX;
            this.dragY = this.mouseY;
        }
        this.deltaMouseX = 0;
        this.deltaMouseY = 0;
        this.pickX = -1;
        this.pickY = -1;
        this.lastMouseX = this.mouseX;
        this.lastMouseY = this.mouseY;
    }
}
