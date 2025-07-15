let gl;
let accumulationProgram;
let finalRenderProgram;
let displacementTexture;
let originalTexture;
let positionBuffer;
let texCoordBuffer;
let textures = [];
let modalTextures = [];
let framebuffers = [];
let modalCoordinates = [];
let k = 10;

function init() {
    const canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl');
    console.log('Canvas size:', gl.canvas.width, gl.canvas.height);

    if (!gl) {
        console.error('Unable to initialize WebGL 2. Your browser may not support it.');
        return;
    }

    // Load shaders
    const accumulationVert = loadShader(gl, gl.VERTEX_SHADER, document.getElementById('accumulation-vertex').textContent);
    const accumulationFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('accumulation-fragment').textContent);

    const finalRenderVert = loadShader(gl, gl.VERTEX_SHADER, document.getElementById('final-render-vertex').textContent);
    const finalRenderFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('final-render-fragment-new').textContent);

    const deformVert = loadShader(gl, gl.VERTEX_SHADER, document.getElementById('displacement-accum-vertex').textContent);
    const deformFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('displacement-accum-fragment').textContent);

    // // Create shader programs
    accumulationProgram = createShaderProgram(accumulationVert, accumulationFrag);
    finalRenderProgram = createShaderProgram(finalRenderVert, finalRenderFrag);
    // deformationProgram = createShaderProgram(deformVert, deformFrag);
    // accumulationProgram = createShaderProgram(deformVert, deformFrag);

    // Create quad buffers
    positionBuffer = createPositionBuffer();
    texCoordBuffer = createTexCoordBuffer();

    // Load multiple modal images as textures
    const modalUrls = [];
    for (let i = 0; i < k; i++) {
        modalUrls.push(`./modes/mode${i}.png`);
    }

    // setup modalCoordinates for each mode
    for (let i = 0; i < k; i++) {
        modalCoordinates.push([0.5, -0.3]);
        // modalCoordinates.push([0.0, -1000.0]);
    }

    // load modal images and bind them as textures
    loadImages(modalUrls, (images) => {
        for (let i = 0; i < images.length; i++) {
            const texture = createAndSetupTexture(gl);
            bindTextureWithImage(texture, images[i]);
            modalTextures.push(texture);
        }
        startRendering(images[0].width, images[0].height);
    });
}

function startRendering(width, height) {
    // Initialize (empty) displacement texture
    displacementTexture = createAndSetupTexture(gl);

    // Initialize original texture
    originalTexture = createAndSetupTexture(gl);

    // Load and bind original image texture
    originalImage = loadImage('./original_images/original.png');
    bindTextureWithImage(originalTexture, originalImage);

    // Set canvas size to match original image
    const canvas = document.getElementById('glCanvas');
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Setup framebuffers (ping-pong) and start multi-pass rendering
    setupPingPongFramebuffers(width, height);
    multiPassRendering();
}


