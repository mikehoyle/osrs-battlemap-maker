#version 300 es

precision highp float;

uniform highp sampler2DArray u_textures;
uniform float u_brightness;
uniform float u_colorBanding;

// HD lighting uniforms
uniform vec3 u_lightDirection;  // Normalized direction TO the light
uniform float u_ambientStrength;
uniform float u_diffuseStrength;
uniform float u_specularStrength;
uniform float u_shininess;
uniform bool u_smoothShading;

in vec4 v_color;
in vec2 v_texCoord;
flat in uint v_texId;
in vec3 v_worldPos;
in vec3 v_normal;

layout(location = 0) out vec4 fragColor;

void main() {
    vec4 baseColor = vec4(round(v_color.rgb * u_colorBanding) / u_colorBanding, v_color.a);

    vec3 normal;
    if (u_smoothShading) {
        // Use interpolated vertex normal for smooth shading
        normal = normalize(v_normal);
    } else {
        // Calculate face normal from screen-space derivatives for flat shading
        vec3 dFdxPos = dFdx(v_worldPos);
        vec3 dFdyPos = dFdy(v_worldPos);
        normal = normalize(cross(dFdxPos, dFdyPos));
    }

    // Ensure normal faces up (towards camera in top-down view)
    // The view is looking down -Y, so we want normals with positive Y to be "front-facing"
    if (normal.y < 0.0) {
        normal = -normal;
    }

    // Calculate lighting
    vec3 lightDir = normalize(u_lightDirection);

    // Ambient component
    vec3 ambient = vec3(u_ambientStrength);

    // Diffuse component (Lambert)
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = vec3(diff * u_diffuseStrength);

    // Specular component (Blinn-Phong)
    // View direction is looking down (0, -1, 0) in world space
    vec3 viewDir = vec3(0.0, -1.0, 0.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), u_shininess);
    vec3 specular = vec3(spec * u_specularStrength);

    // Combine lighting
    vec3 lighting = ambient + diffuse + specular;

    // Add subtle rim lighting for edge definition
    float rim = 1.0 - max(dot(normal, -viewDir), 0.0);
    rim = pow(rim, 3.0) * 0.15;
    lighting += vec3(rim);

    if (v_texId == 0u) {
        // No texture - use vertex color with lighting
        vec3 litColor = baseColor.rgb * lighting;
        fragColor = vec4(litColor, baseColor.a);

        // Debug fallback for invalid colors
        if (fragColor.r < 0.01 && fragColor.g < 0.01 && fragColor.b < 0.01 && baseColor.a > 0.5) {
            fragColor = vec4(0.5, 0.5, 0.5, 1.0);
        }
        if (fragColor.a < 0.01) {
            discard;
        }
    } else {
        // Has texture - sample and multiply with lighting
        vec4 textureColor = texture(u_textures, vec3(v_texCoord, v_texId)).bgra;
        vec3 texRgb = pow(textureColor.rgb, vec3(u_brightness));
        vec3 litColor = texRgb * baseColor.rgb * lighting;
        fragColor = vec4(litColor, textureColor.a);

        if (textureColor.a < 0.5) {
            discard;
        }
    }

    // Clamp final color to prevent over-brightening
    fragColor.rgb = min(fragColor.rgb, vec3(1.0));
}
