import { Link } from "react-router-dom";

import "./GuideContent.css";

export function ImportingIntoRoll20() {
    return (
        <article className="guide-article">
            <h1 className="guide-title">Importing Into Roll20</h1>
            <p className="guide-intro">
                This guide covers how to import your exported battlemaps and tokens from the OSRS
                Tabletop Tools into Roll20 for use in your campaigns.
            </p>

            <section className="guide-section">
                <h2>Importing Battlemaps</h2>
                <p>
                    After exporting a battlemap from the <Link to="/map">Battlemap Maker</Link>, add
                    it to your Roll20 game:
                </p>

                <ol className="guide-steps">
                    <li>
                        <strong>Open your Roll20 game</strong> and navigate to the page where you
                        want to add the map.
                    </li>
                    <li>
                        <strong>Access the Art Library</strong> by clicking the image icon in the
                        toolbar on the left side of the screen, or by pressing "I" on your keyboard.
                    </li>
                    <li>
                        <strong>Upload your map image</strong> by clicking the "Upload" button in
                        the Art Library. Select the PNG file you exported from the{" "}
                        <Link to="/map">Battlemap Maker</Link>.
                    </li>
                    <li>
                        <strong>Drag the image onto the canvas</strong> from your Art Library. It
                        will appear on the map layer.
                    </li>
                    <li>
                        <strong>Move to the Map Layer</strong> if needed. Right-click the image and
                        select "Layer" then "Map & Background" to ensure it sits beneath tokens.
                    </li>
                    <li>
                        <strong>Resize and position</strong> the map as needed. Hold Shift while
                        dragging corners to maintain aspect ratio.
                    </li>
                </ol>

                <h3>Aligning the Grid</h3>
                <p>
                    If you exported your map with the grid overlay enabled, you'll want to align
                    Roll20's grid to match:
                </p>
                <ol>
                    <li>Right-click the map image and select "Advanced" then "Set Dimensions".</li>
                    <li>
                        Enter the width and height in grid squares that matches your export
                        settings. The exported map file name includes this information for easy
                        reference.
                    </li>
                    <li>
                        Alternatively, go to Page Settings (the gear icon) and use the "Align to
                        Grid" feature to match Roll20's grid to your map.
                    </li>
                </ol>

                <div className="guide-note">
                    <p>
                        <strong>Tip:</strong> If you'd prefer Roll20's built-in grid, you can export
                        your map without the grid overlay and rely on Roll20's grid settings
                        instead.
                    </p>
                </div>
            </section>

            <section className="guide-section">
                <h2>Importing Tokens</h2>
                <p>
                    Tokens created with the <Link to="/token-maker">Token Maker</Link> are exported
                    as transparent PNGs, making them perfect for use on any background:
                </p>

                <ol className="guide-steps">
                    <li>
                        <strong>Open the Art Library</strong> in your Roll20 game.
                    </li>
                    <li>
                        <strong>Upload your token images</strong> using the Upload button. You can
                        select multiple token PNGs at once.
                    </li>
                    <li>
                        <strong>Drag tokens onto the canvas</strong> to place them. They'll appear
                        on the Objects & Tokens layer by default.
                    </li>
                    <li>
                        <strong>Resize tokens</strong> by dragging the corners. Tokens are typically
                        sized to occupy one grid square for medium creatures.
                    </li>
                </ol>

                <h3>Creating Token Presets</h3>
                <p>For tokens you'll use frequently, you can create character sheets:</p>
                <ol>
                    <li>Create a new Character in the Journal tab.</li>
                    <li>Set the uploaded token as the character's avatar.</li>
                    <li>Configure token settings like HP bars, vision, and auras.</li>
                    <li>
                        Drag the character from the Journal to the map to place configured tokens.
                    </li>
                </ol>
            </section>
            <section className="guide-section">
                <h2>Additional Resources</h2>
                <p>
                    For more detailed information about Roll20's image handling and advanced
                    features, see the official Roll20 documentation:
                </p>
                <ul>
                    <li>
                        <a
                            href="https://help.roll20.net/hc/en-us/articles/360039178654-Importing-and-Manipulating-Images"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Roll20: Importing and Manipulating Images
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://help.roll20.net/hc/en-us/articles/360039675133-Page-Settings"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Roll20: Page Settings
                        </a>
                    </li>
                </ul>
            </section>
        </article>
    );
}
