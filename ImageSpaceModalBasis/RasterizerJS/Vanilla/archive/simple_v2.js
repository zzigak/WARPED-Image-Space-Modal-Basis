
// let gl;
// let renderProgram;
// let originalTexture;
// let positionBuffer;
// let texCoordBuffer;

// // Framebuffer and textures for multi-pass rendering
// let textures = [];
// let modalTextures = [];
// let framebuffers = [];
// let k = 3;

// function init() {
//     const canvas = document.getElementById('glCanvas');
//     gl = canvas.getContext('webgl2');
//     console.log('Canvas size:', gl.canvas.width, gl.canvas.height);

//     if (!gl) {
//         console.error('Unable to initialize WebGL 2. Your browser may not support it.');
//         return;
//     }

//     // Load render shaders
//     const renderVert = loadShader(gl, gl.VERTEX_SHADER, document.getElementById('render-vertex').textContent);
//     const renderFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('render-fragment').textContent);

//     // Load deform shaders
//     const deformVert = loadShader(gl, gl.VERTEX_SHADER, document.getElementById('displacement-accum-vertex').textContent);
//     const deformFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('displacement-accum-fragment').textContent);

//     // Create final render shader program
//     renderProgram = createShaderProgram(renderVert, renderFrag);

//     // Create displacement accumulation shader program
//     displacementProgram = createShaderProgram(deformVert, deformFrag);

//     // Create quad buffers
//     positionBuffer = createPositionBuffer();
//     texCoordBuffer = createTexCoordBuffer();

//     // Load multiple modal images as textures
//     const modalUrls = [];
//     for (let i = 1; i <= k; i++) {
//         modalUrls.push(`./modes/mode${i}.png`);
//     }

//     // load modal images and bind them as textures
//     loadImages(modalUrls, (images) => {
//         for (let i = 0; i < images.length; i++) {
//             const texture = createAndSetupTexture(gl);
//             bindTextureWithImage(texture, images[i]);
//             modalTextures.push(texture);
//         }
//     });

//     // Initialize (empty) displacement texture
//     displacementTexture = createAndSetupTexture(gl);

//     // Initialize original texture
//     originalTexture = createAndSetupTexture(gl);

//     // Load and bind original image texture
//     originalImage = loadImage('./original_images/original.png');
//     bindTextureWithImage(originalTexture, originalImage);

//     // Set canvas size to match original image
//     canvas.width = originalImage.width;
//     canvas.height = originalImage.height;
//     gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

//     // Setup framebuffers (ping-pong) and start multi-pass rendering, 2 FrameBuffers
//     setupFramebuffers(originalImage.width, originalImage.height, 2);
//     multiPassRendering(originalImage);


//     // loadImageTexture('./original_images/original.png', (image) => {
//     //     bindTextureWithImage(originalTexture, image);
//     //     canvas.width = image.width;
//     //     canvas.height = image.height;
//     //     gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
//     //     // Setup framebuffers and start multi-pass rendering
//     //     setupFramebuffers(image.width, image.height, 2);
//     //     multiPassRendering(image);
//     // });


// }

// function setupFramebuffers(width, height, k) {
//     for (let i = 0; i < k; ++i) {
//         // Create a texture
//         let texture = createAndSetupTexture(gl);
//         textures.push(texture);

//         // Make the texture the same size as the image
//         gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

//         // Create a framebuffer
//         let fbo = gl.createFramebuffer();
//         framebuffers.push(fbo);
//         gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

//         // Attach the texture to the framebuffer
//         gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
//     }
// }

// function multiPassRendering(image) {
//     // Start with the original image as source
//     gl.bindTexture(gl.TEXTURE_2D, originalTexture);

//     // Loop through each pass
//     for (let i = 0; i < 2; ++i) {
//         // Setup to draw into one of the framebuffers (targetTexture)
//         setFramebuffer(framebuffers[i], image.width, image.height);

//         if (i === 0) {
//             // Apply invert effect
//             drawInvertEffect();
//         } else {
//             // Apply grayscale effect (for simplicity)
//             drawGrayscaleEffect();
//         }


//         // Use the texture we just rendered to for the next pass (sourceTexture)
//         gl.bindTexture(gl.TEXTURE_2D, textures[i]);
//     }

//     // Finally, draw the result to the canvas
//     setFramebuffer(null, gl.canvas.width, gl.canvas.height);
//     drawToCanvas();
// }

// function setFramebuffer(fbo, width, height) {
//     // Make this the framebuffer we are rendering to (targetTexture)
//     gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

//     // Tell the shader the resolution of the framebuffer
//     gl.uniform2f(gl.getUniformLocation(renderProgram, "uResolution"), width, height);

