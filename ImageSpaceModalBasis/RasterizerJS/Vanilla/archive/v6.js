let gl;
let accumulationProgram;
let finalRenderProgram;
let textocanvasProgram;
let displacementTexture;
let originalTexture;
let originalImage;
let positionBuffer;
let texCoordBuffer;
let texDims = [];
let textures = [];
let modalTextures = [];
let framebuffers = [];
let k = 10;


// async function fetchData(path) {
//     try {
//         const response = await fetch(path);
//         const data = await response.json();
//         console.log('Loaded modal basis data JSON');
//         return {
//             modeBasis: data.mode_basis,
//             modeFrequencies: data.mode_frequencies,
//             topKValuesWeights: data.top_k_values_weights
//         };
//     } catch (error) {
//         console.error('Error loading modal basis data JSON:', error);
//     }
// }

async function fetchData(path) {
    const response = await fetch(path);
    const data = await response.json();
    console.log('Loaded modal basis data JSON');
    return {
        modeBasis: data.mode_basis,
        modeFrequencies: data.mode_frequencies,
        topKValuesWeights: data.top_k_values_weights
    };
}


// // load data for modal basis
// function fetchData(path) {
//     fetch(path)
//         .then(response => response.json())
//         .then(data => {
//             console.log('Data:', data);
//             const modeBasis = data.mode_basis;
//             const modeFrequencies = data.mode_frequencies;
//             const topKValuesWeights = data.top_k_values_weights;

//             // check if anything is non-zero in modeBasis
//             // const flattened = modeBasis.flat(Infinity); // ES6+
//             // console.log(flattened.some(elem => elem !== 0));

//             // console.log('Mode Basis:', modeBasis);
//             // console.log('Mode Frequencies:', modeFrequencies);
//             // console.log('Top K Values Weights:', topKValuesWeights);

//             console.log('Loaded modal basis data JSON')
//             return { modeBasis, modeFrequencies, topKValuesWeights };
//         });
//     // .catch(error => console.error('Error loading modal basis data JSON:', error));
// }

// State Update Stuff
import * as MS from './stateUpdate.js';

let modes = [];
let dt = 0.01;
let msec = 100;
let d = [5, 5];
let p = [0, 0];
let numFrames = 100;
let currentFrameIndex = 0;
let modalCoordinatesList = [];


// initialize mode objects
function initializeModes(modeBasis, modeFrequencies, topKValuesWeights, urls) {
    // console.log('modeBasis:', modeBasis);
    // console.log('modeFrequencies:', modeFrequencies);
    // console.log('topKValuesWeights:', topKValuesWeights);
    // console.log('urls:', urls);

    if (!modeBasis || !modeBasis.length) {
        console.error('modeBasis is undefined or empty');
        return;
    }

    for (let i = 0; i < modeBasis.length; i++) {
        let basis = modeBasis[i];
        let strength = topKValuesWeights[i] * 1;
        let frequency = modeFrequencies[i];
        let damping = 0.07;
        let mass = 1;
        let url = urls[i];
        modes.push(new MS.Mode(basis, strength, frequency, damping, mass, url));
    }
}

// apply impulse from force
function applyImpulse(d, p) {
    for (let i = 0; i < Math.min(8, modes.length); i++) {
        modes[i].last_impulse = MS.get_modal_force(d, p, modes[i]);
    }
}

// read p,d from html
function parseInput(input) {
    const parts = input.split(',').map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
        throw new Error('Invalid input format. Expected format: x,y');
    }
    return parts;
}


// function handleImpulse() {
//     console.log('Impulse Button Clicked');
//     resetModes();

//     const p = parseInput(document.getElementById('pPoint').value);
//     const d = parseInput(document.getElementById('dVector').value);

//     applyImpulse(d, p);

//     // Compute modal coordinates for each frame
//     modalCoordinatesList = computeModalCoordinates(numFrames);

//     // // check if there are any nonzero elements in modalCoordinatesList
//     // console.log(modalCoordinatesList[0]);
//     // const flattened = modalCoordinatesList.flat(Infinity); // ES6+
//     // console.log(flattened.some(elem => elem !== 0));
//     // currentFrameIndex = 0;

//     // For each frame call startRendering
//     while (modalCoordinatesList.length > 0) {
//         startRendering(texDims[0], texDims[1]);
//         modalCoordinatesList.shift();
//         checkFramebuffer();
//         drawOriginalImage();
//         checkFramebuffer();
//     }

