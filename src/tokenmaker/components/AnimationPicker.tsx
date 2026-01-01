import { useCallback } from "react";
import { AnimationOption } from "../TokenMaker";
import "./AnimationPicker.css";

interface AnimationPickerProps {
    animations: AnimationOption[];
    selectedSeqId: number | null;
    currentFrame: number;
    maxFrames: number;
    isPlaying: boolean;
    onAnimationSelect: (seqId: number | null) => void;
    onFrameChange: (frame: number) => void;
    onTogglePlay: () => void;
}

export function AnimationPicker({
    animations,
    selectedSeqId,
    currentFrame,
    maxFrames,
    isPlaying,
    onAnimationSelect,
    onFrameChange,
    onTogglePlay,
}: AnimationPickerProps): JSX.Element {
    const handleAnimationChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const value = e.target.value;
            onAnimationSelect(value === "" ? null : parseInt(value));
        },
        [onAnimationSelect],
    );

    const handleFrameChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onFrameChange(parseInt(e.target.value));
        },
        [onFrameChange],
    );

    const handlePrevFrame = useCallback(() => {
        onFrameChange(Math.max(0, currentFrame - 1));
    }, [onFrameChange, currentFrame]);

    const handleNextFrame = useCallback(() => {
        onFrameChange(Math.min(maxFrames - 1, currentFrame + 1));
    }, [onFrameChange, currentFrame, maxFrames]);

    const hasAnimations = animations.length > 0;
    const hasFrames = maxFrames > 0;

    return (
        <div className="control-panel rs-border rs-background animation-picker">
            <h3 className="control-panel-title">Animation</h3>

            <div className="control-row">
                <label className="control-label">Pose</label>
                <select
                    className="control-select"
                    value={selectedSeqId ?? ""}
                    onChange={handleAnimationChange}
                    disabled={!hasAnimations}
                >
                    <option value="">
                        {hasAnimations ? "Select animation..." : "No animations available"}
                    </option>
                    {animations.map((anim) => (
                        <option key={anim.id} value={anim.id}>
                            {anim.name} ({anim.frameCount} frames)
                        </option>
                    ))}
                </select>
            </div>

            {hasFrames && (
                <>
                    <div className="control-row">
                        <label className="control-label">Frame</label>
                        <input
                            type="range"
                            className="control-slider"
                            min={0}
                            max={maxFrames - 1}
                            value={currentFrame}
                            onChange={handleFrameChange}
                        />
                        <span className="frame-counter">
                            {currentFrame + 1}/{maxFrames}
                        </span>
                    </div>

                    <div className="control-row animation-controls">
                        <button
                            className="control-button rs-border rs-background"
                            onClick={handlePrevFrame}
                            disabled={currentFrame === 0}
                        >
                            &lt;
                        </button>
                        <button
                            className="control-button rs-border rs-background play-button"
                            onClick={onTogglePlay}
                        >
                            {isPlaying ? "Stop" : "Play"}
                        </button>
                        <button
                            className="control-button rs-border rs-background"
                            onClick={handleNextFrame}
                            disabled={currentFrame >= maxFrames - 1}
                        >
                            &gt;
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
