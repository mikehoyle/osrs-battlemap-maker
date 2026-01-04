#!/usr/bin/env node

/**
 * Script to fetch animation data from z-kris.com and generate TypeScript entries
 * for AnimationNames.ts
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const URL = "https://media.z-kris.com/2025/10/234.1%20anims.json";

/**
 * Convert snake_case to Human Readable Title Case
 * e.g., "ghosthuman_walk_forward" -> "Ghosthuman Walk Forward"
 */
function snakeCaseToTitleCase(str) {
    return str
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

/**
 * Fetch JSON from URL
 */
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .on("error", reject);
    });
}

async function main() {
    console.error("Fetching animation data...");
    const data = await fetchJson(URL);

    // Collect all animations from all entries
    const animations = new Map();

    // The data structure has numbered keys, each with a "seq" array
    for (const key of Object.keys(data)) {
        const entry = data[key];
        if (entry && entry.seq && Array.isArray(entry.seq)) {
            for (const anim of entry.seq) {
                if (anim.id !== undefined && anim.name) {
                    // Convert snake_case to title case
                    const humanName = snakeCaseToTitleCase(anim.name);
                    animations.set(anim.id, humanName);
                }
            }
        }
    }

    // Sort by ID
    const sortedIds = Array.from(animations.keys()).sort((a, b) => a - b);

    console.error(`Found ${sortedIds.length} animations`);

    // Generate the full TypeScript file content
    let output = `/**
 * Map of known animation IDs to human-readable names.
 * Names are concise and suitable for UI display.
 *
 * Auto-generated from https://media.z-kris.com/2025/10/234.1%20anims.json
 * (Sourced from https://rune-server.org/threads/osrs-animation-dump.698658/)
 */
export const ANIMATION_NAMES: Map<number, string> = new Map([
`;

    for (const id of sortedIds) {
        const name = animations.get(id);
        // Escape any quotes in the name
        const escapedName = name.replace(/"/g, '\\"');
        output += `    [${id}, "${escapedName}"],\n`;
    }

    output += `]);

/**
 * Get the human-readable name for an animation ID, or undefined if not known.
 */
export function getAnimationName(seqId: number): string | undefined {
    return ANIMATION_NAMES.get(seqId);
}
`;

    // Write to file
    const outputPath = path.join(__dirname, "..", "src", "tokenmaker", "AnimationNames.ts");
    fs.writeFileSync(outputPath, output);
    console.error(`Wrote ${sortedIds.length} animations to ${outputPath}`);
}

main().catch(console.error);