// }

function handleImpulse() {
    console.log('Impulse Button Clicked');
    resetModes();

    let p = parseInput(document.getElementById('pPoint').value);
    let d = parseInput(document.getElementById('dVector').value);
    let strength = parseFloat(document.getElementById('strength').value);
    let damping = parseFloat(document.getElementById('damping').value);
    let mass = parseFloat(document.getElementById('mass').value);

    MS.setDamping(modes, damping);
    MS.setStrength(modes, strength);
    MS.setMass(modes, mass);

    applyImpulse(d, p);

    // Compute modal coordinates for each frame
    modalCoordinatesList = computeModalCoordinates(numFrames);

    // Render frames with delay
    renderFramesWithDelay(60); // 60 fps
}


function renderFramesWithDelay(fps = 60) {
    const frameDelay = 60 / fps;
    let lastFrameTime = 0;

    function renderFrame(currentTime) {
        if (currentTime - lastFrameTime >= frameDelay) {
            if (modalCoordinatesList.length > 0) {
                startRendering(gl.canvas.width, gl.canvas.height);
                modalCoordinatesList.shift();
                // checkFramebuffer();
                // drawOriginalImage();
                // checkFramebuffer();
                lastFrameTime = currentTime;
            }
        }

        if (modalCoordinatesList.length > 0) {
            requestAnimationFrame(renderFrame);
        }
    }

    requestAnimationFrame(renderFrame);
}


// reset coordinates and impulses
function resetModes() {
    modes.forEach(mode => {
        mode.y = [[0.0], [0.0]];
        mode.q_i = { re: 0.0, im: 0.0 };
        mode.last_impulse = 0;
        mode.last_impulse_time = 0;
    });
}

// computes modalCoordinates for numFrames using last_impulse set in initializeModes
function computeModalCoordinates(numFrames) {
    console.log('Computing Modal Coordinates');
    let currentTime = 0;
    let l = []

    for (let i = 0; i < numFrames; i++) {
        MS.update_state_time(1, dt, modes, currentTime);
        let coordinates = modes.map(mode => [mode.y[0][0], mode.y[1][0]]);
        l.push(coordinates);
        currentTime += 1;
    }

    return l;
}

async function init() {
    const canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl');
    console.log('Canvas size:', gl.canvas.width, gl.canvas.height)
    texDims = [gl.canvas.width, gl.canvas.height];

    if (!gl) {
        console.error('Unable to initialize WebGL 2. Your browser may not support it.');
        return;
    }

    const ext = gl.getExtension('EXT_frag_depth');
    if (!ext) {
        console.warn('EXT_frag_depth extension not supported');
    }

    // Load shaders from Files
    const accumulationVertSource = await loadShaderFile('accumulation-vertex.vert');
    const accumulationFragSource = await loadShaderFile('accumulation-fragment.frag');
    const finalRenderVertSource = await loadShaderFile('final-render-vertex.vert');
    const finalRenderFragSource = await loadShaderFile('final-render-fragment.frag');
    const textocanvasFragSource = await loadShaderFile('textocanvas.frag');
    const textocanvasVertSource = await loadShaderFile('textocanvas.vert');

    const accumulationVert = loadShader(gl, gl.VERTEX_SHADER, accumulationVertSource);
    const accumulationFrag = loadShader(gl, gl.FRAGMENT_SHADER, accumulationFragSource);
    const finalRenderVert = loadShader(gl, gl.VERTEX_SHADER, finalRenderVertSource);
    const finalRenderFrag = loadShader(gl, gl.FRAGMENT_SHADER, finalRenderFragSource);
    const textocanvasVert = loadShader(gl, gl.VERTEX_SHADER, textocanvasVertSource);
    const textocanvasFrag = loadShader(gl, gl.FRAGMENT_SHADER, textocanvasFragSource);


    // // Create shader programs
    accumulationProgram = createShaderProgram(accumulationVert, accumulationFrag);
    finalRenderProgram = createShaderProgram(finalRenderVert, finalRenderFrag);
    textocanvasProgram = createShaderProgram(textocanvasVert, textocanvasFrag);

    console.log('Created shader programs');

    // Create quad buffers
    positionBuffer = createPositionBuffer();
    texCoordBuffer = createTexCoordBuffer();

    // Load multiple modal images as textures
    const modalUrls = [];
    for (let i = 0; i < k; i++) {
        modalUrls.push(`./assets/modes/mode${i}.png`);
    }

    // Initialize modes
    const modeData = await fetchData('./assets/modes_data.json');
    console.log("Got mode data");
    initializeModes(modeData.modeBasis, modeData.modeFrequencies, modeData.topKValuesWeights, modalUrls);

    console.log("initialized modes");

    // Load modal images and bind them as textures
    loadImages(modalUrls, (images) => {
        for (let i = 0; i < images.length; i++) {
            const texture = createAndSetupTexture(gl);
            bindTextureWithImage(texture, images[i]);
            modalTextures.push(texture);
        }
    });

    console.log('Loaded modal images as textures');

    // Initialize original texture
    originalTexture = createAndSetupTexture(gl);
    originalImage = loadImage('./assets/original_images/original.png', function (image) {
        bindTextureWithImage(originalTexture, image);

        canvas.width = image.width;
        canvas.height = image.height;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        drawOriginalImage();
    });


    console.log("Ready to render...");

    // Impulse button listener
    document.getElementById('impulseButton').addEventListener('click', handleImpulse);

}