function setupPingPongFramebuffers(width, height) {
    for (let i = 0; i < 2; ++i) {
        let texture = createAndSetupTexture(gl);
        textures.push(texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        let fbo = gl.createFramebuffer();
        framebuffers.push(fbo);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
}

// function multiPassRendering() {
//     gl.bindTexture(gl.TEXTURE_2D, displacementTexture);

//     for (let i = 0; i < modalTextures.length; ++i) {
//         setFramebuffer(framebuffers[i % 2], gl.canvas.width, gl.canvas.height);
//         gl.useProgram(accumulationProgram);

//         gl.activeTexture(gl.TEXTURE0);
//         gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
//         gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"), 0);

//         gl.activeTexture(gl.TEXTURE1);
//         gl.bindTexture(gl.TEXTURE_2D, modalTextures[i]);
//         gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 1);

//         gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1.0);


//         // put in value for uniform vec2 modalCoordinate
//         // gl.uniform2f(gl.getUniformLocation(accumulationProgram, "uModalCoordinate"), modalCoordinates[0][0], modalCoordinates[0][1]);

//         drawQuad(accumulationProgram);

//         gl.bindTexture(gl.TEXTURE_2D, textures[i % 2]);
//     }

//     setFramebuffer(null, gl.canvas.width, gl.canvas.height);
//     drawFinalRender();
// }

// function multiPassRendering() {
//     let readFramebuffer = framebuffers[0];
//     let writeFramebuffer = framebuffers[1];

//     // gl.bindTexture(gl.TEXTURE_2D, modalTextures[0]);
//     setFramebuffer(writeFramebuffer, gl.canvas.width, gl.canvas.height);
//     gl.useProgram(accumulationProgram);

//     gl.activeTexture(gl.TEXTURE0);
//     gl.bindTexture(gl.TEXTURE_2D, modalTextures[0]);
//     gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 0);
//     gl.uniform2f(gl.getUniformLocation(accumulationProgram, "uModalCoordinate"), modalCoordinates[0][0], modalCoordinates[0][1]);
//     gl.uniform2f(gl.getUniformLocation(accumulationProgram, "uResolution"), gl.canvas.width, gl.canvas.height);
//     gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1.0 / k);

//     drawQuad(accumulationProgram);

//     for (let i = 1; i < modalTextures.length; ++i) {
//         let temp = readFramebuffer;
//         readFramebuffer = writeFramebuffer;
//         writeFramebuffer = temp;

//         gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
//         gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
//         setFramebuffer(writeFramebuffer, gl.canvas.width, gl.canvas.height);
//         // gl.useProgram(accumulationProgram);

//         gl.activeTexture(gl.TEXTURE0);
//         gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
//         gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"), 0);

//         gl.activeTexture(gl.TEXTURE1);
//         gl.bindTexture(gl.TEXTURE_2D, modalTextures[i]);
//         gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 1);

//         gl.uniform2f(gl.getUniformLocation(accumulationProgram, "uModalCoordinate"), modalCoordinates[i][0], modalCoordinates[i][1]);
//         gl.uniform2f(gl.getUniformLocation(accumulationProgram, "uResolution"), gl.canvas.width, gl.canvas.height);
//         gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1.0 / k);
//         // if (i != 9) { gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 0.0); }

//         drawQuad(accumulationProgram);
//     }

//     // Final rendering pass
//     setFramebuffer(null, gl.canvas.width, gl.canvas.height);
//     drawFinalRender();
// }

function multiPassRendering() {
    let readFramebuffer = framebuffers[0];
    let writeFramebuffer = framebuffers[1];

    // Initial pass setup
    gl.useProgram(accumulationProgram);

    // Loop through remaining modal textures
    for (let i = 0; i < modalTextures.length; ++i) {
        // Swap framebuffers
        let temp = readFramebuffer;
        readFramebuffer = writeFramebuffer;
        writeFramebuffer = temp;

        // Bind the previously written texture and the next modal texture
        // gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
        gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
        setFramebuffer(writeFramebuffer, gl.canvas.width, gl.canvas.height);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
        // gl.bindTexture(gl.TEXTURE_2D, readFramebuffer.texture);
        gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, modalTextures[i]);
        gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 1);

        // gl.uniform2f(gl.getUniformLocation(accumulationProgram, "uModalCoordinate"), modalCoordinates[i][0], modalCoordinates[i][1]);
        gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateX"), modalCoordinates[i][0]);
        gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateY"), modalCoordinates[i][1]);
        gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1.0 / k);

        drawQuad(accumulationProgram);
    }

    // Final rendering pass
    setFramebuffer(null, gl.canvas.width, gl.canvas.height);
    drawFinalRender();
}

function setFramebuffer(fbo, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.uniform2f(gl.getUniformLocation(finalRenderProgram, "uResolution"), width, height);
    gl.viewport(0, 0, width, height);
}

function drawQuad(program) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(program, 'aPosition'));
    gl.vertexAttribPointer(gl.getAttribLocation(program, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(program, 'aTexCoord'));
    gl.vertexAttribPointer(gl.getAttribLocation(program, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// function drawFinalRender() {
//     gl.useProgram(finalRenderProgram);

//     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//     gl.enableVertexAttribArray(gl.getAttribLocation(finalRenderProgram, 'aPosition'));
//     gl.vertexAttribPointer(gl.getAttribLocation(finalRenderProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

//     gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
//     gl.enableVertexAttribArray(gl.getAttribLocation(finalRenderProgram, 'aTexCoord'));
//     gl.vertexAttribPointer(gl.getAttribLocation(finalRenderProgram, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);

//     gl.activeTexture(gl.TEXTURE0);
//     gl.bindTexture(gl.TEXTURE_2D, textures[(modalTextures.length - 1) % 2]);
//     gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uAccumulatedDisplacement"), 0);

//     gl.activeTexture(gl.TEXTURE1);
//     gl.bindTexture(gl.TEXTURE_2D, originalTexture);
//     gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uOriginalTexture"), 1);

//     gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
// }

function drawFinalRender() {
    gl.useProgram(finalRenderProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(finalRenderProgram, 'aPosition'));
    gl.vertexAttribPointer(gl.getAttribLocation(finalRenderProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(finalRenderProgram, 'aTexCoord'));
    gl.vertexAttribPointer(gl.getAttribLocation(finalRenderProgram, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[(modalTextures.length - 1) % 2]);
    gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uAccumulatedDisplacement"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);
    gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uOriginalTexture"), 1);

    gl.uniform2f(gl.getUniformLocation(finalRenderProgram, "uResolution"), gl.canvas.width, gl.canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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

function createPositionBuffer() {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const positions = new Float32Array([
        -1.0, 1.0,
        1.0, 1.0,
        -1.0, -1.0,
        1.0, -1.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    return buffer;
}

function createTexCoordBuffer() {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const texCoords = new Float32Array([
        0.0, 1.0,
        1.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    return buffer;
}

function createAndSetupTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return texture;
}
function bindTextureWithImage(texture, image) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

function loadImage(url) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    return image;
}

function loadImages(urls, callback) {
    const images = [];
    let imagesToLoad = urls.length;

    // Function called each time an image finishes loading
    const onImageLoad = function () {
        --imagesToLoad;
        if (imagesToLoad === 0) {
            callback(images);
        }
    };
    // Load each image asynchronously
    urls.forEach((url) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = onImageLoad;
        image.src = url;
        images.push(image);
    });
}



// Main Function Call
window.onload = init;

