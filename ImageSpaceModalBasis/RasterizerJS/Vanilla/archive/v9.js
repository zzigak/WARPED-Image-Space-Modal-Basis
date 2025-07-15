/*
Init
*/
let gl;
let accumulationProgram;
let finalRenderProgram;
let arrowProgram;
let arrowBuffer;
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
let selectedModes = [];

let isMouseDown = false;
let mouseDownPosition = [0, 0];
let currentMousePosition = [0, 0];


// State Update Stuff
import * as MS from './stateUpdate_v7.js';

let modes = [];
let activeModes = [];
let tempModes = [];
let dt = 0.01;
let msec = 100;
let d = [5, 5];
let p = [0, 0];
let numFrames = 100;
let currentFrameIndex = 0;
let currentTime = 0;
let modalCoordinatesList = [];

// Deforamtion Map Visualization
let deformationCanvas;
let deformationGl;
let deformationProgram;
let deformationTexture;





/* 
///////////////////////////////


INIT FUNCTION

///////////////////////////////

*/
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
    const accumulationVertSource = await loadShaderFile('./shaders/accumulation-vertex.vert');
    const accumulationFragSource = await loadShaderFile('./shaders/accumulation-fragment.frag');
    const finalRenderVertSource = await loadShaderFile('./shaders/final-render-vertex.vert');
    const finalRenderFragSource = await loadShaderFile('./shaders/final-render-fragment.frag');
    const textocanvasFragSource = await loadShaderFile('./shaders/textocanvas.frag');
    const textocanvasVertSource = await loadShaderFile('./shaders/textocanvas.vert');
    const arrowVertSource = await loadShaderFile('./shaders/drawArrow.vert');
    const arrowFragSource = await loadShaderFile('./shaders/drawArrow.frag');

    const accumulationVert = loadShader(gl, gl.VERTEX_SHADER, accumulationVertSource);
    const accumulationFrag = loadShader(gl, gl.FRAGMENT_SHADER, accumulationFragSource);
    const finalRenderVert = loadShader(gl, gl.VERTEX_SHADER, finalRenderVertSource);
    const finalRenderFrag = loadShader(gl, gl.FRAGMENT_SHADER, finalRenderFragSource);
    const textocanvasVert = loadShader(gl, gl.VERTEX_SHADER, textocanvasVertSource);
    const textocanvasFrag = loadShader(gl, gl.FRAGMENT_SHADER, textocanvasFragSource);
    const arrowVert = loadShader(gl, gl.VERTEX_SHADER, arrowVertSource);
    const arrowFrag = loadShader(gl, gl.FRAGMENT_SHADER, arrowFragSource);


    // // Create shader programs
    accumulationProgram = createShaderProgram(gl, accumulationVert, accumulationFrag);
    finalRenderProgram = createShaderProgram(gl, finalRenderVert, finalRenderFrag);
    textocanvasProgram = createShaderProgram(gl, textocanvasVert, textocanvasFrag);
    arrowProgram = createShaderProgram(gl, arrowVert, arrowFrag);

    arrowBuffer = gl.createBuffer();

    console.log('Created shader programs');



    // DEFORMATION MAP VISUALIZATION
    deformationCanvas = document.getElementById('deformationCanvas');
    deformationGl = deformationCanvas.getContext('webgl');
    if (!deformationGl) {
        console.error('Unable to initialize WebGL for deformation canvas.');
        return;
    }

    // Load and create shader program for deformation rendering
    const deformationVertSource = await loadShaderFile('./shaders/deformation-vertex.vert');
    const deformationFragSource = await loadShaderFile('./shaders/deformation-fragment.frag');
    const deformationVert = loadShader(deformationGl, deformationGl.VERTEX_SHADER, deformationVertSource);
    const deformationFrag = loadShader(deformationGl, deformationGl.FRAGMENT_SHADER, deformationFragSource);
    deformationProgram = createShaderProgram(deformationGl, deformationVert, deformationFrag);

    //

    // Create quad buffers
    positionBuffer = createPositionBuffer(gl);
    texCoordBuffer = createTexCoordBuffer();


    // Load multiple modal images as textures
    const modalUrls = [];
    for (let i = 0; i < k; i++) {
        modalUrls.push(`./assets/modes/mode${i}.png`);
        // modalUrls.push(`./assets/modes_two/mode${i}_v3.png`);
    }

    // Initialize modes
    // const modeData = await fetchData('./assets/modes_data_2.json');
    const modeData = await fetchData('./assets/modes_data_json/modes_data_new.json');
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
    originalImage = loadImage('./assets/original_images/first_frame.png', function (image) {
        bindTextureWithImage(originalTexture, image);

        canvas.width = image.width;
        canvas.height = image.height;
        deformationCanvas.width = image.width;
        deformationCanvas.height = image.height;


        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        deformationGl.viewport(0, 0, deformationCanvas.width, deformationCanvas.height);

        drawOriginalImage();
    });


    console.log("####### Ready to render #########");

    gl.canvas.addEventListener('mousedown', handleMouseDown);
    gl.canvas.addEventListener('mousemove', handleMouseMove);
    gl.canvas.addEventListener('mouseup', handleMouseUp);
    document.getElementById('impulseButton').addEventListener('click', handleImpulseOneByOne);

}




