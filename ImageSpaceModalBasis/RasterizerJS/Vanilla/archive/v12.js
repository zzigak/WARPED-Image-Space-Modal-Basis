/*
///////////////////////////////
Init variables
///////////////////////////////
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



// State Update Stuff
import * as MS from './stateUpdate_v11.js';

let modes = [];
let activeModes = [];
let tempModes = [];
let dt = 0.01;
let msec = 100;
let d = [5, 5];
let maxdNorm = 0;
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


let maxReal;
let minReal;
let maxImag;
let minImag;

let topKValuesWeights = [];
let lastTime = 0;
let selectedModesList = [];
let forceFactor = 1;

let mouseNow = [0, 0];
let mousePrev = [0, 0];
let isMouseDown = false;
let mouseDownPosition = [0, 0];
let currentMousePosition = [0, 0];
let mouseStatic = false;

/*
///////////////////////////////
SIMULATION LOOP
///////////////////////////////
*/

// // constantly loop
function simulation() {

    let currentTime = window.performance.now();
    var timePassed = currentTime - lastTime;
    console.log("timePassed", timePassed);

    // mouse is down and static, apply force
    if (mouseStatic && isMouseDown) {
        applyForces(currentMousePosition); // applies force d
    } else {
        mouseStatic = true; 
    }

    updateProperties(); 

    MS.simulate13(selectedModesList, timePassed, isMouseDown);

    let coordinates = modes.map(mode => [mode.q_i.re, mode.q_i.im]);
    console.log("Coordinates:", coordinates);

    if (!checkConvergence(coordinates, 0.001)) {
        console.log("Not converged yet");
        drawSimulationState();
    } else {
        console.log("Converged");
        resetModes();
        drawSimulationState();
    }


    lastTime = currentTime;
    requestAnimationFrame(simulation);
}

// constantly loop
// function simulation() {
//     let currentTime = window.performance.now();
//     var timePassed = currentTime - lastTime;
//     console.log("timePassed");

//     updateProperties(); 
//     let point = [Math.round(mouseDownPosition[0]), Math.round(mouseDownPosition[1])];
//     if (d[0] !== 0 || d[1] !== 0) {
//     MS.directlySetQ(selectedModesList, d, point);
//     }
//     let coordinates = modes.map(mode => [mode.q_i.re, mode.q_i.im]);
//     console.log("Coordinates:", coordinates);


//     if (!checkConvergence(coordinates, 0.001)) {
//         console.log("Not converged yet");
//         drawSimulationState();
//     } else {
//         console.log("Converged");
//         drawSimulationState();
//     }


//     lastTime = currentTime;

//     requestAnimationFrame(simulation);
// }

function updateProperties() {
    const checkboxes = document.querySelectorAll('#modeCheckboxes input[type="checkbox"]:checked');
    selectedModes = Array.from(checkboxes).map(checkbox => parseInt(checkbox.value));
    selectedModesList = modes.filter((mode, i) => selectedModes.includes(i));
    console.log(selectedModesList);

    let strength = parseFloat(document.getElementById('strength').value);
    let damping = parseFloat(document.getElementById('damping').value);
    let mass = parseFloat(document.getElementById('mass').value);

    MS.setProperties(selectedModesList, strength, damping, mass, topKValuesWeights);

    // MS.setStrength(selectedModesList, strength, modes, topKValuesWeights);
    // MS.setDamping(selectedModesList, damping);
    // MS.setMass(selectedModesList, mass);

}

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

    console.log(gl.getExtension('EXT_frag_depth'));


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


    // Create quad buffers
    positionBuffer = createPositionBuffer(gl);
    texCoordBuffer = createTexCoordBuffer();


    // Load multiple modal images as textures
    const modalUrls = [];
    for (let i = 0; i < k; i++) {
        modalUrls.push(`./assets/realimag/mode${i}_normalized_realimag.png`);
    }

    const modeData = await fetchData('./assets/modes_data_json/modes_data_realimag.json');
    
    initializeModes(modeData.modeBasis, modeData.modeFrequencies, modeData.topKValuesWeights, modeData.ampPhaseRanges, modeData.ranges, modalUrls);

    console.log("Got mode data");
    console.log("Initialized modes");
    console.log("modeData.modeBasis", modeData.modeBasis.length);
    console.log('URLS', modalUrls);


    // store ranges
    maxReal = modeData.ranges[1];
    minReal = modeData.ranges[0];
    maxImag = modeData.ranges[3];
    minImag = modeData.ranges[2];

    //storetopkvaluesweights
    topKValuesWeights = modeData.topKValuesWeights;

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

        maxdNorm = Math.sqrt(image.width ** 2 + image.height ** 2);

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        deformationGl.viewport(0, 0, deformationCanvas.width, deformationCanvas.height);

        drawOriginalImage();
    });


    console.log("####### Ready to render #########");

    gl.canvas.addEventListener('mousedown', handleMouseDown);
    gl.canvas.addEventListener('mousemove', handleMouseMove);
    gl.canvas.addEventListener('mouseup', handleMouseUp);

    document.getElementById('startSimulation').addEventListener('click', startSimulation);
    lastTime = window.performance.now();
    // requestAnimationFrame(simulation);

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
        mouseDownPosition = [...mouseDownPosition];
        p = mouseDownPosition;
    }
}

