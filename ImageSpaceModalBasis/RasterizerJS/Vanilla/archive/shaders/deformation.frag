precision highp float;

in vec2 vUv; // UV coordinates in == varying for fragment shader
uniform sampler2D uModeShape; // modal shape (complex RGBA)
uniform sampler2D uReadTexture; // read out the current accumulated displacement
uniform vec2 uModalCoordinate; // q for the current mode
out vec2 fragColor; 


void main() {
    q = uModalCoordinate
    currDisplacement = texture(uReadTexture, vUv);
    modeShape = texture(uModeShape, vUv);
    addDisplacement = vec2(modeShape.r * q.x - modeShape.g * q.y, modeShape.b * q.x - modeShape.a * q.y);
    newDisplacement = vec4(currDisplacement.xy + addDisplacement,, 0.0, 1.0)
    gl_FragColor = newDisplacement;
}