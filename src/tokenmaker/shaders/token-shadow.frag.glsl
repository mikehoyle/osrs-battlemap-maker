#version 300 es

precision highp float;

uniform float u_shadowOpacity;

in float v_alpha;

layout(location = 0) out vec4 fragColor;

void main() {
    // Discard fully transparent pixels (from model alpha)
    if (v_alpha < 0.01) {
        discard;
    }

    // Output solid dark shadow with configurable opacity
    fragColor = vec4(0.0, 0.0, 0.0, u_shadowOpacity);
}