function startRendering(width, height) {
    gl.enable(gl.DEPTH_TEST);

    // Initialize (empty) displacement texture
    displacementTexture = createAndSetupTexture(gl);

    // Initialize original texture
    // originalTexture = createAndSetupTexture(gl);
    // originalImage = loadImage('./assets/original_images/original.png', function (image) {
    //     // console.log('Original Image:', image);
    //     bindTextureWithImage(originalTexture, image);
    // });
    // bindTextureWithImage(originalTexture, originalImage);


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

function multiPassRendering() {
    let readFramebuffer = framebuffers[0];
    let writeFramebuffer = framebuffers[1];

    // Initial pass setup
    gl.useProgram(accumulationProgram);
    gl.disable(gl.DEPTH_TEST)
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);


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

        gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateX"), modalCoordinatesList[currentFrameIndex][i][0]);
        gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateY"), modalCoordinatesList[currentFrameIndex][i][1]);
        gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1.0 / k);

        drawQuad(accumulationProgram);
    }

    // Final rendering pass
    setFramebuffer(null, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);


    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    console.log("doing final pass");
    drawFinalRender();
}


function checkFramebuffer() {
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let allBlack = true;
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) {
            allBlack = false;
            break;
        }
    }

    console.log("Framebuffer is " + (allBlack ? "all black" : "not all black"));
}

function setFramebuffer(fbo, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.uniform2f(gl.getUniformLocation(finalRenderProgram, "uResolution"), width, height);
    gl.viewport(0, 0, width, height);
}

