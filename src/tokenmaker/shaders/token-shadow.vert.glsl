#version 300 es

precision highp float;

uniform mat4 u_projectionMatrix;
uniform mat4 u_viewMatrix;
uniform float u_groundLevel;  // Y level of the ground plane
uniform vec3 u_lightDirection;  // Normalized light direction

layout(location = 0) in uvec3 a_vertex;

out float v_alpha;

// Unpack float11 value
float unpackFloat11(uint v) {
    float val = float(v) / 2048.0;
    return val;
}

struct Vertex {
    vec3 pos;
    float alpha;
    uint textureId;
};

Vertex decodeVertex(uint v0, uint v1, uint v2) {
    float x = float(int((v0 >> 17u) & 0x7FFFu) - 0x4000);

    float y = -float(int((v1) & 0x7FFFu) - 0x4000);
    int hsl = int((v1 >> 15u) & 0xFFFFu);
    float isTextured = float((v1 >> 31) & 0x1u);
    float textureId = float(((hsl >> 7) | int(((v2 >> 5u) & 0x1u) << 9u)) + 1) * isTextured;

    float z = float(int((v2 >> 17u) & 0x7FFFu) - 0x4000);
    float alpha = float((v2 >> 9u) & 0xFFu) / 255.0;

    return Vertex(vec3(x, y, z), alpha, uint(textureId));
}

void main() {
    Vertex vertex = decodeVertex(a_vertex.x, a_vertex.y, a_vertex.z);

    // Transform vertex position from model space to world space
    vec3 localPos = vertex.pos / 128.0;

    // Calculate shadow projection
    // Height above ground determines how far the shadow is offset
    // After Y-flip in vertex decoding, localPos.y is positive going up
    // u_groundLevel is maxY/128 from original coords (positive), which equals -groundY in flipped coords
    // So height = localPos.y + u_groundLevel gives correct height above ground
    float heightAboveGround = localPos.y + u_groundLevel;

    // Project shadow based on light direction
    // Light comes from u_lightDirection, shadow goes opposite in XZ
    float shadowOffsetScale = heightAboveGround / max(u_lightDirection.y, 0.1);
    vec3 shadowPos = vec3(
        localPos.x - u_lightDirection.x * shadowOffsetScale,
        u_groundLevel,
        localPos.z - u_lightDirection.z * shadowOffsetScale
    );

    v_alpha = vertex.alpha;

    gl_Position = u_projectionMatrix * u_viewMatrix * vec4(shadowPos, 1.0);
    // Offset shadow slightly below to avoid z-fighting
    gl_Position.z += 0.001;
}
