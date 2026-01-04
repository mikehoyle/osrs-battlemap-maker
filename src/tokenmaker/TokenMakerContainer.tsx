import { useCallback, useEffect, useRef, useState, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { TokenMaker } from "./TokenMaker";
import { NpcPicker } from "./components/NpcPicker";
import { AnimationPicker } from "./components/AnimationPicker";
import { ExportPanel } from "./components/ExportPanel";
import { TokenMakerRenderer } from "./TokenMakerRenderer";
import "./TokenMakerContainer.css";

interface TokenMakerContainerProps {
    tokenMaker: TokenMaker;
}

export function TokenMakerContainer({ tokenMaker }: TokenMakerContainerProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<TokenMakerRenderer | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [, forceUpdate] = useState({});

    // Drag state refs (using refs to avoid re-renders during drag)
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartY = useRef(0);
    const dragStartOffsetX = useRef(0);
    const dragStartOffsetY = useRef(0);

    // Force re-render when tokenMaker state changes
    useEffect(() => {
        tokenMaker.onStateChange = () => forceUpdate({});
        return () => {
            tokenMaker.onStateChange = undefined;
        };
    }, [tokenMaker]);

    // Initialize renderer
    useEffect(() => {
        const canvas = canvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!canvas || !overlayCanvas) return;

        const renderer = new TokenMakerRenderer(canvas, tokenMaker, overlayCanvas);
        renderer.init();
        renderer.start();
        rendererRef.current = renderer;

        return () => {
            renderer.stop();
            rendererRef.current = null;
        };
    }, [tokenMaker]);

    // Animation loop for auto-play
    useEffect(() => {
        if (!tokenMaker.isPlaying) return;

        const interval = setInterval(() => {
            tokenMaker.advanceFrame();
        }, 100); // ~10fps for preview

        return () => clearInterval(interval);
    }, [tokenMaker, tokenMaker.isPlaying]);

    const handleNpcSelect = useCallback(
        (npcId: number | null) => {
            tokenMaker.selectNpc(npcId);
        },
        [tokenMaker],
    );

    const handleAnimationSelect = useCallback(
        (seqId: number | null) => {
            tokenMaker.selectAnimation(seqId);
        },
        [tokenMaker],
    );

    const handleFrameChange = useCallback(
        (frame: number) => {
            tokenMaker.setFrame(frame);
        },
        [tokenMaker],
    );

    const handleTogglePlay = useCallback(() => {
        tokenMaker.togglePlay();
    }, [tokenMaker]);

    const handleExport = useCallback(async () => {
        const renderer = rendererRef.current;
        if (!renderer) return;

        const blob = await renderer.exportToken();
        if (!blob) return;

        // Download the blob
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const npcType = tokenMaker.getSelectedNpcType();
        const name = npcType?.name?.replace(/[^a-zA-Z0-9]/g, "_") ?? "token";
        a.download = `${name}_token_${tokenMaker.exportResolution}px.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [tokenMaker]);

    // Drag handlers for model positioning
    const handleMouseDown = useCallback(
        (e: MouseEvent<HTMLDivElement>) => {
            if (tokenMaker.selectedNpcId === null) return;

            isDragging.current = true;
            dragStartX.current = e.clientX;
            dragStartY.current = e.clientY;
            dragStartOffsetX.current = tokenMaker.modelOffsetX;
            dragStartOffsetY.current = tokenMaker.modelOffsetY;

            // Prevent text selection during drag
            e.preventDefault();
        },
        [tokenMaker],
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent<HTMLDivElement>) => {
            if (!isDragging.current) return;

            const container = containerRef.current;
            if (!container) return;

            // Calculate delta in pixels
            const deltaX = e.clientX - dragStartX.current;
            const deltaY = e.clientY - dragStartY.current;

            // Convert to normalized coords (container is 300x300)
            // Full container width/height = 1.0 in normalized coords
            const containerWidth = container.clientWidth || 300;
            const containerHeight = container.clientHeight || 300;

            const normalizedDeltaX = deltaX / containerWidth;
            // Negate Y because screen Y increases downward but our offset Y increases upward
            const normalizedDeltaY = -deltaY / containerHeight;

            // Calculate new offset
            const newOffsetX = dragStartOffsetX.current + normalizedDeltaX;
            const newOffsetY = dragStartOffsetY.current + normalizedDeltaY;

            tokenMaker.setModelOffset(newOffsetX, newOffsetY);
        },
        [tokenMaker],
    );

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    const handleMouseLeave = useCallback(() => {
        isDragging.current = false;
    }, []);

    const handleResetPosition = useCallback(() => {
        tokenMaker.resetModelOffset();
    }, [tokenMaker]);

    const handleRotateLeft = useCallback(() => {
        tokenMaker.rotateLeft();
    }, [tokenMaker]);

    const handleRotateRight = useCallback(() => {
        tokenMaker.rotateRight();
    }, [tokenMaker]);

    return (
        <div className="token-maker-container">
            <div className="token-maker-header">
                <Link to="/" className="back-button rs-border rs-background">
                    Back
                </Link>
                <h1 className="token-maker-title">Token Maker</h1>
            </div>

            <div className="token-maker-content">
                <div className="token-maker-preview">
                    <div
                        ref={containerRef}
                        className="preview-canvas-container rs-border"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        style={{ cursor: tokenMaker.selectedNpcId !== null ? "grab" : "default" }}
                    >
                        <canvas ref={canvasRef} className="preview-canvas" />
                        <canvas ref={overlayCanvasRef} className="preview-canvas-overlay" />
                    </div>
                    <div className="rotation-controls">
                        <button
                            className="rotation-button rs-border rs-background"
                            onClick={handleRotateLeft}
                            disabled={tokenMaker.selectedNpcId === null}
                            title="Rotate Left"
                        >
                            &#x21B6;
                        </button>
                        <button
                            className="rotation-button rs-border rs-background"
                            onClick={handleRotateRight}
                            disabled={tokenMaker.selectedNpcId === null}
                            title="Rotate Right"
                        >
                            &#x21B7;
                        </button>
                    </div>
                    {tokenMaker.isModelOffCenter() && (
                        <button
                            className="reset-position-button rs-border rs-background"
                            onClick={handleResetPosition}
                        >
                            Reset Position
                        </button>
                    )}
                    <div className="preview-info content-text">
                        {tokenMaker.selectedNpcId !== null ? (
                            <>
                                <span>
                                    {tokenMaker.getSelectedNpcType()?.name} (ID:{" "}
                                    {tokenMaker.selectedNpcId})
                                </span>
                                {tokenMaker.selectedSeqId !== null && (
                                    <span>
                                        Frame: {tokenMaker.currentFrame + 1} /{" "}
                                        {tokenMaker.getCurrentFrameCount()}
                                    </span>
                                )}
                            </>
                        ) : (
                            <span>Select an NPC to preview</span>
                        )}
                    </div>
                </div>

                <div className="token-maker-controls">
                    <NpcPicker
                        npcList={tokenMaker.npcList}
                        selectedNpcId={tokenMaker.selectedNpcId}
                        onSelect={handleNpcSelect}
                    />

                    <AnimationPicker
                        animations={tokenMaker.getAvailableAnimations()}
                        selectedSeqId={tokenMaker.selectedSeqId}
                        currentFrame={tokenMaker.currentFrame}
                        maxFrames={tokenMaker.getCurrentFrameCount()}
                        isPlaying={tokenMaker.isPlaying}
                        onAnimationSelect={handleAnimationSelect}
                        onFrameChange={handleFrameChange}
                        onTogglePlay={handleTogglePlay}
                    />

                    <ExportPanel
                        resolution={tokenMaker.exportResolution}
                        hdEnabled={tokenMaker.hdEnabled}
                        brightness={tokenMaker.brightness}
                        textureFilterMode={tokenMaker.textureFilterMode}
                        smoothModel={tokenMaker.smoothModel}
                        shadowEnabled={tokenMaker.shadowEnabled}
                        shadowOpacity={tokenMaker.shadowOpacity}
                        lightX={tokenMaker.lightX}
                        lightZ={tokenMaker.lightZ}
                        onResolutionChange={(r) => tokenMaker.setExportResolution(r)}
                        onHdChange={(h) => tokenMaker.setHdEnabled(h)}
                        onBrightnessChange={(b) => tokenMaker.setBrightness(b)}
                        onTextureFilterChange={(m) => tokenMaker.setTextureFilterMode(m)}
                        onSmoothModelChange={(s) => tokenMaker.setSmoothModel(s)}
                        onShadowEnabledChange={(e) => tokenMaker.setShadowEnabled(e)}
                        onShadowOpacityChange={(o) => tokenMaker.setShadowOpacity(o)}
                        onLightPositionChange={(x, z) => tokenMaker.setLightPosition(x, z)}
                        onExport={handleExport}
                        canExport={tokenMaker.selectedNpcId !== null}
                    />
                </div>
            </div>
        </div>
    );
}
