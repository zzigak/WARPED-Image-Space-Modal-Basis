// main js file

let gl;
let deformProgram, renderProgram;
let originalTexture, modeTextures = [];
let pingPongFBOs = [];
let quadBuffer;

// Number of modes
const NUM_MODES = 10; // Adjust as needed




function init() {
    const canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl2');
    console.log('Canvas size:', gl.canvas.width, gl.canvas.height);

    if (!gl) {
        console.error('Unable to initialize WebGL 2. Your browser may not support it.');
        return;
    }

    // Load shaders
    const deformVert = loadShader(gl, gl.VERTEX_SHADER, document.getElementById('deform-vertex').textContent);
    const deformFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('deform-fragment').textContent);
    const renderVert = loadShader(gl, gl.VERTEX_SHADER, document.getElementById('render-vertex').textContent);
    const renderFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('render-fragment').textContent);


    // Create shader programs
    deformProgram = createShaderProgram(deformVert, deformFrag);
    renderProgram = createShaderProgram(renderVert, renderFrag);

    // Create quad buffer
    quadBuffer = createQuadBuffer();

    // Load textures
    originalTexture = loadTexture(gl, './original_images/original.png')

    for (let i = 0; i < NUM_MODES; i++) {
        modeTextures[i] = loadTexture(gl, 'modes/mode' + i + '.png');
    }

    // Create ping-pong FBOs
    pingPongFBOs.push(createFBO());
    pingPongFBOs.push(createFBO());

    // Initialize with some example modal coordinates
    const exampleModalCoordinates = new Float32Array(NUM_MODES * 2);
    for (let i = 0; i < NUM_MODES * 2; i++) {
        exampleModalCoordinates[i] = Math.random() - 0.5;
    }

    // Perform initial deformation calculation
    performDeformationCalculation(exampleModalCoordinates);

    // Render final image
    renderFinalImage();
}



function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function createShaderProgram(vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}



