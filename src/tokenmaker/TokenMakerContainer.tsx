import { useCallback, useEffect, useRef, useState } from "react";
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
    const [, forceUpdate] = useState({});

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
                    <div className="preview-canvas-container rs-border">
                        <canvas ref={canvasRef} className="preview-canvas" />
                        <canvas ref={overlayCanvasRef} className="preview-canvas-overlay" />
                    </div>
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
                        onResolutionChange={(r) => tokenMaker.setExportResolution(r)}
                        onHdChange={(h) => tokenMaker.setHdEnabled(h)}
                        onBrightnessChange={(b) => tokenMaker.setBrightness(b)}
                        onTextureFilterChange={(m) => tokenMaker.setTextureFilterMode(m)}
                        onSmoothModelChange={(s) => tokenMaker.setSmoothModel(s)}
                        onShadowEnabledChange={(e) => tokenMaker.setShadowEnabled(e)}
                        onShadowOpacityChange={(o) => tokenMaker.setShadowOpacity(o)}
                        onExport={handleExport}
                        canExport={tokenMaker.selectedNpcId !== null}
                    />
                </div>
            </div>
        </div>
    );
}
