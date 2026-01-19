#version 300 es

precision highp float;

in vec2 v_texCoord;

uniform highp sampler2D u_frame;
uniform vec2 u_resolution;
uniform float u_shadowIntensity;

out vec4 fragColor;

float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

// Deepen shadows with a curve - intensity controls how deep the shadows are
vec3 deepenShadows(vec3 color, float intensity) {
    // Apply a toe curve to crush blacks
    float lum = luminance(color);

    // S-curve that preserves highlights but deepens shadows
    // Scale shadow strength with intensity (0.0 to 0.6)
    float shadowStrength = 0.6 * intensity;
    vec3 darkened = color * smoothstep(0.0, 0.6, lum);

    // Blend based on luminance - darker areas get more crushed
    float blendFactor = 1.0 - smoothstep(0.0, 0.5, lum);
    color = mix(color, darkened, blendFactor * shadowStrength);

    // Gamma adjustment scales from 1.0 (no effect) to 1.3 (current max)
    float gamma = mix(1.0, 1.3, intensity);
    color = pow(color, vec3(gamma));

    // Push blacks deeper - scales from 0.0 to 0.03
    float blackPush = 0.03 * intensity;
    color = max(color - blackPush, 0.0);

    return color;
}

// Desaturate color
vec3 desaturate(vec3 color, float amount) {
    float lum = luminance(color);
    return mix(color, vec3(lum), amount);
}

void main() {
    vec4 original = texture(u_frame, v_texCoord);
    vec3 color = original.rgb;

    // Deepen shadows first - intensity controlled by uniform
    color = deepenShadows(color, u_shadowIntensity);

    // Heavy desaturation (keep ~30% of original saturation)
    color = desaturate(color, 0.7);

    // Slight cool tint to shadows, warm tint to highlights
    float lum = luminance(color);
    vec3 coolTint = vec3(0.95, 0.97, 1.02);
    vec3 warmTint = vec3(1.02, 1.0, 0.97);
    vec3 tint = mix(coolTint, warmTint, smoothstep(0.3, 0.7, lum));
    color *= tint;

    // Subtle vignette for that cinematic feel
    vec2 vignetteCoord = v_texCoord * 2.0 - 1.0;
    float vignette = 1.0 - dot(vignetteCoord, vignetteCoord) * 0.15;
    color *= vignette;

    // Final contrast boost
    color = clamp(color, 0.0, 1.0);

    fragColor = vec4(color, 1.0);
}
