import { useCallback } from "react";
import { ExportResolution, TextureFilterMode } from "../TokenMaker";
import { LightPositionControl } from "./LightPositionControl";
import "./ExportPanel.css";

interface ExportPanelProps {
    resolution: ExportResolution;
    hdEnabled: boolean;
    brightness: number;
    textureFilterMode: TextureFilterMode;
    smoothModel: boolean;
    shadowEnabled: boolean;
    shadowOpacity: number;
    lightX: number;
    lightZ: number;
    onResolutionChange: (resolution: ExportResolution) => void;
    onHdChange: (enabled: boolean) => void;
    onBrightnessChange: (value: number) => void;
    onTextureFilterChange: (mode: TextureFilterMode) => void;
    onSmoothModelChange: (enabled: boolean) => void;
    onShadowEnabledChange: (enabled: boolean) => void;
    onShadowOpacityChange: (opacity: number) => void;
    onLightPositionChange: (x: number, z: number) => void;
    onExport: () => void;
    canExport: boolean;
}

const RESOLUTIONS: ExportResolution[] = [64, 128, 256];

const TEXTURE_FILTER_OPTIONS = [
    { label: "Disabled", value: TextureFilterMode.DISABLED },
    { label: "Bilinear", value: TextureFilterMode.BILINEAR },
    { label: "Trilinear", value: TextureFilterMode.TRILINEAR },
    { label: "Anisotropic 2x", value: TextureFilterMode.ANISOTROPIC_2X },
    { label: "Anisotropic 4x", value: TextureFilterMode.ANISOTROPIC_4X },
    { label: "Anisotropic 8x", value: TextureFilterMode.ANISOTROPIC_8X },
    { label: "Anisotropic 16x", value: TextureFilterMode.ANISOTROPIC_16X },
];

export function ExportPanel({
    resolution,
    hdEnabled,
    brightness,
    textureFilterMode,
    smoothModel,
    shadowEnabled,
    shadowOpacity,
    lightX,
    lightZ,
    onResolutionChange,
    onHdChange,
    onBrightnessChange,
    onTextureFilterChange,
    onSmoothModelChange,
    onShadowEnabledChange,
    onShadowOpacityChange,
    onLightPositionChange,
    onExport,
    canExport,
}: ExportPanelProps): JSX.Element {
    const handleBrightnessChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onBrightnessChange(parseInt(e.target.value));
        },
        [onBrightnessChange],
    );

    const handleTextureFilterChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onTextureFilterChange(parseInt(e.target.value) as TextureFilterMode);
        },
        [onTextureFilterChange],
    );

    const handleShadowOpacityChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onShadowOpacityChange(parseInt(e.target.value) / 100);
        },
        [onShadowOpacityChange],
    );

    const handleLightPositionChange = useCallback(
        (x: number, z: number) => {
            onLightPositionChange(x, z);
        },
        [onLightPositionChange],
    );

    // Show light control when HD or shadows are enabled
    const showLightControl = hdEnabled || shadowEnabled;

    return (
        <div className="control-panel rs-border rs-background export-panel">
            <h3 className="control-panel-title">Render Settings</h3>

            <div className="control-row">
                <label className="control-label">HD</label>
                <label className="hd-toggle">
                    <input
                        type="checkbox"
                        checked={hdEnabled}
                        onChange={(e) => onHdChange(e.target.checked)}
                    />
                    <span className="hd-toggle-label">
                        Enable HD lighting
                    </span>
                </label>
            </div>

            {showLightControl && (
                <div className="control-row light-position-row">
                    <label className="control-label">Light</label>
                    <div className="light-position-wrapper">
                        <LightPositionControl
                            x={lightX}
                            z={lightZ}
                            onChange={handleLightPositionChange}
                        />
                        <span className="light-position-hint">Drag to adjust</span>
                    </div>
                </div>
            )}

            <div className="control-row">
                <label className="control-label">Brightness</label>
                <input
                    type="range"
                    className="control-slider"
                    min={0}
                    max={4}
                    step={1}
                    value={brightness}
                    onChange={handleBrightnessChange}
                />
                <span className="width-value">{brightness}</span>
            </div>

            <div className="control-row">
                <label className="control-label">Filtering</label>
                <select
                    className="control-select rs-border rs-background"
                    value={textureFilterMode}
                    onChange={handleTextureFilterChange}
                >
                    {TEXTURE_FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="control-row">
                <label className="control-label">Smooth</label>
                <label className="hd-toggle">
                    <input
                        type="checkbox"
                        checked={smoothModel}
                        onChange={(e) => onSmoothModelChange(e.target.checked)}
                    />
                    <span className="hd-toggle-label">
                        Smooth shading
                    </span>
                </label>
            </div>

            <div className="control-row">
                <label className="control-label">Shadow</label>
                <label className="hd-toggle">
                    <input
                        type="checkbox"
                        checked={shadowEnabled}
                        onChange={(e) => onShadowEnabledChange(e.target.checked)}
                    />
                    <span className="hd-toggle-label">
                        Enable shadow
                    </span>
                </label>
            </div>

            {shadowEnabled && (
                <div className="control-row">
                    <label className="control-label">Opacity</label>
                    <input
                        type="range"
                        className="control-slider"
                        min={20}
                        max={80}
                        step={5}
                        value={Math.round(shadowOpacity * 100)}
                        onChange={handleShadowOpacityChange}
                    />
                    <span className="width-value">{Math.round(shadowOpacity * 100)}%</span>
                </div>
            )}

            <h3 className="control-panel-title section-title">Export Settings</h3>

            <div className="control-row">
                <label className="control-label">Size</label>
                <div className="button-group">
                    {RESOLUTIONS.map((res) => (
                        <button
                            key={res}
                            className={`control-button rs-border rs-background ${resolution === res ? "active" : ""}`}
                            onClick={() => onResolutionChange(res)}
                        >
                            {res}px
                        </button>
                    ))}
                </div>
            </div>

            <div className="control-row export-button-row">
                <button
                    className="control-button rs-border rs-background primary export-button"
                    onClick={onExport}
                    disabled={!canExport}
                >
                    Export Token
                </button>
            </div>
        </div>
    );
}