//     // Tell WebGL the viewport setting needed for the framebuffer
//     gl.viewport(0, 0, width, height);
// }

// function drawGrayscaleEffect() {
//     // Use the shader program
//     gl.useProgram(renderProgram);

//     // Bind buffers
//     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//     gl.enableVertexAttribArray(gl.getAttribLocation(renderProgram, 'aPosition'));
//     gl.vertexAttribPointer(gl.getAttribLocation(renderProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

//     gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
//     gl.enableVertexAttribArray(gl.getAttribLocation(renderProgram, 'aTexCoord'));
//     gl.vertexAttribPointer(gl.getAttribLocation(renderProgram, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);

//     // Set uniform for grayscale effect
//     gl.uniform1i(gl.getUniformLocation(renderProgram, 'uApplyGrayscale'), 1);

//     // Draw a fullscreen quad
//     gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
// }

// function drawInvertEffect() {
//     // Use the shader program
//     gl.useProgram(renderProgram);

//     // Bind buffers
//     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//     gl.enableVertexAttribArray(gl.getAttribLocation(renderProgram, 'aPosition'));
//     gl.vertexAttribPointer(gl.getAttribLocation(renderProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

//     gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
//     gl.enableVertexAttribArray(gl.getAttribLocation(renderProgram, 'aTexCoord'));
//     gl.vertexAttribPointer(gl.getAttribLocation(renderProgram, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);

//     // Set uniform for grayscale effect
//     gl.uniform1i(gl.getUniformLocation(renderProgram, 'uApplyInvert'), 1);

//     // Draw a fullscreen quad
//     gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
// }


// function drawToCanvas() {
//     // Use the shader program
//     gl.useProgram(renderProgram);

//     // Bind buffers
//     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//     gl.enableVertexAttribArray(gl.getAttribLocation(renderProgram, 'aPosition'));
//     gl.vertexAttribPointer(gl.getAttribLocation(renderProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

//     gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
//     gl.enableVertexAttribArray(gl.getAttribLocation(renderProgram, 'aTexCoord'));
//     gl.vertexAttribPointer(gl.getAttribLocation(renderProgram, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);

//     // Set uniform for final render pass
//     gl.uniform1i(gl.getUniformLocation(renderProgram, 'u_applyGrayscale'), 0);

//     // Draw a fullscreen quad
//     gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
// }

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
    const finalRenderFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('final-render-fragment').textContent);

    const deformVert = loadShader(gl, gl.VERTEX_SHADER, document.getElementById('displacement-accum-vertex').textContent);
    const deformFrag = loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById('displacement-accum-fragment').textContent);

    // // Create shader programs
    accumulationProgram = createShaderProgram(accumulationVert, accumulationFrag);
    finalRenderProgram = createShaderProgram(finalRenderVert, finalRenderFrag);
    // deformationProgram = createShaderProgram(deformVert, deformFrag);

    // Create quad buffers
    positionBuffer = createPositionBuffer();
    texCoordBuffer = createTexCoordBuffer();

    // Load multiple modal images as textures
    const modalUrls = [];
    // for (let i = 0; i < k; i++) {
    //     modalUrls.push(`./modes/mode${i}.png`);
    // }
    for (let i = 0; i < k; i++) {
        modalUrls.push(`./modes_xy/mode${i}_y.png`);
    }

    // setup modalCoordinates for each mode
    for (let i = 0; i < k; i++) {
        modalCoordinates.push([1.0, 1.0]);
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
    setupFramebuffers(width, height, 2);
    multiPassRendering();
}

function setupFramebuffers(width, height, k) {
    for (let i = 0; i < k; ++i) {
        let texture = createAndSetupTexture(gl);
        textures.push(texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        let fbo = gl.createFramebuffer();
        framebuffers.push(fbo);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
}

function multiPassRendering() {
    gl.bindTexture(gl.TEXTURE_2D, displacementTexture);

    for (let i = 0; i < modalTextures.length; ++i) {
        setFramebuffer(framebuffers[i % 2], gl.canvas.width, gl.canvas.height);
        gl.useProgram(accumulationProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
        gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, modalTextures[i]);
        gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 1);

        gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1 / k);

        // put in value for uniform vec2 modalCoordinate
        // gl.uniform2f(gl.getUniformLocation(accumulationProgram, "uModalCoordinate"), modalCoordinates[0][0], modalCoordinates[0][1]);

        drawQuad(accumulationProgram);

        gl.bindTexture(gl.TEXTURE_2D, textures[i % 2]);
    }

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

// function loadImageTexture(url, callback) {
//     const image = new Image();
//     image.crossOrigin = "anonymous";
//     image.onload = function () {
//         callback(image);
//     };
//     image.src = url;
//     return image;
// }

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



window.onload = init;