function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function createQuadBuffer() {
    // Create buffer
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    // Set buffer data
    const positions = new Float32Array([
        -1.0, 1.0,
        1.0, 1.0,
        -1.0, -1.0,
        1.0, -1.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    return buffer;
}

// function loadTexture(url) {
//     // Create texture
//     const texture = gl.createTexture();
//     gl.bindTexture(gl.TEXTURE_2D, texture);

//     // Load image
//     const image = new Image();
//     image.onload = function () {
//         gl.bindTexture(gl.TEXTURE_2D, texture);
//         gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
//         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
//         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
//         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//     };
//     image.src = url;

//     return texture;
// }

// function loadTexture(gl, url) {
//     return new Promise((resolve, reject) => {
//         // Create texture
//         const texture = gl.createTexture();

//         if (!texture) {
//             reject('Failed to create texture');
//             return;
//         }

//         gl.bindTexture(gl.TEXTURE_2D, texture);

//         // Load image
//         const image = new Image();
//         image.crossOrigin = "anonymous";  // This sets the crossOrigin attribute
//         image.onload = function () {
//             gl.bindTexture(gl.TEXTURE_2D, texture);
//             gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
//             gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
//             gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
//             gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//             gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//             resolve(texture);
//         };
//         image.onerror = function (err) {
//             reject(err);
//         };
//         image.src = url;
//     });
// }

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    if (!texture) {
        reject('Failed to create texture');
        return;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Load image
    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    image.src = url;

    return texture;
}



function createFBO() {
    // Create framebuffer
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    // if (status !== gl.FRAMEBUFFER_COMPLETE) {
    //     console.error('Framebuffer is incomplete:', status);
    // }

    // Create texture for framebuffer
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Attach texture to framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('Framebuffer is incomplete:', status);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return [framebuffer, texture];

}




function performDeformationCalculation(modalCoordinates) {
    gl.useProgram(deformProgram);

    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(deformProgram, 'aPosition');
    const modeTextureLocation = gl.getUniformLocation(deformProgram, 'uModeShape');
    const prevDeformationLocation = gl.getUniformLocation(deformProgram, 'uPreviousDeformation');
    const modalCoordinateLocation = gl.getUniformLocation(deformProgram, 'uModalCoordinate');

    // Set up attribute
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    let sourceIndex = 0;
    let targetIndex = 1;

    for (let i = 0; i < NUM_MODES; i++) {
        if (!(modeTextures[i] instanceof WebGLTexture)) {
            console.error('Texture at index ' + i + ' is not a valid WebGLTexture');
            continue;
        }

        // Bind target framebuffer for off-screen rendering
        gl.bindFramebuffer(gl.FRAMEBUFFER, pingPongFBOs[targetIndex][0]);

        // Set uniforms
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, modeTextures[i]);
        gl.uniform1i(modeTextureLocation, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, pingPongFBOs[sourceIndex][1]);
        gl.uniform1i(prevDeformationLocation, 1);

        gl.uniform2f(modalCoordinateLocation, modalCoordinates[i * 2], modalCoordinates[i * 2 + 1]);

        // Draw (off-screen pass for deformation calculation)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Swap indices
        [sourceIndex, targetIndex] = [targetIndex, sourceIndex];
    }

    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function renderFinalImage() {
    // Set the rendering target to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(renderProgram);

    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(renderProgram, 'aPosition');
    const texCoordLocation = gl.getAttribLocation(renderProgram, 'aTexCoord');
    const originalImageLocation = gl.getUniformLocation(renderProgram, 'uOriginalImage');
    const deformationTextureLocation = gl.getUniformLocation(renderProgram, 'uDeformationTexture');

    // Set up position attribute
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set up texCoord attribute (assuming it's the same as position for a full-screen quad)
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);
    gl.uniform1i(originalImageLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, pingPongFBOs[0].texture);  // Use the last rendered deformation texture
    gl.uniform1i(deformationTextureLocation, 1);

    // Draw (final pass, rendering to canvas)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
// Start the application
init();


//html

/*

<!-- <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebGL Deformation Simulation</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
        }

        canvas {
            display: block;
        }
    </style>
</head>

<body>
    <canvas id="glCanvas" width="800" height="600"></canvas>
    <script src="simulate.js"></script>
</body>

</html> -->


<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebGL Deformation Simulation</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
        }

        canvas {
            display: block;
        }
    </style>
</head>

<body>
    <canvas id="glCanvas" width="800" height="600"></canvas>

    <script id="deform-vertex" type="x-shader/x-vertex"># version 300 es
        in vec2 aPosition;
        out vec2 vUv;
        void main() {
            vUv = aPosition * 0.5 + 0.5; // map from [-1, 1] to [0, 1]
            gl_Position = vec4(aPosition, 0.0, 1.0); // set vertex position
        }
    </script>

    <script id="deform-fragment" type="x-shader/x-fragment"># version 300 es
        precision highp float;
        in vec2 vUv;
        uniform sampler2D uModeShape;
        uniform sampler2D uReadTexture;
        uniform vec2 uModalCoordinate;
        out vec2 fragColor;
        void main() {
            vec2 q = uModalCoordinate;
            vec2 currDisplacement = texture(uReadTexture, vUv).xy;
            vec4 modeShape = texture(uModeShape, vUv);
            vec2 addDisplacement = vec2(modeShape.r * q.x - modeShape.g * q.y, modeShape.b * q.x - modeShape.a * q.y);
            vec2 newDisplacement = currDisplacement + addDisplacement;
            fragColor = newDisplacement;
        }
    </script>

    <script id="render-vertex" type="x-shader/x-vertex"># version 300 es
        in vec2 aPosition;
        in vec2 aTexCoord;
        out vec2 vTexCoord;
        void main() {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vTexCoord = aTexCoord;
        }
    </script>

    <script id="render-fragment" type="x-shader/x-fragment"># version 300 es
        precision highp float;
        uniform sampler2D uOriginalImage;
        uniform sampler2D uDeformationTexture;
        in vec2 vTexCoord;
        layout(location = 0) out vec4 fragColor;
        layout(location = 1) out float fragDepth;
        void main() {
            vec4 deformation = texture(uDeformationTexture, vTexCoord);
            vec2 displacedCoord = vTexCoord + deformation.xy;
            
            vec4 color = texture(uOriginalImage, displacedCoord);
            
            float magnitude = length(deformation.xy);
            float depth = -length(magnitude);
            
            fragColor = color;
            fragDepth = depth;
        }
    </script>

    <script src="simulate.js"></script>
</body>

</html>

*/