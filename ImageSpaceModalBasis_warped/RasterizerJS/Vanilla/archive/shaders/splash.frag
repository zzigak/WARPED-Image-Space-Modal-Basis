precision highp float;

attribute vec2 vUV;

uniform sampler2D uOriginalImage
uniform float uAlpha;

varying vec2 vTexCoord;
varying vec4 fragColor;

void main() {
    vec4 originalColor = texture2D(uOriginalImage, vUV);

    originalColor.a *= uAlpha;

    gl_FragColor = originalColor;
}

// void main(){
//     // Apply displacement map to origTexture with depth culling
//     vec4 displacement = texture(uDeformationTAexture, vUv);
//     // Normalize displacement by texture dimensions
//     vec2 textureSize = vec2(textureSize(uOriginalTexture));
//     vec2 displacement = displacement / textureSize;

//     vec2 displacedUV = vUv + displacement.xy;

//     // float displacementMagnitudeSq = dot(displacement.xy, displacement.xy);
//     // float depthValue = 1.0 / sqrt(displacementMagnitudeSq + 1.0);

//     // Sample original texture with displaced UV
//     vec4 originalColor = texture(uOriginalTexture, displacedUV);

//     // Apply depth culling based on depth value
//     if (depthValue > gl_FragCoord.z) {
//         fragColor = originalColor;
//     } else {
//         discard; // Fragment is occluded
//     }
//     vec4 origColor = texture(uOrigTexture, displacdUV);
//     fragColor = origColor;

    

    

// }
