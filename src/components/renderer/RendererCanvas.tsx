import { useEffect, useRef } from "react";

import { Renderer } from "./Renderer";

export interface RendererCanvasProps {
    renderer: Renderer;
}

export function RendererCanvas({ renderer }: RendererCanvasProps): JSX.Element {
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const div = divRef.current;
        if (!div) {
            return;
        }
        div.appendChild(renderer.canvas);
        div.appendChild(renderer.overlayCanvas);

        renderer.init().then(() => {
            renderer.start();
        });

        return () => {
            renderer.stop();
            div.removeChild(renderer.canvas);
            div.removeChild(renderer.overlayCanvas);
        };
    }, [renderer]);

    return <div ref={divRef} style={{ zIndex: "0", width: "100%", height: "100%" }} tabIndex={0} />;
}
