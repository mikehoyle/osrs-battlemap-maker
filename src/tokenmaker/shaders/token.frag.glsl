#version 300 es

precision highp float;

uniform highp sampler2DArray u_textures;
uniform float u_brightness;
uniform float u_colorBanding;

in vec4 v_color;
in vec2 v_texCoord;
flat in uint v_texId;

layout(location = 0) out vec4 fragColor;

void main() {
    vec4 baseColor = vec4(round(v_color.rgb * u_colorBanding) / u_colorBanding, v_color.a);

    if (v_texId == 0u) {
        // No texture - use vertex color directly
        fragColor = baseColor;
        // Make sure we have visible output even if color calculation is wrong
        if (fragColor.r < 0.01 && fragColor.g < 0.01 && fragColor.b < 0.01) {
            fragColor = vec4(0.5, 0.5, 0.5, 1.0); // Debug: gray fallback
        }
        if (fragColor.a < 0.01) {
            discard;
        }
    } else {
        // Has texture - sample and multiply
        vec4 textureColor = texture(u_textures, vec3(v_texCoord, v_texId)).bgra;
        fragColor = pow(textureColor, vec4(vec3(u_brightness), 1.0)) * baseColor;
        if (textureColor.a < 0.5) {
            discard;
        }
    }
}
