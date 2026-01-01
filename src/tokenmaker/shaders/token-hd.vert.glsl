#version 300 es

precision highp float;

uniform mat4 u_projectionMatrix;
uniform mat4 u_viewMatrix;
uniform float u_brightness;

layout(location = 0) in uvec3 a_vertex;

out vec4 v_color;
out vec2 v_texCoord;
flat out uint v_texId;
out vec3 v_worldPos;

// Branchless logic helpers
float when_eq(float x, float y) {
    return 1.0 - abs(sign(x - y));
}

float when_neq(float x, float y) {
    return abs(sign(x - y));
}

float when_lt(float x, float y) {
    return max(sign(y - x), 0.0);
}

// Unpack float11 value
float unpackFloat11(uint v) {
    float val = float(v) / 2048.0;
    return val;
}

// HSL to RGB conversion
vec3 hslToRgb(int hsl, float brightness) {
    const float onethird = 1.0 / 3.0;
    const float twothird = 2.0 / 3.0;
    const float rcpsixth = 6.0;

    float hue = float(hsl >> 10) / 64.0 + 0.0078125;
    float sat = float((hsl >> 7) & 0x7) / 8.0 + 0.0625;
    float lum = float(hsl & 0x7f) / 128.0;

    vec3 xt = vec3(
        rcpsixth * (hue - twothird),
        0.0,
        rcpsixth * (1.0 - hue)
    );

    xt = mix(xt, vec3(
        0.0,
        rcpsixth * (twothird - hue),
        rcpsixth * (hue - onethird)
    ), when_lt(hue, twothird));

    xt = mix(xt, vec3(
        rcpsixth * (onethird - hue),
        rcpsixth * hue,
        0.0
    ), when_lt(hue, onethird));

    xt = min(xt, 1.0);

    float sat2   =  2.0 * sat;
    float satinv =  1.0 - sat;
    float luminv =  1.0 - lum;
    float lum2m1 = (2.0 * lum) - 1.0;
    vec3  ct     = (sat2 * xt) + satinv;

    vec3 rgb = mix((luminv * ct) + lum2m1, lum * ct, when_lt(lum, 0.5));

    return pow(rgb, vec3(brightness));
}

struct Vertex {
    vec3 pos;
    vec4 color;
    vec2 texCoord;
    uint textureId;
    uint priority;
};

Vertex decodeVertex(uint v0, uint v1, uint v2, float brightness) {
    float x = float(int((v0 >> 17u) & 0x7FFFu) - 0x4000);
    float u = unpackFloat11(((v0 >> 11u) & 0x3Fu) | ((v2 & 0x1Fu) << 6u));
    float v = unpackFloat11(v0 & 0x7FFu);

    float y = -float(int((v1) & 0x7FFFu) - 0x4000);
    int hsl = int((v1 >> 15u) & 0xFFFFu);
    float isTextured = float((v1 >> 31) & 0x1u);
    float textureId = float(((hsl >> 7) | int(((v2 >> 5u) & 0x1u) << 9u)) + 1) * isTextured;

    float z = float(int((v2 >> 17u) & 0x7FFFu) - 0x4000);
    float alpha = float((v2 >> 9u) & 0xFFu) / 255.0;
    uint priority = ((v2 >> 6u) & 0x7u);

    vec4 color = when_eq(textureId, 0.0) * vec4(hslToRgb(hsl, brightness), alpha)
        + when_neq(textureId, 0.0) * vec4(vec3(float(hsl & 0x7F) / 127.0), alpha);

    return Vertex(vec3(x, y, z), color, vec2(u, v), uint(textureId), priority);
}

void main() {
    Vertex vertex = decodeVertex(a_vertex.x, a_vertex.y, a_vertex.z, u_brightness);

    v_color = vertex.color;
    v_texCoord = vertex.texCoord;
    v_texId = vertex.textureId;

    // Transform vertex position from model space to world space
    vec3 localPos = vertex.pos / 128.0;
    v_worldPos = localPos;

    gl_Position = u_projectionMatrix * u_viewMatrix * vec4(localPos, 1.0);
    gl_Position.z += float(vertex.priority) * 0.0007;
}
