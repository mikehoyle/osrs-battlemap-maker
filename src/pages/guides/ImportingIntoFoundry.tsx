import { Link } from "react-router-dom";

import "./GuideContent.css";

export function ImportingIntoFoundry() {
    return (
        <article className="guide-article">
            <h1 className="guide-title">Importing Into Foundry VTT</h1>
            <p className="guide-intro">
                This guide covers how to import your exported battlemaps and tokens from the OSRS
                Tabletop Tools into Foundry Virtual Tabletop for use in your campaigns.
            </p>

            <section className="guide-section">
                <h2>Importing Battlemaps as Scenes</h2>
                <p>
                    After exporting a battlemap from the <Link to="/map">Battlemap Maker</Link>, you
                    can create a new Scene in Foundry VTT using your exported image as the
                    background.
                </p>

                <ol className="guide-steps">
                    <li>
                        <strong>Open the Scenes Directory</strong> by clicking the Scenes tab in the
                        right sidebar (the mountain icon).
                    </li>
                    <li>
                        <strong>Create a new Scene</strong> by clicking the "Create Scene" button at
                        the bottom of the sidebar. Enter a name for your scene and click "Create New
                        Scene".
                    </li>
                    <li>
                        <strong>Set the Background Image</strong> in the scene configuration window
                        that opens. Click the file picker icon next to "Background Image" and upload
                        your exported PNG from the <Link to="/map">Battlemap Maker</Link>.
                    </li>
                    <li>
                        <strong>Configure Grid Settings</strong> in the Grid tab. Set the Grid Type
                        to "Square" for standard battlemaps.
                    </li>
                    <li>
                        <strong>Set the Grid Size</strong> to match your export. Foundry uses pixels
                        per grid square. Update this to match your exported per-cell resolution
                        (64px, 128px, or 256px).
                    </li>
                    <li>
                        <strong>Save your Scene</strong> by clicking "Save Changes" at the bottom of
                        the configuration window.
                    </li>
                </ol>

                <h3>Aligning the Grid</h3>
                <p>
                    If you used the correct grid size on scene creation, then this likely isn't
                    necessary, but if the new scene isn't grid aligned, follow these steps to fix:
                </p>
                <ol>
                    <li>
                        In the scene configuration, navigate to the Grid tab and click the alignment
                        tool (angled-ruler icon).
                    </li>
                    <li>
                        Use the alignment interface to match Foundry's grid overlay to the grid in
                        your image.
                    </li>
                    <li>Adjust the Grid Size value if needed to match your map's grid squares.</li>
                </ol>

                <div className="guide-note">
                    <p>
                        <strong>Tip:</strong> Set your grid size before adding walls, lights, or
                        other scene details. Changing the grid size later may shift the alignment of
                        these elements.
                    </p>
                </div>
            </section>

            <section className="guide-section">
                <h2>Importing Tokens as Actors</h2>
                <p>
                    Tokens created with the <Link to="/token-maker">Token Maker</Link> can be used
                    as token artwork for Actors in Foundry VTT.
                </p>

                <ol className="guide-steps">
                    <li>
                        <strong>Open the Actors Directory</strong> by clicking the Actors tab in the
                        right sidebar (the person icon).
                    </li>
                    <li>
                        <strong>Create a new Actor</strong> by clicking "Create Actor". Enter a name
                        and select the appropriate actor type for your game system (usually "NPC"
                        for monsters and enemies).
                    </li>
                    <li>
                        <strong>Open the Actor Sheet</strong> that appears after creation. Look for
                        the token/portrait image area.
                    </li>
                    <li>
                        <strong>Upload your token image</strong> by clicking on the token image
                        placeholder and using the file picker to upload your exported PNG from the{" "}
                        <Link to="/token-maker">Token Maker</Link>.
                    </li>
                    <li>
                        <strong>Configure the Prototype Token</strong> by clicking the "Prototype
                        Token" button in the actor's header. This sets the default appearance for
                        all tokens of this actor placed on scenes.
                    </li>
                </ol>

                <h3>Token Configuration Options</h3>
                <p>
                    In the Prototype Token configuration, you can customize how tokens appear and
                    behave:
                </p>
                <ul>
                    <li>
                        <strong>Image Path:</strong> Set separate artwork for the token (shown on
                        maps) and portrait (shown in sheets/chat).
                    </li>
                    <li>
                        <strong>Token Size:</strong> Set width and height in grid squares (1x1 for
                        medium creatures, 2x2 for large, etc.).
                    </li>
                </ul>

                <div className="guide-note">
                    <p>
                        <strong>Note:</strong> Prototype Token settings are templates. Once you drag
                        an actor onto a scene, that placed token becomes an independent copy that
                        can be configured separately.
                    </p>
                </div>
            </section>

            <section className="guide-section">
                <h2>Additional Resources</h2>
                <p>
                    For more detailed information about Foundry VTT's scene and actor systems, see
                    the official documentation:
                </p>
                <ul>
                    <li>
                        <a
                            href="https://foundryvtt.com/article/scenes/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Foundry VTT: Scenes
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://foundryvtt.com/article/actors/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Foundry VTT: Actors
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://foundryvtt.com/article/tokens/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Foundry VTT: Tokens
                        </a>
                    </li>
                </ul>
            </section>
        </article>
    );
}