// function handleMouseUp() {
//     console.log("Mouse up");
//     d = [currentMousePosition[0] - mouseDownPosition[0], currentMousePosition[1] - mouseDownPosition[1]];
//     // normalize d
//     let norm = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
//     d = [d[0] / norm, d[1] / norm];
//     handleImpulseOneByOne();
//     mouseDownPosition = [0, 0];
//     currentMousePosition = [0, 0];
//     isMouseDown = false;
// }

function handleMouseUp() {
    console.log("Mouse up");

    // last force application
    d = [currentMousePosition[0] - mouseDownPosition[0], currentMousePosition[1] - mouseDownPosition[1]];
    let d_norm = d[0] ** 2 + d[1] ** 2;
    d = [d[0] * forceFactor / d_norm, d[1] * forceFactor / d_norm];
    MS.applyInstantaneousForce(selectedModesList, d, [Math.round(mouseDownPosition[0]), Math.round(mouseDownPosition[1])]);

    // reset variables
    mouseDownPosition = [0, 0];
    currentMousePosition = [0, 0];
    p = [0, 0];
    d = [0, 0];
    isMouseDown = false;
    
    // continue animating
    requestAnimationFrame(simulation);
}

// function handleMouseMove(event) {
//     if (isMouseDown) {
//         console.log("Mouse is down, moving");
//         currentMousePosition = getMousePosition(event);
//         currentMousePosition = [...currentMousePosition]
//         console.log("New mouse current position:", currentMousePosition);
//     }
// }

function handleMouseMove(event) {
    if (isMouseDown) {
        // console.log("Mouse is down, moving");
        currentMousePosition = getMousePosition(event);
        currentMousePosition = [...currentMousePosition];

        // apply instantaneous modal force to each mode
        d = [currentMousePosition[0] - mouseDownPosition[0], currentMousePosition[1] - mouseDownPosition[1]];
        applyForces(currentMousePosition);

        mouseStatic = false;

        requestAnimationFrame(drawSimulationState);
    }
}

function applyForces(currentMousePosition) {
    // const checkboxes = document.querySelectorAll('#modeCheckboxes input[type="checkbox"]:checked');
    // selectedModes = Array.from(checkboxes).map(checkbox => parseInt(checkbox.value));
    // console.log("Selected modes:", selectedModes);


    // // read and set parameters
    // let strength = parseFloat(document.getElementById('strength').value);
    // let damping = parseFloat(document.getElementById('damping').value);
    // let mass = parseFloat(document.getElementById('mass').value);
    // MS.setDamping(modes, damping);
    // MS.setStrength(modes, strength, selectedModes);
    // MS.setMass(modes, mass);



    // let d1 = [currentMousePosition[0] - p[0], currentMousePosition[1] - p[1]];
    // let d2 = [p[0] - mouseDownPosition[0], p[1] - mouseDownPosition[1]];
    // d  = [d1[0] + d2[0], d1[1] + d2[1]];

    // d = [currentMousePosition[0] - mouseDownPosition[0], currentMousePosition[1] - mouseDownPosition[1]];
    console.log("d is", d);

    let norm = Math.sqrt(d[0] * d[0] + d[1] * d[1]);

    forceFactor = 2;
    if (norm > 1e-6) {
        d = [forceFactor*d[0]/norm , forceFactor*d[1] / norm];
    }
    
    
    p = [currentMousePosition[0], currentMousePosition[1]];
    let point = [Math.round(mouseDownPosition[0]), Math.round(mouseDownPosition[1])];

    console.log("d:", d, "p:", p, "point:", point, "currentmouseposition", currentMousePosition);
    
    // if d is NaN
    if (isNaN(d[0]) || isNaN(d[1])) {
        console.error("d is NaN");
        return;
    }

    // apply instantaneous force to each mode
    console.log("Selected modes list:", selectedModesList);
    MS.applyInstantaneousForce(selectedModesList, d, point);

}

