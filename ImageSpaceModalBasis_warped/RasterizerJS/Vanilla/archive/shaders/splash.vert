precision highp float;
attribute vec2 aPosition;
varying vec2 vUV;
uniform sampler2D uDeformationMap;
uniform vec4 texdims;

void main() {
    vTexCoord = aPosition * 0.5 + 0.5;  

    vec4 displacement = texture2D(uDeformationMap, vTexCoord);

    displacement.x/=texdims.x;
    displacement.y/=texdims.y;
    didsplacement.y = -dval.y;

    vec4 displacedPosition = vec4(aPosition + displacement.xy, 0.0, 1.0);

    displacedPosition.z = -length(displacement.xy);

    gl_Position = vec4(displacedPosition, 1.0);

}