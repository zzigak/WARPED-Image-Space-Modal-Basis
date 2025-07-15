attribute vec2 aPosition; // attribute == in in vertex shader
varying vec2 uv; // varying == out in vertex shader

void main() {
    uv = aPosition * 0.5 + 0.5; // map from [-1, 1] to [0, 1]
    gl_Position = vec4(aPosition, 0.0, 1.0); // set vertex position
}