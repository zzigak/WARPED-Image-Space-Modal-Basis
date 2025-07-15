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

    // Load the extension for floating point textures
    if (!gl.getExtension('EXT_color_buffer_float')) {
        console.log('EXT_color_buffer_float extension not supported');
        // return;
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
    originalTexture = loadTexture('./original_images/original.png');

    for (let i = 0; i < NUM_MODES; i++) {
        modeTextures[i] = loadTexture(`modes/mode${i}.png`);
    }

    // Create ping-pong FBOs
    pingPongFBOs.push(createFBO(gl.canvas.width, gl.canvas.height));
    pingPongFBOs.push(createFBO(gl.canvas.width, gl.canvas.height));

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

function loadTexture(url) {
    const texture = gl.createTexture();
    if (!texture) {
        console.error('Failed to create texture');
        return null;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Load image
    const image = new Image();
    image.crossOrigin = "anonymous";
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

function createFBO(width, height) {
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

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

    const positionLocation = gl.getAttribLocation(deformProgram, 'aPosition');
    const modeTextureLocation = gl.getUniformLocation(deformProgram, 'uModeShape');
    const prevDeformationLocation = gl.getUniformLocation(deformProgram, 'uPreviousDeformation');
    const modalCoordinateLocation = gl.getUniformLocation(deformProgram, 'uModalCoordinate');

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

        gl.bindFramebuffer(gl.FRAMEBUFFER, pingPongFBOs[targetIndex][0]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, modeTextures[i]);
        gl.uniform1i(modeTextureLocation, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, pingPongFBOs[sourceIndex][1]);
        gl.uniform1i(prevDeformationLocation, 1);

        gl.uniform2f(modalCoordinateLocation, modalCoordinates[i * 2], modalCoordinates[i * 2 + 1]);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        [sourceIndex, targetIndex] = [targetIndex, sourceIndex];
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function renderFinalImage() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(renderProgram);

    const positionLocation = gl.getAttribLocation(renderProgram, 'aPosition');
    const texCoordLocation = gl.getAttribLocation(renderProgram, 'aTexCoord');
    const originalImageLocation = gl.getUniformLocation(renderProgram, 'uOriginalImage');
    const deformationTextureLocation = gl.getUniformLocation(renderProgram, 'uDeformationTexture');

    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);
    gl.uniform1i(originalImageLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, pingPongFBOs[0][1]);
    gl.uniform1i(deformationTextureLocation, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Start the application
init();