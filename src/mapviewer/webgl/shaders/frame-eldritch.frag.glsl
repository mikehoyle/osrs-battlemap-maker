#version 300 es

precision highp float;

in vec2 v_texCoord;

uniform highp sampler2D u_frame;
uniform vec2 u_resolution;
// Grid bounds in UV space: (minU, minV, maxU, maxV)
uniform vec4 u_gridBounds;

out vec4 fragColor;

// Eldritch color palette
const vec3 ELDRITCH_GREEN = vec3(0.2, 0.8, 0.4);
const vec3 ELDRITCH_PURPLE = vec3(0.6, 0.2, 0.8);

float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

// High contrast curve
vec3 applyContrast(vec3 color, float contrast) {
    // S-curve contrast enhancement
    vec3 shifted = color - 0.5;
    vec3 curved = sign(shifted) * pow(abs(shifted) * 2.0, vec3(contrast)) * 0.5;
    return clamp(curved + 0.5, 0.0, 1.0);
}

// Calculate vignette based on distance from grid bounds
float calculateGridVignette(vec2 uv, vec4 gridBounds) {
    // Grid center and half-size
    vec2 gridCenter = vec2(
        (gridBounds.x + gridBounds.z) * 0.5,
        (gridBounds.y + gridBounds.w) * 0.5
    );
    vec2 gridHalfSize = vec2(
        (gridBounds.z - gridBounds.x) * 0.5,
        (gridBounds.w - gridBounds.y) * 0.5
    );

    // Distance from UV to grid center, normalized by grid size
    vec2 offset = abs(uv - gridCenter);
    vec2 normalizedOffset = offset / max(gridHalfSize, vec2(0.001));

    // Use superellipse (squircle) distance for smooth rectangular vignette
    // Power of 4 gives a rounded rectangle shape without diagonal artifacts
    float power = 4.0;
    float distFromCenter = pow(
        pow(normalizedOffset.x, power) + pow(normalizedOffset.y, power),
        1.0 / power
    );

    // Tight vignette that fades within the grid
    // Starts fading at 0.3 from center, fades to semi-dark at edges
    float vignette = 1.0 - smoothstep(0.3, 1.0, distFromCenter) * 0.65;

    // Extra darkening outside the grid (but still not full black)
    float outsideGrid = max(distFromCenter - 1.0, 0.0);
    float outerDarkening = smoothstep(0.0, 0.4, outsideGrid) * 0.25;

    return max(vignette - outerDarkening, 0.15);
}

void main() {
    vec4 original = texture(u_frame, v_texCoord);
    vec3 color = original.rgb;

    // Apply high contrast
    color = applyContrast(color, 1.8);

    // Get luminance for tinting
    float lum = luminance(color);

    // Create green/purple tint based on luminance
    // Darker areas get purple, lighter areas get green
    vec3 tintColor = mix(ELDRITCH_PURPLE, ELDRITCH_GREEN, lum);

    // Blend the tint with the contrasted image
    // Keep some of the original color detail
    color = mix(color, tintColor * lum * 1.5, 0.6);

    // Boost the green/purple channels slightly
    color.g *= 1.1;
    color.b *= 1.15;

    // Grid-based vignette
    float vignette = calculateGridVignette(v_texCoord, u_gridBounds);
    vignette = pow(max(vignette, 0.0), 1.5);

    color *= vignette;

    // Add slight chromatic aberration at edges for unsettling effect
    // Calculate distance from grid center for aberration
    vec2 gridCenter = vec2(
        (u_gridBounds.x + u_gridBounds.z) * 0.5,
        (u_gridBounds.y + u_gridBounds.w) * 0.5
    );
    vec2 offsetFromCenter = v_texCoord - gridCenter;
    float distFromCenter = length(offsetFromCenter);

    float aberrationStrength = distFromCenter * 0.004;
    vec2 aberrationOffset = normalize(offsetFromCenter + vec2(0.001)) * aberrationStrength;

    float rChannel = texture(u_frame, v_texCoord + aberrationOffset).r;
    float bChannel = texture(u_frame, v_texCoord - aberrationOffset).b;

    // Apply aberration subtly
    color.r = mix(color.r, applyContrast(vec3(rChannel), 1.8).r * vignette, 0.3);
    color.b = mix(color.b, applyContrast(vec3(bChannel), 1.8).b * vignette, 0.3);

    // Darken overall for more ominous feel
    color *= 0.85;

    fragColor = vec4(color, 1.0);
}
