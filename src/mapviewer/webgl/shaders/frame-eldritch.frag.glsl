#version 300 es

precision highp float;

in vec2 v_texCoord;

uniform highp sampler2D u_frame;
uniform vec2 u_resolution;

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

    // Heavy vignette
    vec2 vignetteCoord = v_texCoord * 2.0 - 1.0;
    float vignetteDist = length(vignetteCoord);
    // Aggressive vignette falloff
    float vignette = 1.0 - smoothstep(0.3, 1.2, vignetteDist);
    vignette = pow(vignette, 1.5);

    color *= vignette;

    // Add slight chromatic aberration at edges for unsettling effect
    float aberrationStrength = vignetteDist * 0.003;
    vec2 aberrationOffset = normalize(vignetteCoord) * aberrationStrength;

    float rChannel = texture(u_frame, v_texCoord + aberrationOffset).r;
    float bChannel = texture(u_frame, v_texCoord - aberrationOffset).b;

    // Apply aberration subtly
    color.r = mix(color.r, applyContrast(vec3(rChannel), 1.8).r * vignette, 0.3);
    color.b = mix(color.b, applyContrast(vec3(bChannel), 1.8).b * vignette, 0.3);

    // Darken overall for more ominous feel
    color *= 0.85;

    fragColor = vec4(color, 1.0);
}
