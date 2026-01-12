import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { RendererCanvas } from "../components/renderer/RendererCanvas";
import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
import { OsrsMenu, OsrsMenuProps } from "../components/rs/menu/OsrsMenu";
import { MinimapContainer } from "../components/rs/minimap/MinimapContainer";
import { PlacesOfInterestDialog } from "../components/rs/places/PlacesOfInterestDialog";
import { WorldMapModal } from "../components/rs/worldmap/WorldMapModal";
import { RS_TO_DEGREES } from "../rs/MathConstants";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { formatBytes } from "../util/BytesUtil";
import { MapViewer } from "./MapViewer";
import "./MapViewerContainer.css";
import { MapViewerControls } from "./MapViewerControls";
import { MapViewerRenderer } from "./MapViewerRenderer";
import { PlaceOfInterest } from "./PlacesOfInterest";

// Set to true to show the FPS counter (for debugging)
const SHOW_FPS_COUNTER = false;

interface MapViewerContainerProps {
    mapViewer: MapViewer;
}

export function MapViewerContainer({ mapViewer }: MapViewerContainerProps): JSX.Element {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [renderer, setRenderer] = useState<MapViewerRenderer>(mapViewer.renderer);

    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();

    const [hideUi, setHideUi] = useState(false);
    const [fps, setFps] = useState(0);
    const [cameraYaw, setCameraYaw] = useState(mapViewer.camera.getYaw());
    const [isWorldMapOpen, setWorldMapOpen] = useState<boolean>(false);
    const [isPlacesDialogOpen, setPlacesDialogOpen] = useState<boolean>(false);

    const [menuProps, setMenuProps] = useState<OsrsMenuProps | undefined>(undefined);

    const requestRef = useRef<number | undefined>();

    const animate = useCallback(
        (time: DOMHighResTimeStamp) => {
            // Wait for 200ms before updating search params
            if (
                mapViewer.needsSearchParamUpdate &&
                performance.now() - mapViewer.lastTimeSearchParamsUpdated > 200
            ) {
                setSearchParams(mapViewer.getSearchParams(), { replace: true });
                mapViewer.needsSearchParamUpdate = false;
                console.log("Updated search params");
            }

            if (!hideUi) {
                setFps(Math.round(renderer.stats.frameTimeFps));
                setCameraYaw(mapViewer.camera.getYaw());
            }

            if (mapViewer.menuEntries.length > 0 && mapViewer.menuX !== -1 && mapViewer.menuY !== -1) {
                setMenuProps({
                    x: mapViewer.menuX,
                    y: mapViewer.menuY,
                    tooltip: !mapViewer.menuOpen,
                    entries: mapViewer.menuEntries,
                    debugId: mapViewer.debugId,
                });
            } else {
                setMenuProps(undefined);
            }

            requestRef.current = requestAnimationFrame(animate);
        },
        [mapViewer, renderer, hideUi, setSearchParams],
    );

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [animate]);

    const goBack = useCallback(() => {
        navigate("/");
    }, [navigate]);

    const resetCameraYaw = useCallback(() => {
        mapViewer.camera.setYaw(0);
    }, [mapViewer]);

    const openWorldMap = useCallback(() => {
        setWorldMapOpen(true);
    }, []);

    const closeWorldMap = useCallback(() => {
        setWorldMapOpen(false);
        renderer.canvas.focus();
    }, [renderer]);

    const openPlacesDialog = useCallback(() => {
        setPlacesDialogOpen(true);
    }, []);

    const closePlacesDialog = useCallback(() => {
        setPlacesDialogOpen(false);
        renderer.canvas.focus();
    }, [renderer]);

    const onPlaceSelected = useCallback(
        (place: PlaceOfInterest) => {
            mapViewer.camera.teleport(place.camera.x, undefined, place.camera.z);
            mapViewer.camera.orthoZoom = place.camera.zoom;
            renderer.gridRenderer.setSettings({
                worldX: place.grid.worldX,
                worldZ: place.grid.worldZ,
                widthInCells: place.grid.widthInCells,
                heightInCells: place.grid.heightInCells,
            });
        },
        [mapViewer, renderer],
    );

    const onMapClicked = useCallback(
        (x: number, y: number) => {
            // "y" is actually z from our camera's perspective
            mapViewer.camera.teleport(x, undefined, y);
            closeWorldMap();
        },
        [mapViewer, closeWorldMap],
    );

    const getMapPosition = useCallback(() => {
        const x = mapViewer.camera.getPosX();
        const y = mapViewer.camera.getPosZ();

        return {
            x,
            y,
        };
    }, [mapViewer]);

    const loadMapImageUrl = useCallback(
        (mapX: number, mapY: number) => {
            return mapViewer.getMapImageUrl(mapX, mapY, false);
        },
        [mapViewer],
    );

    const loadMinimapImageUrl = useCallback(
        (mapX: number, mapY: number) => {
            return mapViewer.getMapImageUrl(mapX, mapY, true);
        },
        [mapViewer],
    );

    let loadingBarOverlay: JSX.Element | undefined = undefined;
    if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress = ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        loadingBarOverlay = (
            <div className="overlay-container max-height">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    }

    return (
        <div className="max-height">
            {loadingBarOverlay}

            {menuProps && <OsrsMenu {...menuProps} />}

            <MapViewerControls
                renderer={renderer}
                hideUi={hideUi}
                setRenderer={setRenderer}
                setHideUi={setHideUi}
                setDownloadProgress={setDownloadProgress}
            />

            {!hideUi && (
                <span>
                    <div className="hud left-top">
                        <MinimapContainer
                            yawDegrees={(2047 - cameraYaw) * RS_TO_DEGREES}
                            onBackClick={goBack}
                            onCompassClick={resetCameraYaw}
                            onWorldMapClick={openWorldMap}
                            onPlacesOfInterestClick={openPlacesDialog}
                            getPosition={getMapPosition}
                            loadMapImageUrl={loadMinimapImageUrl}
                        />

                        {SHOW_FPS_COUNTER && (
                            <div className="fps-counter content-text">{fps}</div>
                        )}
                        {SHOW_FPS_COUNTER && (
                            <div className="fps-counter content-text">{mapViewer.debugText}</div>
                        )}
                    </div>
                    <WorldMapModal
                        isOpen={isWorldMapOpen}
                        onRequestClose={closeWorldMap}
                        onDoubleClick={onMapClicked}
                        getPosition={getMapPosition}
                        loadMapImageUrl={loadMapImageUrl}
                    />
                    <PlacesOfInterestDialog
                        isOpen={isPlacesDialogOpen}
                        onRequestClose={closePlacesDialog}
                        onPlaceSelected={onPlaceSelected}
                    />
                </span>
            )}

            <RendererCanvas renderer={renderer} />
        </div>
    );
}
