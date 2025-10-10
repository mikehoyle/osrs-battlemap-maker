# Main stuff

-   Export (including grid)
    -   Possible option: html2canvas
    -   Consider upscaling canvas height/width first for better resolution
    -   Resolution options
-   Remove pointer-lock (InputManager, MapViewerControls)
-   Limit pitch/yaw -- no pitch changes, yaw only in 90deg increments
-   Strip out extraneous options (need to identify all options)
-   remove perspective, pitch, yaw, maybe camera X, (maybe more?) from url query params (MapViewer)
-   Add grid options to query params (maybe local storage too?)
-   Remove perspective camera setting (and camera settings entirely probably)
-   arrow key controls backwards?
-   Snap export edges to grid
-   Click and drag moves map
-   Scroll zooms
-   Fix weird inverted arrow keys

# Bigger scope stuff

-   Add items to map
-   Remove roofs and set current floor

# Done!

-   Overlay grid
-   Dashed lines
