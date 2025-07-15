precision highp float;

uniform sampler2D uOriginalImage;
uniform sampler2D uDeformationTexture;

varying vec2 vTexCoord;

void main() {
    vec4 deformation = texture(UDeformationTexture, vTexCoord);
    vec2 displacedCoord = vTexCoord + deformation.xy;
    
    vec4 color = texture(uOriginalImage, displacedCoord);
    
    // Calculate depth based on displacement magnitude
    float magnitude = length(deformation.xy);
    // float depth = 1.0 / (1.0 + magnitude);
    float depth = -length(magnitude);
    
    gl_FragColor = color;
    gl_FragDepth = depth;
}