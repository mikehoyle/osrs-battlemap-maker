import { mat4, vec3 } from "gl-matrix";
import { isNil } from "lodash";

import { DEGREES_TO_RADIANS, RS_TO_RADIANS } from "../rs/MathConstants";
import { Frustum } from "./Frustum";

export interface CameraView {
    position: vec3;
    pitch: number;
    yaw: number;
    fov: number;
    orthoZoom: number;
}

export enum ProjectionType {
    PERSPECTIVE,
    ORTHO,
}

export class Camera {
    static moveCameraRotOrigin: vec3 = vec3.create();
    static deltaTemp: vec3 = vec3.create();

    floatPosition: vec3;
    snappedPositionCache: vec3 = vec3.create();

    pitch: number;
    yaw: number;

    projectionType: ProjectionType = ProjectionType.PERSPECTIVE;

    fov: number = 90;
    orthoZoom: number = 75;
    snapToGrid: boolean = true;

    projectionMatrix: mat4 = mat4.create();
    cameraMatrix: mat4 = mat4.create();
    viewMatrix: mat4 = mat4.create();
    viewProjMatrix: mat4 = mat4.create();

    frustum = new Frustum();

    updated: boolean = false;
    updatedPosition: boolean = false;
    updatedLastFrame: boolean = false;

    constructor(x: number, y: number, z: number, pitch: number, yaw: number) {
        this.floatPosition = vec3.fromValues(x, y, z);
        this.pitch = pitch;
        this.yaw = yaw;
    }

    get pos(): vec3 {
        if (this.snapToGrid) {
            vec3.set(
                this.snappedPositionCache,
                Math.floor(this.floatPosition[0]),
                Math.floor(this.floatPosition[1]),
                Math.floor(this.floatPosition[2]),
            );
            return this.snappedPositionCache;
        }
        return this.floatPosition;
    }

    set pos(position: vec3) {
        this.floatPosition = position;
    }

    setProjectionType(type: ProjectionType) {
        this.projectionType = type;
        this.updated = true;
    }

    move(deltaX: number, deltaY: number, deltaZ: number, rotatePitch: boolean = false): void {
        Camera.deltaTemp[0] = deltaX;
        Camera.deltaTemp[1] = deltaY;
        Camera.deltaTemp[2] = deltaZ;

        // Removing ability to update pitch/yaw at the source for now
        /*if (rotatePitch) {
            vec3.rotateX(
                Camera.deltaTemp,
                Camera.deltaTemp,
                Camera.moveCameraRotOrigin,
                -this.pitch * RS_TO_RADIANS,
            );
        }*/
        vec3.rotateY(
            Camera.deltaTemp,
            Camera.deltaTemp,
            Camera.moveCameraRotOrigin,
            (this.yaw - 1024) * RS_TO_RADIANS,
        );

        vec3.add(this.floatPosition, this.floatPosition, Camera.deltaTemp);
        this.updated = true;
        this.updatedPosition = true;
    }

    teleport(x?: number, y?: number, z?: number): void {
        console.log("teleporting!", { x, y, z });
        let updated = false;
        if (!isNil(x) && x !== this.floatPosition[0]) {
            this.floatPosition[0] = x;
            updated = true;
        }

        if (!isNil(y) && y !== this.floatPosition[1]) {
            this.floatPosition[1] = y;
            updated = true;
        }

        if (!isNil(z) && z !== this.floatPosition[z]) {
            this.floatPosition[2] = z;
            updated = true;
        }

        this.updated = updated;
    }

    // Removing ability to update pitch/yaw at the source for now
    updatePitch(pitch: number, deltaPitch: number): void {
        /*const maxPitch = this.projectionType === ProjectionType.PERSPECTIVE ? 512 : 0;
        this.pitch = clamp(pitch + deltaPitch, -512, maxPitch);
        this.updated = true;*/
    }

    getYaw(): number {
        return this.yaw & 2047;
    }

    setYaw(yaw: number): void {
        this.yaw = yaw;
        this.updated = true;
    }

    // Removing ability to update pitch/yaw at the source for now
    updateYaw(yaw: number, deltaYaw: number): void {
        /*this.setYaw(yaw + deltaYaw);*/
    }

    update(width: number, height: number) {
        // Projection
        mat4.identity(this.projectionMatrix);
        if (this.projectionType === ProjectionType.PERSPECTIVE) {
            mat4.perspective(
                this.projectionMatrix,
                this.fov * DEGREES_TO_RADIANS,
                width / height,
                0.1,
                1024.0 * 4,
            );
        } else {
            mat4.ortho(
                this.projectionMatrix,
                -width / this.orthoZoom,
                width / this.orthoZoom,
                -height / this.orthoZoom,
                height / this.orthoZoom,
                -1024.0 * 4,
                1024.0 * 4,
            );
        }

        // View
        const pitch = this.pitch * RS_TO_RADIANS;
        const yaw = (this.yaw - 1024) * RS_TO_RADIANS;

        mat4.identity(this.cameraMatrix);

        mat4.translate(this.cameraMatrix, this.cameraMatrix, this.pos);
        mat4.rotateY(this.cameraMatrix, this.cameraMatrix, yaw);
        mat4.rotateZ(this.cameraMatrix, this.cameraMatrix, 180 * DEGREES_TO_RADIANS); // Roll
        mat4.rotateX(this.cameraMatrix, this.cameraMatrix, pitch);

        mat4.invert(this.viewMatrix, this.cameraMatrix);

        // Calculate view projection matrix
        mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);

        this.frustum.setPlanes(this.viewProjMatrix);
    }

    onFrameEnd() {
        this.updatedLastFrame = this.updated;
        this.updated = false;
        this.updatedPosition = false;
    }

    getPosX(): number {
        return this.pos[0];
    }

    getPosY(): number {
        return this.pos[1];
    }

    getPosZ(): number {
        return this.pos[2];
    }

    getMapX(): number {
        return this.getPosX() >> 6;
    }

    getMapY(): number {
        return this.getPosZ() >> 6;
    }
}
