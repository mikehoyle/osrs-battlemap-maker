#version 300 es

layout(location = 0) in vec4 a_pos;

uniform vec2 u_resolution;

out vec2 v_texCoord;

void main() {
    gl_Position = a_pos;
    v_texCoord = 0.5 * a_pos.xy + vec2(0.5);
}