function drawQuad(program) {
    program = accumulationProgram
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
//     setFramebuffer(null, gl.canvas.width, gl.canvas.height);

//     console.log("Drawing final render");

//     gl.useProgram(finalRenderProgram);
//     const aPositionLocation = gl.getAttribLocation(finalRenderProgram, 'aPosition');


//     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//     gl.enableVertexAttribArray(aPositionLocation);
//     gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);

//     // gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
//     // gl.enableVertexAttribArray(aTexCoordLocation);
//     // gl.vertexAttribPointer(aTexCoordLocation, 2, gl.FLOAT, false, 0, 0);

//     gl.activeTexture(gl.TEXTURE0);
//     gl.bindTexture(gl.TEXTURE_2D, textures[(modalTextures.length - 1) % 2]);
//     gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uAccumulatedDisplacement"), 0);

// gl.activeTexture(gl.TEXTURE1);
// gl.bindTexture(gl.TEXTURE_2D, originalTexture);
// gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uOriginalTexture"), 1);

//     gl.uniform1f(gl.getUniformLocation(accumulationProgram, "texDimWidth"), texDims[0]);
//     gl.uniform1f(gl.getUniformLocation(accumulationProgram, "texDimHeight"), texDims[1]);


//     gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
//     console.log("Final render complete");

// }


function drawFinalRender() {
    console.log("Drawing final render");
    // set canvas to black and clear


    // // Check if the last framebuffer contains non-white pixels
    // const pixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[(modalTextures.length - 1) % 2]);
    // gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    // const hasNonWhitePixels = pixels.some((value, index) => index % 4 !== 3 && value < 255);
    // console.log("Last framebuffer has non-white pixels:", hasNonWhitePixels);

    // Switch back to default framebuffer

    // setFramebuffer(null, gl.canvas.width, gl.canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Clear the canvas
    // gl.clearColor(1.0, 1.0, 1.0, 1.0);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the final render program
    gl.useProgram(finalRenderProgram);

    // Set up attribute for position
    const aPositionLocation = gl.getAttribLocation(finalRenderProgram, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(aPositionLocation);
    gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);


    // const aTexCoordLocation = gl.getAttribLocation(finalRenderProgram, 'aTexCoord');
    // gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    // gl.enableVertexAttribArray(aTexCoordLocation);
    // gl.vertexAttribPointer(aTexCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // // Bind accumulated displacement texture
    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, textures[(modalTextures.length - 1) % 2]);
    // const uAccumulatedDisplacementLocation = gl.getUniformLocation(finalRenderProgram, "uAccumulatedDisplacement");
    // gl.uniform1i(uAccumulatedDisplacementLocation, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[(modalTextures.length - 1) % 2]);
    gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uAccumulatedDisplacement"), 0);




    // Bind original texture

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);
    gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uOriginalTexture"), 1);


    // gl.activeTexture(gl.TEXTURE1);
    // gl.bindTexture(gl.TEXTURE_2D, originalTexture);
    // const uOriginalTextureLocation = gl.getUniformLocation(finalRenderProgram, "uOriginalTexture");
    // gl.uniform1i(uOriginalTextureLocation, 1);

    // Set texture dimensions
    const uTexDimWidthLocation = gl.getUniformLocation(finalRenderProgram, "texDimWidth");
    const uTexDimHeightLocation = gl.getUniformLocation(finalRenderProgram, "texDimHeight");
    gl.uniform1f(uTexDimWidthLocation, gl.canvas.width);
    gl.uniform1f(uTexDimHeightLocation, gl.canvas.height);

    // // Log diagnostic information
    // console.log("Canvas dimensions:", gl.canvas.width, gl.canvas.height);
    // console.log("Accumulated displacement texture bound:", gl.isTexture(textures[(modalTextures.length - 1) % 2]));
    // console.log("Original texture bound:", gl.isTexture(originalTexture));
    // console.log("uAccumulatedDisplacement location:", uAccumulatedDisplacementLocation);
    // console.log("uOriginalTexture location:", uOriginalTextureLocation);
    // console.log("uTexDimWidth location:", uTexDimWidthLocation);
    // console.log("uTexDimHeight location:", uTexDimHeightLocation);

    // Draw the quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    console.log("Final render complete");

    // Check if anything was actually drawn
    // const finalPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    // gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, finalPixels);
    // const finalHasNonWhitePixels = finalPixels.some((value, index) => index % 4 !== 3 && value < 255);
    // console.log("Final render has non-white pixels:", finalHasNonWhitePixels);

    // // If still white, log some pixel values for debugging
    // if (!finalHasNonWhitePixels) {
    //     console.log("Sample pixel values:");
    //     for (let i = 0; i < 5; i++) {
    //         const index = i * 4;
    //         console.log(`Pixel ${i}: R: ${finalPixels[index]}, G: ${finalPixels[index + 1]}, B: ${finalPixels[index + 2]}, A: ${finalPixels[index + 3]}`);
    //     }
    // }
}

function drawOriginalImage() {
    setFramebuffer(null, gl.canvas.width, gl.canvas.height);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(textocanvasProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(textocanvasProgram, 'aPosition'));
    gl.vertexAttribPointer(gl.getAttribLocation(textocanvasProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(textocanvasProgram, 'aTexCoord'));
    gl.vertexAttribPointer(gl.getAttribLocation(textocanvasProgram, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);

    gl.uniform1i(gl.getUniformLocation(textocanvasProgram, "uOriginalTexture"), 0);

    console.log("Original texture bound:", gl.isTexture(originalTexture));

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

function loadShaderFile(url) {
    return fetch(url).then(response => response.text());
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

function loadImage(url, onLoadCallback) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    image.onload = () => onLoadCallback(image);
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



// // Main Function Call
// window.onload = init;

// If async
window.onload = () => {
    init().catch(console.error);
};


