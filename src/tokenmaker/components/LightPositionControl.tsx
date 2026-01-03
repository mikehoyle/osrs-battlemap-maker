import { useCallback, useRef, useEffect } from "react";
import "./LightPositionControl.css";

interface LightPositionControlProps {
    x: number;  // -1 to 1, left to right
    z: number;  // -1 to 1, bottom to top (in screen coords, this is inverted)
    onChange: (x: number, z: number) => void;
    disabled?: boolean;
}

const CONTROL_SIZE = 60;  // Size of the circular control in pixels
const DOT_SIZE = 14;      // Size of the draggable dot

export function LightPositionControl({
    x,
    z,
    onChange,
    disabled = false,
}: LightPositionControlProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const getPositionFromEvent = useCallback((e: MouseEvent | React.MouseEvent): { x: number; z: number } | null => {
        const container = containerRef.current;
        if (!container) return null;

        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = rect.width / 2;

        // Calculate position relative to center, normalized to -1 to 1
        let newX = (e.clientX - centerX) / radius;
        let newZ = -(e.clientY - centerY) / radius;  // Invert Y since screen Y is down

        // Clamp to unit circle
        const dist = Math.sqrt(newX * newX + newZ * newZ);
        if (dist > 1) {
            newX /= dist;
            newZ /= dist;
        }

        return { x: newX, z: newZ };
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        isDraggingRef.current = true;

        const pos = getPositionFromEvent(e);
        if (pos) {
            onChange(pos.x, pos.z);
        }
    }, [disabled, getPositionFromEvent, onChange]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || disabled) return;

            const pos = getPositionFromEvent(e);
            if (pos) {
                onChange(pos.x, pos.z);
            }
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [disabled, getPositionFromEvent, onChange]);

    // Convert normalized position to pixel offset from center
    const radius = CONTROL_SIZE / 2;
    const dotX = x * radius;
    const dotY = -z * radius;  // Invert back for screen coords

    return (
        <div
            ref={containerRef}
            className={`light-position-control ${disabled ? "disabled" : ""}`}
            onMouseDown={handleMouseDown}
            style={{
                width: CONTROL_SIZE,
                height: CONTROL_SIZE,
            }}
        >
            <div className="light-position-ring" />
            <div className="light-position-crosshair-h" />
            <div className="light-position-crosshair-v" />
            <div
                className="light-position-dot"
                style={{
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    transform: `translate(${dotX - DOT_SIZE / 2}px, ${dotY - DOT_SIZE / 2}px)`,
                }}
            />
        </div>
    );
}
