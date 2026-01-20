#version 300 es

precision highp float;

in vec2 v_texCoord;

uniform highp sampler2D u_frame;
uniform vec2 u_resolution;
uniform vec2 u_cameraPos;      // Camera position in world/map space
uniform float u_zoom;          // Camera zoom level
uniform float u_fogDensity;    // 0.0 to 1.0, controls overall fog opacity
uniform float u_fogScale;      // Controls the size of fog patches (higher = larger patches)
uniform vec3 u_fogColor;       // RGB fog color (0-1 range)

out vec4 fragColor;

// Hash function for noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise function
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

// Fractal Brownian Motion for layered, natural-looking fog
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    // 5 octaves for detailed fog patterns
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

void main() {
    vec4 original = texture(u_frame, v_texCoord);
    vec3 color = original.rgb;

    // Convert screen coordinates to world/map coordinates
    // This makes the fog "attached" to the map - it moves with panning and scales with zoom
    vec2 screenCenter = u_resolution * 0.5;
    vec2 offsetFromCenter = gl_FragCoord.xy - screenCenter;
    vec2 worldPos = u_cameraPos + offsetFromCenter / u_zoom;

    // Scale the fog pattern - higher u_fogScale = smaller fog patches (more detail)
    float baseScale = 50.0 / u_fogScale;
    vec2 scaledCoord = worldPos / baseScale;

    // Generate wavy fog pattern using multiple FBM layers
    float fog1 = fbm(scaledCoord);
    float fog2 = fbm(scaledCoord * 1.5 + vec2(5.3, 2.7));

    // Combine fog layers for more interesting patterns
    float fogPattern = (fog1 + fog2 * 0.5) / 1.5;

    // Create wispy edges by applying contrast curve
    // This makes some areas clear and others foggy
    fogPattern = smoothstep(0.3, 0.7, fogPattern);

    // Apply density control
    float fogAmount = fogPattern * u_fogDensity;

    // Soft clamp
    fogAmount = clamp(fogAmount, 0.0, 0.9);

    // Mix original color with fog color
    color = mix(color, u_fogColor, fogAmount);

    fragColor = vec4(color, 1.0);
}
