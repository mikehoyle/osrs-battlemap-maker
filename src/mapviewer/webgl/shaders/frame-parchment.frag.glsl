#version 300 es

precision highp float;

in vec2 v_texCoord;

uniform highp sampler2D u_frame;
uniform vec2 u_resolution;

out vec4 fragColor;

// Parchment background color (warm beige/tan)
const vec3 PARCHMENT_COLOR = vec3(0.89, 0.82, 0.70);

// Ink color (dark brown)
const vec3 INK_COLOR = vec3(0.25, 0.18, 0.12);

// Convert to luminance for edge detection
float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

// Sobel edge detection
float sobelEdge(sampler2D tex, vec2 uv, vec2 texelSize) {
    // Sample the 3x3 neighborhood
    float tl = luminance(texture(tex, uv + vec2(-texelSize.x, -texelSize.y)).rgb);
    float t  = luminance(texture(tex, uv + vec2(0.0, -texelSize.y)).rgb);
    float tr = luminance(texture(tex, uv + vec2(texelSize.x, -texelSize.y)).rgb);
    float l  = luminance(texture(tex, uv + vec2(-texelSize.x, 0.0)).rgb);
    float r  = luminance(texture(tex, uv + vec2(texelSize.x, 0.0)).rgb);
    float bl = luminance(texture(tex, uv + vec2(-texelSize.x, texelSize.y)).rgb);
    float b  = luminance(texture(tex, uv + vec2(0.0, texelSize.y)).rgb);
    float br = luminance(texture(tex, uv + vec2(texelSize.x, texelSize.y)).rgb);

    // Sobel kernels
    float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
    float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;

    return sqrt(gx * gx + gy * gy);
}

// Additional depth-based edge detection using color differences
float colorEdge(sampler2D tex, vec2 uv, vec2 texelSize) {
    vec3 center = texture(tex, uv).rgb;

    vec3 n = texture(tex, uv + vec2(0.0, -texelSize.y)).rgb;
    vec3 s = texture(tex, uv + vec2(0.0, texelSize.y)).rgb;
    vec3 e = texture(tex, uv + vec2(texelSize.x, 0.0)).rgb;
    vec3 w = texture(tex, uv + vec2(-texelSize.x, 0.0)).rgb;

    float diffN = length(center - n);
    float diffS = length(center - s);
    float diffE = length(center - e);
    float diffW = length(center - w);

    return max(max(diffN, diffS), max(diffE, diffW));
}

// Simple noise function for paper texture
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal brownian motion for paper texture
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

void main() {
    vec2 texelSize = 1.0 / u_resolution;

    // Sample original color
    vec4 original = texture(u_frame, v_texCoord);

    // Edge detection - combine Sobel and color-based edges
    float edge1 = sobelEdge(u_frame, v_texCoord, texelSize);
    float edge2 = colorEdge(u_frame, v_texCoord, texelSize);

    // Combine edges with different weights
    float edge = max(edge1 * 2.0, edge2 * 3.0);

    // Threshold and smooth the edges to create ink strokes
    edge = smoothstep(0.05, 0.3, edge);

    // Add slight variation to edge intensity for more natural ink look
    float inkVariation = 0.8 + 0.2 * noise(v_texCoord * u_resolution * 0.1);
    edge *= inkVariation;

    // Create paper texture
    vec2 paperCoord = v_texCoord * u_resolution * 0.01;
    float paperNoise = fbm(paperCoord * 2.0);

    // Vary parchment color slightly with noise
    vec3 parchment = PARCHMENT_COLOR * (0.95 + 0.1 * paperNoise);

    // Add subtle stains/aging to parchment
    float stain = fbm(paperCoord * 0.5 + vec2(42.0, 17.0));
    parchment *= 0.9 + 0.15 * stain;

    // Darken edges of the "page" slightly (vignette effect)
    vec2 vignetteCoord = v_texCoord * 2.0 - 1.0;
    float vignette = 1.0 - 0.15 * dot(vignetteCoord, vignetteCoord);
    parchment *= vignette;

    // Mix parchment with ink based on edge strength
    vec3 inkColor = INK_COLOR * (0.9 + 0.2 * noise(v_texCoord * u_resolution * 0.05));
    vec3 finalColor = mix(parchment, inkColor, edge);

    fragColor = vec4(finalColor, 1.0);
}