/*
///////////////////////////////

    EVENT HANDLERS
///////////////////////////////

*/

function getMousePosition(event) {
    const rect = gl.canvas.getBoundingClientRect();
    const scaleX = gl.canvas.width / rect.width;
    const scaleY = gl.canvas.height / rect.height;
    return [
        (event.clientX - rect.left) * scaleX,
        (event.clientY - rect.top) * scaleY
    ];
}

function handleMouseDown(event) {
    if (isMouseDown) return;
    else {
        isMouseDown = true;
        mouseDownPosition = getMousePosition(event);
        currentMousePosition = [...mouseDownPosition];
        p = [Math.round(mouseDownPosition[0]), Math.round(mouseDownPosition[1])];
    }
}

function handleMouseUp() {
    console.log("Mouse up");
    d = [currentMousePosition[0] - mouseDownPosition[0], currentMousePosition[1] - mouseDownPosition[1]];
    // normalize d
    let norm = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
    d = [d[0] / norm, d[1] / norm];
    handleImpulseOneByOne();
    mouseDownPosition = [0, 0];
    currentMousePosition = [0, 0];
}

function handleMouseMove(event) {
    if (isMouseDown) {
        console.log("Mouse is down, moving");
        currentMousePosition = getMousePosition(event);
        currentMousePosition = [...currentMousePosition]
        console.log("New mouse current position:", currentMousePosition);
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




/*
///////////////////////////////

    DATA LOADING FUNCTIONS
///////////////////////////////

 */

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





/*
///////////////////////////////
    MODE FUNCTIONS
///////////////////////////////
*/

// initialize mode objects
function initializeModes(modeBasis, modeFrequencies, topKValuesWeights, urls) {

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
        if (selectedModes.includes(i)) {
            modes[i].last_impulse = MS.get_modal_force(d, p, modes[i]);
        } else {
            modes[i].last_impulse = 0;
        }

    }
}

function checkConvergence(coordinates, threshold) {
    return coordinates.every(coord => Math.abs(coord[0]) < threshold && Math.abs(coord[1]) < threshold);
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

function normalizeModesStrength(modes) {
    const totalStrength = modes.reduce((sum, mode) => sum + mode.strength, 0);
    modes.forEach(mode => mode.strength /= totalStrength);
}




/* 
///////////////////////////////
Drawing Functions
///////////////////////////////
*/

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




function drawFinalRender() {
    console.log("Drawing final render");
    // set canvas to black and clear

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

    // Draw the quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    console.log("Final render complete");

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

function drawArrow(from, to, color = [1.0, 1.0, 0.0, 1.0], lineWidth = 4, arrowSize = 20) {
    console.log("Drawing arrow from", from, "to", to);
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);

    // Calculate the perpendicular vector for line thickness
    const perpX = -dy / length * lineWidth / 2;
    const perpY = dx / length * lineWidth / 2;

    // Create arrow geometry
    const vertices = new Float32Array([
        // Line
        from[0] + perpX, from[1] + perpY,
        from[0] - perpX, from[1] - perpY,
        to[0] + perpX, to[1] + perpY,
        to[0] - perpX, to[1] - perpY,

        // Arrowhead
        to[0], to[1],
        to[0] - arrowSize * Math.cos(angle - Math.PI / 6), to[1] - arrowSize * Math.sin(angle - Math.PI / 6),
        to[0] - arrowSize * Math.cos(angle + Math.PI / 6), to[1] - arrowSize * Math.sin(angle + Math.PI / 6)
    ]);

    gl.useProgram(arrowProgram);

    // Set color uniform
    const colorLocation = gl.getUniformLocation(arrowProgram, 'uColor');
    gl.uniform4fv(colorLocation, color);

    // Set resolution uniform
    const resolutionLocation = gl.getUniformLocation(arrowProgram, 'uResolution');
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    // Set point size uniform (for arrowhead)
    const pointSizeLocation = gl.getUniformLocation(arrowProgram, 'uPointSize');
    gl.uniform1f(pointSizeLocation, arrowSize);

    // Bind vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Set up attribute
    const positionLocation = gl.getAttribLocation(arrowProgram, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Draw the arrow line
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Draw the arrowhead
    gl.drawArrays(gl.TRIANGLES, 4, 3);
}




function handleImpulseOneByOne() {
    console.log("###### Impulse Applied ######");

    resetModes();

    const checkboxes = document.querySelectorAll('#modeCheckboxes input[type="checkbox"]:checked');
    selectedModes = Array.from(checkboxes).map(checkbox => parseInt(checkbox.value));
    console.log("Selected modes:", selectedModes);


    // tempModes = modes;
    let strength = parseFloat(document.getElementById('strength').value);
    let damping = parseFloat(document.getElementById('damping').value);
    let mass = parseFloat(document.getElementById('mass').value);

    // Update modes with new parameters
    MS.setDamping(modes, damping);
    MS.setStrength(modes, strength, selectedModes);
    MS.setMass(modes, mass);
    // Read parameters from HTML
    if (!isMouseDown) {
        p = parseInput(document.getElementById('pPoint').value);
        d = parseInput(document.getElementById('dVector').value);
    } else {
        console.log("setting mouse down to false");
        isMouseDown = false;
    }

    applyImpulse(d, p);

    console.log("Rendering loop...");
    let frameNum = 0;
    let threshold = 0.001;

    function renderFrame() {
        let currentTime = Date.now();
        console.log("Rendering frame", frameNum);

        MS.update_state_time(1, dt, modes, currentTime);
        let coordinates = modes.map(mode => [mode.y[0][0], mode.y[1][0]]);
        // sum over coordinates real and imaginary separately
        let sumReal = 0;
        let sumImag = 0;
        for (let i = 0; i < k; i++) {
            sumReal += coordinates[i][0];

            sumImag += coordinates[i][1];


        }
        console.log("max real part," + Math.max(...coordinates.map(coord => coord[0])));
        console.log("max imag part," + Math.max(...coordinates.map(coord => coord[1])));
        console.log("min real part," + Math.min(...coordinates.map(coord => coord[0])));
        console.log("min imag part," + Math.min(...coordinates.map(coord => coord[1])));
        console.log("Sum of real parts:", sumReal);
        console.log("Sum of imaginary parts:", sumImag);

        modalCoordinatesList.push(coordinates);



        // RENDER SINGLE FRAME
        startRendering(gl.canvas.width, gl.canvas.height);
        modalCoordinatesList.shift();


        if (checkConvergence(coordinates, threshold)) {
            console.log("Convergence reached, rendering 0");
            // set selectedModes to all
            selectedModes = Array.from({ length: k }, (_, i) => i);
            // set 0 to all coordinates
            for (let i = 0; i < k; i++) {
                coordinates.push([0, 0]);
            }
            modalCoordinatesList.push(coordinates);
            startRendering(gl.canvas.width, gl.canvas.height);
            modalCoordinatesList.shift();
            resetModes();
        } else {
            frameNum += 1;
            requestAnimationFrame(renderFrame);
        }

    }

    requestAnimationFrame(renderFrame);
}




/*
///////////////////////////////
    Rendering Functions
///////////////////////////////
*/

function renderDeformationMap() {
    // Create the deformation texture if it doesn't exist
    if (!deformationTexture) {
        deformationTexture = createAndSetupTexture(deformationGl);
    }

    // Copy the accumulated displacement texture to the deformation context
    copyTexture(gl, textures[(modalTextures.length - 1) % 2], deformationGl, deformationTexture);

    deformationGl.bindFramebuffer(deformationGl.FRAMEBUFFER, null);
    deformationGl.viewport(0, 0, deformationCanvas.width, deformationCanvas.height);

    deformationGl.useProgram(deformationProgram);

    // Bind the copied displacement texture
    deformationGl.activeTexture(deformationGl.TEXTURE0);
    deformationGl.bindTexture(deformationGl.TEXTURE_2D, deformationTexture);
    deformationGl.uniform1i(deformationGl.getUniformLocation(deformationProgram, "uAccumulatedDisplacement"), 0);

    // Set up attribute for position
    const aPositionLocation = deformationGl.getAttribLocation(deformationProgram, 'aPosition');
    deformationGl.bindBuffer(deformationGl.ARRAY_BUFFER, createPositionBuffer(deformationGl));
    deformationGl.enableVertexAttribArray(aPositionLocation);
    deformationGl.vertexAttribPointer(aPositionLocation, 2, deformationGl.FLOAT, false, 0, 0);

    // Draw the quad
    deformationGl.drawArrays(deformationGl.TRIANGLE_STRIP, 0, 4);
}

function startRendering(width, height) {
    gl.enable(gl.DEPTH_TEST);

    // Initialize (empty) displacement texture
    displacementTexture = createAndSetupTexture(gl);

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
        // if mode is selected
        if (selectedModes.includes(i)) {
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
        } else {
            console.log("Skipping mode", i);
        }


    }
    renderDeformationMap();

    // Final rendering pass
    setFramebuffer(null, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);


    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    console.log("doing final pass");
    drawFinalRender();
}


/*
///////////////////////////////
    Buffer, Texture, and Shader Functions
///////////////////////////////
*/

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



function createShaderProgram(gl, vertexShader, fragmentShader) {
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

function createPositionBuffer(gl) {
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

function copyTexture(sourceGl, sourceTexture, destGl, destTexture) {
    // Create a temporary canvas to read the source texture
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceGl.canvas.width;
    tempCanvas.height = sourceGl.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Read the source texture
    const framebuffer = sourceGl.createFramebuffer();
    sourceGl.bindFramebuffer(sourceGl.FRAMEBUFFER, framebuffer);
    sourceGl.framebufferTexture2D(sourceGl.FRAMEBUFFER, sourceGl.COLOR_ATTACHMENT0, sourceGl.TEXTURE_2D, sourceTexture, 0);

    const pixels = new Uint8Array(tempCanvas.width * tempCanvas.height * 4);
    sourceGl.readPixels(0, 0, tempCanvas.width, tempCanvas.height, sourceGl.RGBA, sourceGl.UNSIGNED_BYTE, pixels);

    // Write to the temporary canvas
    const imageData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
    imageData.data.set(pixels);
    tempCtx.putImageData(imageData, 0, 0);

    // Copy to destination texture
    destGl.bindTexture(destGl.TEXTURE_2D, destTexture);
    destGl.texImage2D(destGl.TEXTURE_2D, 0, destGl.RGBA, destGl.RGBA, destGl.UNSIGNED_BYTE, tempCanvas);

    // Clean up
    sourceGl.deleteFramebuffer(framebuffer);
}




// If async
window.onload = () => {
    init().catch(console.error);
};


