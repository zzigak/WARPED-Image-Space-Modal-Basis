// fragment shader
precision highp float;

varying vec2 uv; // UV coordinates in == varying for fragment shader
uniform sampler2D uModeShape; // modal shape (complex RGBA)
uniform sampler2D uPreviousDeformation; // read out the current accumulated displacement
uniform vec2 uModalCoordinate; // q for the current mode


void main() {
    q = uModalCoordinate
    currDisplacement = texture(uPreviousDeformation, vUv);
    modeShape = texture(uModeShape, vUv);
    addDisplacement = vec2(modeShape.r * q.x - modeShape.g * q.y, modeShape.b * q.x - modeShape.a * q.y);
    newDisplacement = vec4(currDisplacement.xy + addDisplacement,, 0.0, 1.0)
    gl_FragColor = newDisplacement;
}


// vertex shader

// attribute vec2 aPosition; // attribute == in in vertex shader
// varying vec2 uv; // varying == out in vertex shader

// void main() {
//     uv = aPosition * 0.5 + 0.5; // map from [-1, 1] to [0, 1]
//     gl_Position = vec4(aPosition, 0.0, 1.0); // set vertex position
// }