// read p,d from html
function parseInput(input) {
    const parts = input.split(',').map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
        throw new Error('Invalid input format. Expected format: x,y');
    }
    return parts;
}

function startSimulation() {
    lastTime = window.performance.now();
    requestAnimationFrame(simulation);
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
        topKValuesWeights: data.top_k_values_weights,
        ampPhaseRanges: data.ampPhaseRanges,
        ranges: data.ranges,
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

async function loadShaderFile(url) {
    return fetch(url).then(response => response.text());
}





/*
///////////////////////////////
    MODE FUNCTIONS
///////////////////////////////
*/

// initialize mode objects
function initializeModes(modeBasis, modeFrequencies, topKValuesWeights, ampPhaseRanges, ranges, urls) {

    if (!modeBasis || !modeBasis.length) {
        console.error('modeBasis is undefined or empty');
        return;
    }
    // let ampRange = ampPhaseRanges[1] - ampPhaseRanges[0];
    // let phaseRange = ampPhaseRanges[3] - ampPhaseRanges[2];

    let realRange = ranges[1] - ranges[0];
    let imagRange = ranges[3] - ranges[2];



    for (let i = 0; i < Math.min(k,modeBasis.length); i++) {

        // // AMP PHASE: denormalize mode basis, for each row, for each pixel
        // let denormalizedBasis = modeBasis[i].map(row => row.map(pixel =>
        //     [(pixel[0] * ampRange + ampPhaseRanges[0])* Math.cos(pixel[1] * phaseRange + ampPhaseRanges[2]),
        //     (pixel[0] * ampRange + ampPhaseRanges[0])* Math.sin(pixel[1] * phaseRange + ampPhaseRanges[2]),
        //     (pixel[3] * ampRange + ampPhaseRanges[0])* Math.cos(pixel[4] * phaseRange + ampPhaseRanges[2]),
        //     (pixel[3] * ampRange + ampPhaseRanges[0])* Math.sin(pixel[4] * phaseRange + ampPhaseRanges[2])
        //     ]
        // ));
        
        // Real Imag: denormalize mode basis, for each row, for each pixel
        let denormalizedBasis = modeBasis[i].map(row => row.map(pixel =>
            [(pixel[0]/1)*realRange + ranges[0],
            (pixel[1]/1)*imagRange + ranges[2],
            (pixel[2]/1)*realRange + ranges[0],
            (pixel[3]/1)*imagRange + ranges[2]]
        ));

        // print max and min valules
        // console.log("max real part," + Math.max(...denormalizedBasis.map(row => Math.max(...row.map(pixel => pixel[0])))));
        // console.log("max real part," + Math.max(...denormalizedBasis.map(row => Math.max(...row.map(pixel => pixel[2])))));
        // console.log("min real part," + Math.min(...denormalizedBasis.map(row => Math.min(...row.map(pixel => pixel[0])))));
        // console.log("min real part," + Math.min(...denormalizedBasis.map(row => Math.min(...row.map(pixel => pixel[2])))));
 
        // console.log("max imag part," + Math.max(...denormalizedBasis.map(row => Math.max(...row.map(pixel => pixel[1])))));
        // console.log("max imag part," + Math.max(...denormalizedBasis.map(row => Math.max(...row.map(pixel => pixel[3])))));
        // console.log("min imag part," + Math.min(...denormalizedBasis.map(row => Math.min(...row.map(pixel => pixel[1])))));
        // console.log("min imag part," + Math.min(...denormalizedBasis.map(row => Math.min(...row.map(pixel => pixel[3])))));


        let basis = denormalizedBasis;
        // console.log("basis shape", getArrayShape(basis)); 
        let strength = topKValuesWeights[i] * 3;
        // console.log('strength', strength);
        let weight = topKValuesWeights[i];
        let frequency = modeFrequencies[i];
        let damping = 0.05;
        let mass = 1;
        let url = urls[i];
        modes.push(new MS.Mode(basis, strength, weight, frequency, damping, mass, url));
    }

}

function getArrayShape(arr) {
    if (!Array.isArray(arr)) {
        return [];
    }
    const shape = [arr.length].concat(getArrayShape(arr[0]));
    return shape;
}

// apply impulse from force
function applyImpulse(d, p) {
    for (let i = 0; i < Math.min(k, modes.length); i++) {
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

//reset coordinates and impulses
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

function drawSimulationState() {
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    console.log("Drawing simulation state!");

    // clear the canvas
    // gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // get states
    // let coordinates = modes.map(mode => [mode.y[0][0], mode.y[1][0]]);
    let coordinates = modes.map(mode => [mode.q_i.re, mode.q_i.im]);
    modalCoordinatesList.push(coordinates);

    // render
    startRendering(gl.canvas.width, gl.canvas.height);
    modalCoordinatesList.shift();
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

function drawFinalRender() {
    console.log("Drawing final render");

    // Switch back to default framebuffer

    // setFramebuffer(null, gl.canvas.width, gl.canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Clear the canvas
    console.log("Clearing canvas");
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

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

    // Bind displacement texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
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

        // let coordinates = modes.map(mode => [mode.y[0][0], mode.y[1][0]]);
        modalCoordinatesList.push(coordinates);



        // RENDER SINGLE FRAME
        startRendering(gl.canvas.width, gl.canvas.height);
        modalCoordinatesList.shift();


        if (checkConvergence(coordinates, threshold)) {
            console.log("Convergence reached, rendering originaTexture with textocanvas");
            // clear deformationtexture and map
            deformationGl.clearColor(0.0, 0.0, 0.0, 1.0);
            deformationGl.clear(deformationGl.COLOR_BUFFER_BIT | deformationGl.DEPTH_BUFFER_BIT);
            drawOriginalImage();

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
    copyTexture(gl, displacementTexture, deformationGl, deformationTexture);

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

// function multiPassRendering() {
//     let readFramebuffer = framebuffers[0];
//     let writeFramebuffer = framebuffers[1];

//     // Initial pass setup
//     gl.useProgram(accumulationProgram);
//     gl.disable(gl.DEPTH_TEST)
//     gl.clearColor(1, 1, 1, 1);
//     gl.clear(gl.COLOR_BUFFER_BIT);


//     // create loop for each selected mode in selectedModes

//     selectedModes.forEach(modeIndex => {
//         let i = modeIndex;
//         let temp = readFramebuffer;
//         readFramebuffer = writeFramebuffer;
//         writeFramebuffer = temp;

//         // Bind the previously written texture and the next modal texture
//         gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
//         // gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
//         setFramebuffer(writeFramebuffer, gl.canvas.width, gl.canvas.height);

//         gl.activeTexture(gl.TEXTURE0);
//         // gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
//         gl.bindTexture(gl.TEXTURE_2D, readFramebuffer.texture);
//         gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"), 0);

//         gl.activeTexture(gl.TEXTURE1);
//         gl.bindTexture(gl.TEXTURE_2D, modalTextures[i]);
//         gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 1);

//         console.log("modalcoordinateslist," + modalCoordinatesList);
//         gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateX"), modalCoordinatesList[currentFrameIndex][i][0]);
//         gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateY"), modalCoordinatesList[currentFrameIndex][i][1]);
//         gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1.0 / (selectedModes.length));

//         drawQuad(accumulationProgram);
//     });

//     // // if no selected modes, just render the original image
//     // if (selectedModes.length == 0) {
//     //     let i = 0;
//     //     let temp = readFramebuffer;
//     //     readFramebuffer = writeFramebuffer;
//     //     writeFramebuffer = temp;
//     //     console.log("No selected modes, rendering original image");

//     //     // Bind the previously written texture and the next modal texture
//     //     gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
//     //     setFramebuffer(writeFramebuffer, gl.canvas.width, gl.canvas.height);

//     //     gl.activeTexture(gl.TEXTURE0);
//     //     // gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
//     //     gl.bindTexture(gl.TEXTURE_2D, originalTexture);
//     //     gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"), 0);

//     //     gl.activeTexture(gl.TEXTURE1);
//     //     gl.bindTexture(gl.TEXTURE_2D, originalTexture);
//     //     gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 1);

//     //     gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateX"), 0.5);
//     //     gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateY"), 0.5);
//     //     gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1.0);

//     //     drawQuad(accumulationProgram);
//     // }

//     // // Loop through remaining modal textures
//     // for (let i = 0; i < modalTextures.length; ++i) {
//     //     // Swap framebuffers
//     //     // if mode is selected
//     //     if (selectedModes.includes(i)) {
//     //         let temp = readFramebuffer;
//     //         readFramebuffer = writeFramebuffer;
//     //         writeFramebuffer = temp;

//     //         // Bind the previously written texture and the next modal texture
//     //         // gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
//     //         gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
//     //         setFramebuffer(writeFramebuffer, gl.canvas.width, gl.canvas.height);

//     //         gl.activeTexture(gl.TEXTURE0);
//     //         gl.bindTexture(gl.TEXTURE_2D, textures[(i - 1) % 2]);
//     //         // gl.bindTexture(gl.TEXTURE_2D, readFramebuffer.texture);
//     //         gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"), 0);

//     //         gl.activeTexture(gl.TEXTURE1);
//     //         gl.bindTexture(gl.TEXTURE_2D, modalTextures[i]);
//     //         gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 1);

//     //         console.log("modalcoordinateslist," + modalCoordinatesList);
//     //         gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateX"), modalCoordinatesList[currentFrameIndex][i][0]);
//     //         gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateY"), modalCoordinatesList[currentFrameIndex][i][1]);
//     //         gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), 1.0 / k);

//     //         drawQuad(accumulationProgram);
//     //     } else {
//     //         console.log("Skipping mode", i);
//     //     }


//     // }
//     renderDeformationMap();

//     // Final rendering pass
//     setFramebuffer(null, gl.canvas.width, gl.canvas.height);

//     gl.enable(gl.DEPTH_TEST);
//     gl.depthFunc(gl.LEQUAL);


//     gl.clearColor(1, 1, 1, 1);
//     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

//     console.log("doing final pass");
//     drawFinalRender();
// }

function multiPassRendering() {
    let readIndex = 0;
    let writeIndex = 1;

    // Clear both framebuffers to black
    for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[i]);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    if (selectedModes.length === 0) {
        // If no modes are selected, set displacementTexture to the cleared (black) texture
        displacementTexture = textures[writeIndex];
    } else {
        let selectedWeights = selectedModes.map(modeIndex =>topKValuesWeights[modeIndex]);
        let sumWeights = selectedWeights.reduce((a, b) => a + b, 0);
        let normalizedSelectedWeights = selectedWeights.map(weight => weight / sumWeights);

        gl.useProgram(accumulationProgram);
        gl.disable(gl.DEPTH_TEST);

        selectedModes.forEach((modeIndex, passIndex) => {
            // Swap indices
            [readIndex, writeIndex] = [writeIndex, readIndex];

            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[writeIndex]);

            // Bind the previously accumulated texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[readIndex]);
            gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"), 0);

            // Bind the current modal texture
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, modalTextures[modeIndex]);
            gl.uniform1i(gl.getUniformLocation(accumulationProgram, "uModalTexture"), 1);

            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateX"), modalCoordinatesList[currentFrameIndex][modeIndex][0]);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uModalCoordinateY"), modalCoordinatesList[currentFrameIndex][modeIndex][1]);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uFraction"), normalizedSelectedWeights[passIndex]);

            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uMaxReal"), maxReal);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uMaxImag"), maxImag);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uMinReal"), minReal);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uMinImag"), minImag);

            drawQuad(accumulationProgram);
        });

        // The final accumulated result is now in textures[writeIndex]
        displacementTexture = textures[writeIndex];
    }

    renderDeformationMap();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    
    
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    console.log("Final pass!");
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


