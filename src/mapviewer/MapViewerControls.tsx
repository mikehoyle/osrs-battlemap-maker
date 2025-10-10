import { Leva, LevaInputs, button, folder, useControls } from "leva";
import { Schema } from "leva/dist/declarations/src/types";
import { memo, useEffect, useState } from "react";

import { DownloadProgress } from "../rs/cache/CacheFiles";
import { isTouchDevice } from "../util/DeviceUtil";
import { loadCacheFiles } from "./Caches";
import { ProjectionType } from "./Camera";
import { MapViewer } from "./MapViewer";
import { MapViewerRenderer } from "./MapViewerRenderer";
import {
    MapViewerRendererType,
    createRenderer,
    getAvailableRenderers,
    getRendererName,
} from "./MapViewerRenderers";
import { fetchNpcSpawns, getNpcSpawnsUrl } from "./data/npc/NpcSpawn";

interface MapViewerControlsProps {
    renderer: MapViewerRenderer;
    hideUi: boolean;
    setRenderer: (renderer: MapViewerRenderer) => void;
    setHideUi: (hideUi: boolean | ((hideUi: boolean) => boolean)) => void;
    setDownloadProgress: (progress: DownloadProgress | undefined) => void;
}

enum VarType {
    VARP = 0,
    VARBIT = 1,
}

export const MapViewerControls = memo(
    ({
        renderer,
        hideUi: hidden,
        setRenderer,
        setHideUi,
        setDownloadProgress,
    }: MapViewerControlsProps): JSX.Element => {
        const mapViewer = renderer.mapViewer;

        const [projectionType, setProjectionType] = useState<ProjectionType>(
            mapViewer.camera.projectionType,
        );

        const [isExportingBattlemap, setExportingBattlemap] = useState(false);

        // TODO: update control instructions
        const positionControls = isTouchDevice
            ? "Left joystick, Drag up and down."
            : "WASD,\nR or E (up),\nF or C (down),\nUse SHIFT to go faster, or TAB to go slower.";
        const directionControls = isTouchDevice
            ? "Right joystick."
            : "Arrow Keys or Click and Drag. Double click for pointerlock.";

        const controlsSchema: Schema = {
            Position: { value: positionControls, editable: false },
            Direction: { value: directionControls, editable: false },
        };

        useEffect(() => {
            function handleKeyDown(e: KeyboardEvent) {
                if (e.repeat) {
                    return;
                }

                // TODO remove?
                switch (e.key) {
                    case "F1":
                        setHideUi((v) => !v);
                        break;
                }
            }

            document.addEventListener("keydown", handleKeyDown);

            return () => {
                document.removeEventListener("keydown", handleKeyDown);
            };
        }, [mapViewer]);

        const rendererOptions: Record<string, MapViewerRendererType> = {};
        for (let v of getAvailableRenderers()) {
            rendererOptions[getRendererName(v)] = v;
        }

        useControls(
            {
                Camera: folder(
                    {
                        ...createCameraControls(mapViewer),
                        "Move Speed": {
                            value: mapViewer.cameraSpeed,
                            min: 0.1,
                            max: 5,
                            step: 0.1,
                            onChange: (v: number) => {
                                mapViewer.cameraSpeed = v;
                            },
                            order: 10,
                        },
                        Controls: folder(controlsSchema, { collapsed: true, order: 999 }),
                    },
                    { collapsed: false },
                ),
                Grid: folder(
                    {
                        Enabled: {
                            value: mapViewer.renderer.gridRenderer.getSettings().enabled,
                            type: LevaInputs.BOOLEAN,
                            onChange: (value: boolean) => {
                                mapViewer.renderer.gridRenderer.setSettings({
                                    enabled: value,
                                });
                            },
                        },
                        "Line Width": {
                            value: mapViewer.renderer.gridRenderer.getSettings().width,
                            min: 1,
                            max: 10,
                            step: 1,
                            onChange: (value: number) => {
                                mapViewer.renderer.gridRenderer.setSettings({
                                    width: value,
                                });
                            },
                        },
                        Color: {
                            value: mapViewer.renderer.gridRenderer.getSettings().color,
                            type: LevaInputs.COLOR,
                            onChange: (value: { r: number; g: number; b: number; a?: number }) => {
                                mapViewer.renderer.gridRenderer.setSettings({
                                    color: value,
                                });
                            },
                        },
                    },
                    { collapsed: false },
                ),
                // Render distance options removed -- not really relevant for top-down only
                Cache: folder(
                    {
                        Version: {
                            value: mapViewer.loadedCache.info.name,
                            options: mapViewer.cacheList.caches.map((cache) => cache.name),
                            onChange: async (v: string) => {
                                const cacheInfo = mapViewer.cacheList.caches.find(
                                    (cache) => cache.name === v,
                                );
                                if (v !== mapViewer.loadedCache.info.name && cacheInfo) {
                                    const [loadedCache, npcSpawns] = await Promise.all([
                                        loadCacheFiles(cacheInfo, undefined, setDownloadProgress),
                                        fetchNpcSpawns(getNpcSpawnsUrl(cacheInfo)),
                                    ]);
                                    mapViewer.npcSpawns = npcSpawns;
                                    mapViewer.initCache(loadedCache);
                                    setDownloadProgress(undefined);
                                }
                            },
                        },
                    },
                    { collapsed: true },
                ),
                Render: folder(
                    {
                        Renderer: {
                            value: renderer.type,
                            options: rendererOptions,
                            onChange: (v: MapViewerRendererType) => {
                                if (renderer.type !== v) {
                                    const renderer = createRenderer(v, mapViewer);
                                    mapViewer.setRenderer(renderer);
                                    setRenderer(renderer);
                                }
                            },
                        },
                        "Fps Limit": {
                            value: renderer.fpsLimit,
                            min: 1,
                            max: 999,
                            onChange: (v: number) => {
                                renderer.fpsLimit = v;
                            },
                        },
                        ...renderer.getControls(),
                    },
                    { collapsed: true },
                ),
                // Menu and Vars removed, unneeded
                // Record removed
                Export: folder(
                    {
                        "Export Map": button(
                            () => {
                                if (isExportingBattlemap) {
                                    return;
                                }
                                setExportingBattlemap(true);
                                // TODO: Implement this!
                            },
                            { disabled: isExportingBattlemap },
                        ),
                    },
                    { collapsed: true },
                ),
            },
            [renderer, projectionType, isExportingBattlemap],
        );

        return (
            <Leva
                titleBar={{ filter: false }}
                collapsed={true}
                hideCopyButton={true}
                hidden={hidden}
            />
        );
    },
);

function createCameraControls(mapViewer: MapViewer): Schema {
    if (mapViewer.camera.projectionType === ProjectionType.PERSPECTIVE) {
        return {
            FOV: {
                value: mapViewer.camera.fov,
                min: 30,
                max: 140,
                step: 1,
                onChange: (v: number) => {
                    mapViewer.camera.fov = v;
                },
            },
        };
    } else {
        return {
            Zoom: {
                value: mapViewer.camera.orthoZoom,
                min: 1,
                max: 100,
                step: 1,
                onChange: (v: number) => {
                    mapViewer.camera.orthoZoom = v;
                },
            },
        };
    }
}
