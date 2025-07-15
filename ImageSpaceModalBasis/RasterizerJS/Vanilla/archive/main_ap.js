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
let widthDivisions;
let heightDivisions;
let originalImage;
let positionBuffer;
let texCoordBuffer;
let indexBuffer;
let texDims = [];
let textures = [];
let modalTextures = [];
let framebuffers = [];
let k = 9;
let selectedModes = [];
let widthImage;
let heightImage;

// import { re } from 'mathjs';
// State Update Stuff
import * as MS from './stateUpdate_v11.js';

let modes = [];
let activeModes = [];
let tempModes = [];
let dt = 0.01;
let msec = 100;
let d = [5, 5];
let maxdNorm = 100;
let p = [0, 0];
let numFrames = 100;
let currentFrameIndex = 0;
let currentTime = 0;
let modalCoordinatesList = [];
let modalPhasesList = [];
let modalAmplitudesList = [];


// Deforamtion Map Visualization
let deformationCanvas;
let deformationGl;
let deformationProgram;
let deformationTexture;

let maxReal;
let minReal;
let maxImag;
let minImag;

let maxAmp;
let minAmp;
let maxPhase;
let minPhase;


let topKValuesWeights = [];
let lastTime = 0;
let selectedModesList = [];
let allModesList = [];
let forceFactor = 1;

let speed = 1;
let mouseNow = [0, 0];
let mousePrev = [0, 0];
let isMouseDown = false;
let mouseDownPosition = [0, 0];
let currentMousePosition = [0, 0];
let mouseStatic = false;
let globalStrength = 1;

/*
///////////////////////////////
SIMULATION LOOP
///////////////////////////////
*/

// // constantly loop
function simulation() {

    let currentTime = window.performance.now();
    var timePassed = (currentTime - lastTime) //* speed ;
    console.log("speed", speed);
    console.log("timePassed", timePassed);

    // mouse is down and static, apply force
    if (mouseStatic && isMouseDown) {
        applyForces(currentMousePosition); // applies force for 
    } else if(isMouseDown) { 
        mouseStatic = true; 
    }

    updateProperties(); 
   
    if (selectedModesList.length  > 0) {
        console.log("%%%%%%%%%%%%%% SELECTED MODES %%%%%%%%%%%%%%%", selectedModesList);
        MS.simulate13(selectedModesList, timePassed, isMouseDown, speed);
        console.log("After simulation, q_i values:", selectedModesList.map(mode => mode.q_i));
    }
    



    let coordinates = modes.map(mode => [mode.q_mag]);
    console.log("Coordinates:", coordinates);

    if (!checkConvergence(coordinates, 0.000001)) {
        console.log("Not converged yet");
        drawSimulationState();
    } else{
        console.log("Converged");
        if (isMouseDown) {
            // resetModes();
        }
        drawSimulationState();
      
    }

    lastTime = currentTime;
    requestAnimationFrame(simulation);
}

function updateModeValues(modeIndex, amp, phase, y) {
    console.log("##########################################################################mode", modeIndex, amp, phase, y);
    document.getElementById(`q_iAmplitude${modeIndex}`).textContent = ` ${amp.toFixed(6)}`;
    // document.getElementById(`q_iPhase${modeIndex}`).textContent = ` ${(phase * 360).toFixed(6)}°`;
    document.getElementById(`q_iPhase${modeIndex}`).textContent = ` ${(phase).toFixed(6)}°`;
    
    document.getElementById(`yValue${modeIndex}`).textContent = ` ${y.re.toFixed(6)} + ${y.im.toFixed(6)}i`;
}

function updateGlobalValues(h, dt) {
    document.getElementById('hValue').textContent = h.toFixed(6);
    document.getElementById('dtValue').textContent = dt.toFixed(6);
}

function updateProperties() {
    // const checkboxes = document.querySelectorAll('#modeCheckboxes input[type="checkbox"]:checked');
    // selectedModes = Array.from(checkboxes).map(checkbox => parseInt(checkbox.value));
    // selectedModesList = modes.filter((mode, i) => selectedModes.includes(i));

    // globalStrength = parseFloat(document.getElementById('strength').value);
    // let damping = parseFloat(document.getElementById('damping').value);
    // console.log("damping", damping);
    // let mass = parseFloat(document.getElementById('mass').value);
    // speed = parseFloat(document.getElementById('speed').value);

    // MS.setProperties(selectedModesList, globalStrength, damping, mass, topKValuesWeights);

    let old_strengths = selectedModesList.map(mode => mode.strength);

    const checkboxes = document.querySelectorAll('#modeCheckboxes input[type="checkbox"]:checked');
    selectedModes = Array.from(checkboxes).map(checkbox => parseInt(checkbox.value));
    selectedModesList = modes.filter((mode, i) => selectedModes.includes(i));
   
    console.log("selectedModesList$$$$$$$$$$$$$$$$$$$$", selectedModesList);

    let new_strengths = [];
    let dampings = [];
    
    selectedModes.forEach(modeIndex => {
        let strength = parseFloat(document.getElementById(`strength${modeIndex}`).value);
        let damping = parseFloat(document.getElementById(`damping${modeIndex}`).value);
        new_strengths.push(strength);
        dampings.push(damping);
    });

    // // for non-selected modes, reset
    // modes.forEach((mode, i) => {
    //     if (!selectedModesList.includes(i)) {
    //         resetSingleMode(i);
    //     }
    // });
    
    let mass = parseFloat(document.getElementById('mass').value);
    speed = parseFloat(document.getElementById('speed').value);
    // console.log("old strengths", old_strengths, "new strengths", new_strengths);
    
    MS.setProperties(selectedModesList, new_strengths, dampings, mass, topKValuesWeights);

}

/* 
///////////////////////////////
INIT FUNCTION
///////////////////////////////
*/

let vao;

async function init() {
    const canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl2');
    console.log('Canvas size:', gl.canvas.width, gl.canvas.height)
    texDims = [gl.canvas.width, gl.canvas.height];

    let ext = gl.getExtension('EXT_color_buffer_float');
if (!ext) {
  console.error('EXT_color_buffer_float extension is not supported');
  // Handle the lack of support (fallback to a different format or inform the user)
}
    
    gl.getExtension('OES_texture_float');
    
    if (!gl) {
        console.error('Unable to initialize WebGL 2. Your browser may not support it.');
        return;
    }

    // Load shaders from Files
    const accumulationVertSource = await loadShaderFile('./shaders/accum-vert-ap.vert');
    const accumulationFragSource = await loadShaderFile('./shaders/accum-frag-ap.frag');
    const finalRenderVertSource = await loadShaderFile('./shaders/final-render-vertex-2.vert');
    const finalRenderFragSource = await loadShaderFile('./shaders/final-render-fragment-2.frag');
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


      // Initialize original texture
    originalTexture = createAndSetupTexture(gl);
    //  originalImage = loadImage('./assets/wireman/aug14/first_frame.png', function (image) {
    originalImage = loadImage('./assets/original_images/first_frame.png', function (image) {
    // originalImage = loadImage('./assets/rod_thin/rod_thin.png', function (image) {
    // originalImage = loadImage('./assets/beam_data/first_frame.png', function (image) {
        bindTextureWithImage(originalTexture, image);

        widthImage = image.width;
        heightImage = image.height;

        canvas.width = image.width;
        canvas.height = image.height;
        deformationCanvas.width = image.width;
        deformationCanvas.height = image.height;

        // maxdNorm = Math.sqrt(image.width ** 2 + image.height ** 2);

    
        setupPingPongFramebuffers(widthImage, heightImage);

    });

    // Initialize (empty) displacement texture
    displacementTexture = createAndSetupTexture(gl);


    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Create quad buffers
    // positionBuffer = createPositionBuffer(gl);
    // texCoordBuffer = createTexCoordBuffer();

    // Set up attribute pointers
    setupAttributes();

    // Unbind VAO
    gl.bindVertexArray(null);
        
    

    // const modeData = await fetchData('./assets/modes_data_json/modes_data_realimag.json');
    // const modeData = await fetchData('./assets/modes_data_json/modes_data_normal.json');
    // const modeData = await fetchData('./assets/filtering/modes_data_normal_filter.json');
    // const modeData = await fetchData('./assets/beam_aug29/modes_data_single_beam.json');
    // const modeData = await fetchData('./assets/cantelever/modes_data_single_beam.json')
    // const modeData = await fetchData('./assets/modes_data/modes_data_single.json');

    const modeData = await fetchData('./assets/wireman/wireman_ap/modes_data_ap.json');
    // const modeData = await fetchData('./assets/rod_thin/modes_data.json');
    // const modeData = await fetchData('./assets/wireman/sep18_modes/modes_data_single.json')
    // const modeData = await fetchData('./assets/wireman/sep18_modes_60/modes_data_single.json')


    // const modeData = await fetchData('./assets/aug_31/modes_data_aug31_60fps_new.json');
    // const modeData = await fetch('./assets/aug30_60_wireman/modes_data_aug30_60fps_new.json')
    //         .then(response => response.json())
    //         .then(data => console.log(data))
    //         .catch(error => console.error('Error:', error));
    
    k = Math.min(modeData.modeBasis.length,10);
 // Load multiple modal images as textures
    const modalUrls = [];
    for (let i = 0; i < k; i++) {
        // modalUrls.push(`./assets/realimag/mode${i}_normalized_realimag.png`);
        // modalUrls.push(`./assets/modes/aug6/mode${i}_normalized.png`);
        // modalUrls.push(`./assets/filtering/mode${i}_normalized_new.png`);
        // modalUrls.push(`./assets/beam/mode${i}_normalized.png`);
        // modalUrls.push(`./assets/modes_data/mode${i}_RGBA.png`);
        // modalUrls.push(`./assets/cantelever/mode${i}_RGBA.png`);
        // modalUrls.push(`./assets/aug_31/mode${i}_aug31_60fps_new.png`);
        // modalUrls.push(`./assets/wireman/wireman_modes_aug30/mode${i}_aug30_wireman.png`);
        modalUrls.push(`./assets/wireman/wireman_ap/mode${i}_RGBA_ap.png`);
        // modalUrls.push(`./assets/rod_thin/mode_${i+1}_displacement.png`);
        // modalUrls.push(`./assets/wireman/sep18_modes/mode${i}_RGBA.png`);
        // modalUrls.push(`./assets/wireman/sep18_modes_60/mode${i}_RGBA.png`);
    }
    console.log('URLS', modalUrls); 

    initializeModes(modeData.modeBasis, modeData.modeFrequencies, modeData.topKValuesWeights, modeData.ampPhaseRanges, modeData.ranges, modalUrls);

    console.log("Got mode data");
    console.log("Initialized modes");
    console.log("modeData.modeBasis", modeData.modeBasis.length);
    
 

    // store ranges
    maxReal = modeData.ranges[1];
    minReal = modeData.ranges[0];
    maxImag = modeData.ranges[3];
    minImag = modeData.ranges[2];

    maxAmp = modeData.ampPhaseRanges[1];
    minAmp = modeData.ampPhaseRanges[0];
    maxPhase = modeData.ampPhaseRanges[3];
    minPhase = modeData.ampPhaseRanges[2];

    console.log("max,min amp and phase", maxAmp, minAmp, maxPhase, minPhase);



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

    drawOriginalImage();

    console.log("####### Ready to render #########");

    gl.canvas.addEventListener('mousedown', handleMouseDown);
    gl.canvas.addEventListener('mousemove', handleMouseMove);
    gl.canvas.addEventListener('mouseup', handleMouseUp);

    document.getElementById('startSimulation').addEventListener('click', startSimulation);
    document.getElementById('restartSimulation').addEventListener('click', restartSimulation);
    lastTime = window.performance.now();

}



function setupAttributes() { 

    // Set up position attribute
    // widthDivisions = 403;
    // heightDivisions = 720;
    widthDivisions = 1000;
    heightDivisions = 1000;
    let sumDivision = widthDivisions + heightDivisions;
    widthDivisions = Math.floor(200 * widthDivisions / sumDivision);
    heightDivisions = Math.floor(200 * heightDivisions / sumDivision);
    console.log("widthDivisions", widthDivisions, "heightDivisions", heightDivisions);

    let buffers = createPositionAndTextureBuffers(gl,widthDivisions, heightDivisions);
    positionBuffer = buffers.positionBuffer; 
    texCoordBuffer = buffers.texCoordBuffer; 
    indexBuffer = buffers.indexBuffer;

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(accumulationProgram, 'aPosition'));
    gl.vertexAttribPointer(gl.getAttribLocation(accumulationProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(finalRenderProgram, 'aPosition'));
    gl.vertexAttribPointer(gl.getAttribLocation(finalRenderProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

    // Set up texture coordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(accumulationProgram, 'aTexCoord'));
    gl.vertexAttribPointer(gl.getAttribLocation(accumulationProgram, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);


    // setup for original image
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(textocanvasProgram, 'aPosition'));
    gl.vertexAttribPointer(gl.getAttribLocation(textocanvasProgram, 'aPosition'), 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(gl.getAttribLocation(textocanvasProgram, 'aTexCoord'));
    gl.vertexAttribPointer(gl.getAttribLocation(textocanvasProgram, 'aTexCoord'), 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

}


function createPositionAndTextureBuffers(gl, width, height) {

    const positions = [];
    const texCoords = [];
    const indices = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = (x / width) * 2 - 1;
        const x2 = ((x + 1) / width) * 2 - 1;
        const y1 = (y / height) * 2 - 1;
        const y2 = ((y + 1) / height) * 2 - 1;
  
        // Add the positions for the quad
        positions.push(
          x1, y1,
          x2, y1,
          x1, y2,
          x2, y2
        );
  
        // Add the texture coordinates for the quad
        texCoords.push(
          x / width, y / height,
          (x + 1) / width, y / height,
          x / width, (y + 1) / height,
          (x + 1) / width, (y + 1) / height
        );
  
        const baseIndex = (y * width + x) * 4;
        indices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,
          baseIndex + 2, baseIndex + 1, baseIndex + 3
        );
      }
    }
    console.log('length positions', positions.length, "length indices", indices.length);
    console.log("positions", positions);
  
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
  
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  
    return {
      positionBuffer,
      texCoordBuffer,
      indexBuffer
    };
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



function handleMouseUp() {
    console.log("Mouse up");

    // last force application
    d = [currentMousePosition[0] - mouseDownPosition[0], currentMousePosition[1] - mouseDownPosition[1]];
    // let d_norm = d[0] ** 2 + d[1] ** 2;
    // forceFactor = globalStrength;
    // forceFactor = globalStrength * Math.sqrt(d_norm)/Math.sqrt(maxdNorm);
    // forceFactor = globalStrength * Math.sqrt(d_norm)/Math.sqrt(maxdNorm);
    // d = [d[0] * forceFactor / d_norm, d[1] * forceFactor / d_norm];
    // d = [0, 0];
    let point = [Math.round(mouseDownPosition[0]), Math.round(mouseDownPosition[1])];

    console.log("d before normalization", d);
    let screenV = [gl.canvas.width, gl.canvas.height];
    let screenVNorm = math.divide(screenV, math.norm(screenV));
   
    let forceV = [d[0] * screenVNorm[0], d[1] * screenVNorm[1]];
    let dNorm = [0, 0];

    if (forceV[0] === 0 && forceV[1] === 0) {
    } else {
        dNorm = math.divide(forceV, math.norm(forceV));
    }

   

    MS.applyInstantaneousForce(selectedModesList, [0,0],[0,0], window.performance.now()-lastTime);

    // reset variables
    mouseDownPosition = [0, 0];
    currentMousePosition = [0, 0];
    p = [0, 0];
    d = [0, 0];
    isMouseDown = false;
    
    // continue animating
    requestAnimationFrame(simulation);
}




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

    // let norm = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
    // sqrt for force factor
    // forceFactor = globalStrength * Math.sqrt(norm)/Math.sqrt(maxdNorm);
    // forceFactor = globalStrength;
    
    // if (norm > 1e-6) {
    //     d = [forceFactor * d[0] / norm, forceFactor * d[1] / norm];
    //     // d = [d[0] / gl.canvas.width, d[1] / gl.canvas.height];
    //     // d = [forceFactor * d[0], forceFactor * d[1]];
    // } else {
    //     console.log("norm is 0");
    // }
   

    p = [currentMousePosition[0], currentMousePosition[1]];
    let point = [Math.round(mouseDownPosition[0]), Math.round(mouseDownPosition[1])];

    if (isNaN(d[0]) || isNaN(d[1])) {
        console.error("d is NaN");
        return;
    }

    // noramlize d
    console.log("d before normalization", d);
    let screenV = [gl.canvas.width, gl.canvas.height];
    let screenVNorm = math.divide(screenV, math.norm(screenV));
   
    let forceV = [d[0] * screenVNorm[0], d[1] * screenVNorm[1]];
    let dNorm = [0, 0];

    if (forceV[0] === 0 && forceV[1] === 0) {
    } else {
        dNorm = math.divide(forceV, math.norm(forceV));
    }


    // apply instantaneous force to each mode
    MS.applyInstantaneousForce(selectedModesList, dNorm, point, window.performance.now()-lastTime); 
}



function startSimulation() {
    lastTime = window.performance.now();
    requestAnimationFrame(simulation);
}

function restartSimulation() {
    resetModes();
    startSimulation();
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

    // let realRange = ranges[1] - ranges[0];
    // let imagRange = ranges[3] - ranges[2];
    let magRange = ampPhaseRanges[1] - ampPhaseRanges[0];
    let phaseRange = ampPhaseRanges[3] - ampPhaseRanges[2];

    console.log("max and min phase and amp", ampPhaseRanges);


    let l = Math.min(k, modeBasis.length);
    // create list from 0 to l

    for (let i = 0; i < l; i++) {

        // Real Imag: denormalize mode basis, for each row, for each pixel
        // let denormalizedBasis = modeBasis[i].map(row => row.map(pixel =>
        //     [(pixel[0]/1)*realRange + ranges[0],
        //     (pixel[1]/1)*imagRange + ranges[2],
        //     (pixel[2]/1)*realRange + ranges[0],
        //     (pixel[3]/1)*imagRange + ranges[2]]
        // ));

        // Magnitude Phase: denormalize mode basis, for each row, for each pixel
        // let denormalizedBasis = modeBasis[i].map(row => row.map(pixel =>
        //     [(pixel[0] / 1) * magRange + ampPhaseRanges[0],
        //     (pixel[1] / 1) * phaseRange + ampPhaseRanges[2],
        //     (pixel[2] / 1) * magRange + ampPhaseRanges[0],
        //     (pixel[3] / 1) * phaseRange + ampPhaseRanges[2]]
        // ));

        // let maxAmp = -Infinity;
        // let minAmp = Infinity;
        // let maxPhase = -Infinity;
        // let minPhase = Infinity;

        // let maxAmpNonDenorm = -Infinity;
        // let minAmpNonDenorm = Infinity;
        // let maxPhaseNonDenorm = -Infinity;
        // let minPhaseNonDenorm = Infinity;
        
        // let denormalizedBasis = modeBasis[i].map(row => row.map(pixel => {
        //     let amp1NonDenorm = pixel[0];  // R channel
        //     let phase1NonDenorm = pixel[1];  // G channel
        //     let amp2NonDenorm = pixel[2];  // B channel
        //     let phase2NonDenorm = pixel[3];  // A channel
        
        //     // Update max/min values for non-denormalized values
        //     maxAmpNonDenorm = Math.max(maxAmpNonDenorm, amp1NonDenorm, amp2NonDenorm);
        //     minAmpNonDenorm = Math.min(minAmpNonDenorm, amp1NonDenorm, amp2NonDenorm);
        //     maxPhaseNonDenorm = Math.max(maxPhaseNonDenorm, phase1NonDenorm, phase2NonDenorm);
        //     minPhaseNonDenorm = Math.min(minPhaseNonDenorm, phase1NonDenorm, phase2NonDenorm);

        //     let amp1 = (pixel[0] / 1) * magRange + ampPhaseRanges[0];  // R channel - Amplitude
        //     let phase1 = (pixel[1] / 1) * phaseRange + ampPhaseRanges[2];  // G channel - Phase
        //     let amp2 = (pixel[2] / 1) * magRange + ampPhaseRanges[0];  // B channel - Amplitude
        //     let phase2 = (pixel[3] / 1) * phaseRange + ampPhaseRanges[2];  // A channel - Phase

        //     // Update max/min values for amplitudes
        //     maxAmp = Math.max(maxAmp, amp1, amp2);
        //     minAmp = Math.min(minAmp, amp1, amp2);

        //     // Update max/min values for phases
        //     maxPhase = Math.max(maxPhase, phase1, phase2);
        //     minPhase = Math.min(minPhase, phase1, phase2);

        //     // console.log("amp1", amp1, "phase1", phase1, "amp2", amp2, "phase2", phase2);

        //     return [amp1, phase1, amp2, phase2];
        // }));

        // Output the max/min values
        // console.log('Max Amplitude:', maxAmp);
        // console.log('Min Amplitude:', minAmp);
        // console.log('Max Phase:', maxPhase);
        // console.log('Min Phase:', minPhase);

        // console.log('Max Amplitude Non-Denorm:', maxAmpNonDenorm);
        // console.log('Min Amplitude Non-Denorm:', minAmpNonDenorm);
        // console.log('Max Phase Non-Denorm:', maxPhaseNonDenorm);
        // console.log('Min Phase Non-Denorm:', minPhaseNonDenorm);

        



       
        let basis = modeBasis[i];
        // console.log("basis shape", getArrayShape(basis)); 
        let strength = topKValuesWeights[i];
        // strength = 1/Math.min(k, modeBasis.length);
        // console.log('strength', strength);
        // let weight = topKValuesWeights[i];
        let frequency = modeFrequencies[i];
        let weight = 1/(Math.min(k, modeBasis.length));
        let damping = 0.01;
        let mass = 1;
        let url = urls[i];
        let modeIndex = i;
        modes.push(new MS.Mode(modeIndex, basis, strength, weight, frequency, damping, mass, url));

        console.log("Initialized mode", i, modes[i].index);
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
    let sumCoord = coordinates.reduce((acc, coord) => acc + coord, 0);
    return sumCoord < threshold; 
}

//reset coordinates and impulses
function resetModes() {
    modes.forEach(mode => {
        // mode.y = [[0.0], [0.0]];
        // mode.q_i = { re: 0.0, im: 0.0 };
        mode.y = math.complex(0.0, 0.0);
        mode.q_i = math.complex(0.0, 0.0);
        mode.last_impulse = 0;
        mode.last_impulse_time = 0;
        mode.damping = 0.01;
    });
}

function resetSingleMode(modeIndex) {
    modes[modeIndex].y = math.complex(0.0, 0.0);
    modes[modeIndex].q_i = math.complex(0.0, 0.0);
    modes[modeIndex].last_impulse = 0;
    modes[modeIndex].last_impulse_time = 0;
    modes[modeIndex].damping = 0.01;
}


/* 
///////////////////////////////
Drawing Functions
///////////////////////////////
*/

function drawSimulationState() {
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    console.log("Drawing simulation state!");


    // get states
    // let coordinates = modes.map(mode => [mode.y[0][0], mode.y[1][0]]);
    let coordinates = modes.map(mode => [mode.q_i.re, mode.q_i.im]);
    modalCoordinatesList.push(coordinates);

    let phases = modes.map(mode => mode.q_phase);
    modalPhasesList.push(phases);

    let amplitudes = modes.map(mode => mode.q_amp);
    modalAmplitudesList.push(amplitudes);


    // render
    startRendering(gl.canvas.width, gl.canvas.height);
    modalCoordinatesList.shift();
    modalPhasesList.shift();
    modalAmplitudesList.shift();
}


function drawFinalRender() {
    console.log("Drawing final render");

    // setFramebuffer(null, gl.canvas.width, gl.canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Clear the canvas
    console.log("Clearing canvas");
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the final render program
    gl.useProgram(finalRenderProgram);

    gl.bindVertexArray(vao);

    // Bind displacement texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
    gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uAccumulatedDisplacement"), 0);

    // Bind original texture

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);
    gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uOriginalTexture"), 1);

    // Set texture dimensions
    const uTexDimWidthLocation = gl.getUniformLocation(finalRenderProgram, "texDimWidth");
    const uTexDimHeightLocation = gl.getUniformLocation(finalRenderProgram, "texDimHeight");
    gl.uniform1f(uTexDimWidthLocation, gl.canvas.width);
    gl.uniform1f(uTexDimHeightLocation, gl.canvas.height);
    // console.log("Texture dimensions set", gl.canvas.width, gl.canvas.height);

    // Use indexed array
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElements(gl.TRIANGLES, 6*widthDivisions*heightDivisions, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);

    console.log("Final render complete");

}

// function drawFinalRender() {
//     console.log("Drawing final render");

//     // Set up the final render (existing logic)
//     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
//     gl.clearColor(0.0, 0.0, 0.0, 0.0);
//     gl.enable(gl.DEPTH_TEST);
//     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//     gl.useProgram(finalRenderProgram);
//     gl.bindVertexArray(vao);

//     // Bind displacement texture
//     gl.activeTexture(gl.TEXTURE0);
//     gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
//     gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uAccumulatedDisplacement"), 0);

//     // Bind original texture
//     gl.activeTexture(gl.TEXTURE1);
//     gl.bindTexture(gl.TEXTURE_2D, originalTexture);
//     gl.uniform1i(gl.getUniformLocation(finalRenderProgram, "uOriginalTexture"), 1);

//     // Set texture dimensions
//     const uTexDimWidthLocation = gl.getUniformLocation(finalRenderProgram, "texDimWidth");
//     const uTexDimHeightLocation = gl.getUniformLocation(finalRenderProgram, "texDimHeight");
//     gl.uniform1f(uTexDimWidthLocation, gl.canvas.width);
//     gl.uniform1f(uTexDimHeightLocation, gl.canvas.height);

//     // Draw the final scene
//     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
//     gl.drawElements(gl.TRIANGLES, 6 * widthDivisions * heightDivisions, gl.UNSIGNED_SHORT, 0);
//     gl.bindVertexArray(null);

//     console.log("Final render complete");

//     // Render the deformation map onto the deformation canvas
//     renderDeformationMap();
// }

function drawOriginalImage() {
    setFramebuffer(null, gl.canvas.width, gl.canvas.height);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(textocanvasProgram);

    gl.bindVertexArray(vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);

    gl.uniform1i(gl.getUniformLocation(textocanvasProgram, "uOriginalTexture"), 0);

    console.log("Original texture bound:", gl.isTexture(originalTexture));

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElements(gl.TRIANGLES, 6*widthDivisions*heightDivisions, gl.UNSIGNED_SHORT, 0);
    // gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
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

    // Set up the deformation canvas and GL context
    deformationGl.bindFramebuffer(deformationGl.FRAMEBUFFER, null);
    deformationGl.viewport(0, 0, deformationCanvas.width, deformationCanvas.height);
    deformationGl.clearColor(0.0, 0.0, 0.0, 1.0);
    deformationGl.clear(deformationGl.COLOR_BUFFER_BIT);

    // Use the deformation program
    deformationGl.useProgram(deformationProgram);

    // Set up attribute for position
    const aPositionLocation = deformationGl.getAttribLocation(deformationProgram, 'aPosition');
    const positionBuffer = createPositionBuffer(deformationGl);
    deformationGl.bindBuffer(deformationGl.ARRAY_BUFFER, positionBuffer);
    deformationGl.enableVertexAttribArray(aPositionLocation);
    deformationGl.vertexAttribPointer(aPositionLocation, 2, deformationGl.FLOAT, false, 0, 0);

    // Bind the copied displacement texture
    deformationGl.activeTexture(deformationGl.TEXTURE0);
    deformationGl.bindTexture(deformationGl.TEXTURE_2D, deformationTexture);
    deformationGl.uniform1i(deformationGl.getUniformLocation(deformationProgram, "uAccumulatedDisplacement"), 0);

    // Set uniforms for color mapping
    // deformationGl.uniform1f(deformationGl.getUniformLocation(deformationProgram, "uMaxReal"), maxReal);
    // deformationGl.uniform1f(deformationGl.getUniformLocation(deformationProgram, "uMaxImag"), maxImag);
    // deformationGl.uniform1f(deformationGl.getUniformLocation(deformationProgram, "uMinReal"), minReal);
    // deformationGl.uniform1f(deformationGl.getUniformLocation(deformationProgram, "uMinImag"), minImag);

    deformationGl.uniform1f(deformationGl.getUniformLocation(deformationProgram, "uMaxAmp"), maxAmp);
    deformationGl.uniform1f(deformationGl.getUniformLocation(deformationProgram, "uMaxPhase"), maxPhase);
    deformationGl.uniform1f(deformationGl.getUniformLocation(deformationProgram, "uMinAmp"), minAmp);
    deformationGl.uniform1f(deformationGl.getUniformLocation(deformationProgram, "uMinPhase"), minPhase);

    // Draw the quad
    deformationGl.drawArrays(deformationGl.TRIANGLE_STRIP, 0, 4);
}

// function renderDeformationMap() {
//     // Create the deformation texture if it doesn't exist
//     if (!deformationTexture) {
//         deformationTexture = createAndSetupTexture(deformationGl);
//     }

//     // Copy the accumulated displacement texture to the deformation context
//     copyTexture(gl, displacementTexture, deformationGl, deformationTexture);

//     deformationGl.bindFramebuffer(deformationGl.FRAMEBUFFER, null);
//     deformationGl.viewport(0, 0, deformationCanvas.width, deformationCanvas.height);

//     deformationGl.useProgram(deformationProgram);

//     // Bind the copied displacement texture
//     deformationGl.activeTexture(deformationGl.TEXTURE0);
//     deformationGl.bindTexture(deformationGl.TEXTURE_2D, deformationTexture);
//     deformationGl.uniform1i(deformationGl.getUniformLocation(deformationProgram, "uAccumulatedDisplacement"), 0);

//     // Set up attribute for position
//     const aPositionLocation = deformationGl.getAttribLocation(deformationProgram, 'aPosition');
//     deformationGl.bindBuffer(deformationGl.ARRAY_BUFFER, createPositionBuffer(deformationGl));
//     deformationGl.enableVertexAttribArray(aPositionLocation);
//     deformationGl.vertexAttribPointer(aPositionLocation, 2, deformationGl.FLOAT, false, 0, 0);

//     // Draw the quad
//     deformationGl.drawArrays(deformationGl.TRIANGLE_STRIP, 0, 4);
//     // drawDivisions();

// }

function startRendering(width, height) {
    gl.enable(gl.DEPTH_TEST);

    // Set canvas size to match original image
    const canvas = document.getElementById('glCanvas');
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Setup framebuffers (ping-pong) and start multi-pass rendering
    multiPassRendering();
}

// function setupPingPongFramebuffers(width, height) {
//     for (let i = 0; i < 2; ++i) {
//         let texture = createAndSetupTexture(gl);
//         textures.push(texture);
//         gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

//         let fbo = gl.createFramebuffer();
//         framebuffers.push(fbo);
//         gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
//         gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
//     }
// }

function setupPingPongFramebuffers(width, height) {
    for (let i = 0; i < 2; ++i) {
        let texture = createAndSetupTexture(gl);
        textures.push(texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);

        // // Set texture parameters for proper behavior
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        let fbo = gl.createFramebuffer();
        framebuffers.push(fbo);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
}

// function setupPingPongFramebuffers(width, height) {
//     for (let i = 0; i < 2; ++i) {
//         let texture = createAndSetupTexture(gl);
//         textures.push(texture);
//         gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
//         let fbo = gl.createFramebuffer();
//         framebuffers.push(fbo);
//         gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
//         gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
//     }
// }


function multiPassRendering() {
    let readIndex = 0;
    let writeIndex = 1;

    // Clear both framebuffers to black
    for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[i]);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    if (selectedModes.length === 0) {
        // If no modes are selected, set displacementTexture to the cleared (black) texture
        displacementTexture = textures[writeIndex];
    } else {
        let selectedWeights = selectedModes.map(modeIndex => topKValuesWeights[modeIndex]);
        let sumWeights = selectedWeights.reduce((a, b) => a + b, 0);
        let normalizedSelectedWeights = selectedWeights.map(weight => weight / sumWeights);

        gl.useProgram(accumulationProgram);
        gl.disable(gl.DEPTH_TEST);

        // Bind the VAO for the main canvas
        gl.bindVertexArray(vao);

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

            // Pass in amp and phase of the mode
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "modalAmp"), modalAmplitudesList[currentFrameIndex][modeIndex]);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "modalPhase"), modalPhasesList[currentFrameIndex][modeIndex]);

            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uMaxReal"), maxReal);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uMaxImag"), maxImag);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uMinReal"), minReal);
            gl.uniform1f(gl.getUniformLocation(accumulationProgram, "uMinImag"), minImag);

            // Draw the quad
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.drawElements(gl.TRIANGLES, 6*widthDivisions*heightDivisions, gl.UNSIGNED_SHORT, 0);
         });

        // Unbind the VAO
        gl.bindVertexArray(null);

        // The final accumulated result is now in textures[writeIndex]
        displacementTexture = textures[writeIndex];


    }
    // checkForNegativeValues(writeIndex);

    

    drawFinalRender();
}


function checkForNegativeValues(writeIndex) {
    const canvas = document.getElementById('glCanvas');
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[writeIndex]);

    let pixels = new Float32Array(canvas.width * canvas.height * 4); // 4 channels: R, G, B, A

    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.FLOAT, pixels);

    let hasNegativeValues = false;
    let hasPositiveValues = false;
    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] < 0) {
            hasNegativeValues = true;
        } else if (pixels[i] > 0) {
            hasPositiveValues = true
        }
        if(hasNegativeValues && hasPositiveValues) {
            break;
        }
    }

    if (hasNegativeValues && hasPositiveValues) {
        console.log("Framebuffer has negative and positive values");
    } else if (hasNegativeValues) {
        console.log("Framebuffer has negative values");
    } else if (hasPositiveValues) {
        console.log("Framebuffer has positive values");
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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

// function bindTextureWithImage(texture, image) {
//     gl.bindTexture(gl.TEXTURE_2D, texture);
//     gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
// }
function bindTextureWithImage(texture, image) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Assuming the image data can be interpreted as floating-point, otherwise, preprocessing is required
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.RGBA, gl.FLOAT, image);

    // Set texture parameters for filtering and wrapping
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

// function bindTextureWithImage(texture, image) {
//     gl.bindTexture(gl.TEXTURE_2D, texture);
//     // Create a temporary canvas to convert the image to float data
//     const tempCanvas = document.createElement('canvas');
//     tempCanvas.width = image.width;
//     tempCanvas.height = image.height;
//     const tempCtx = tempCanvas.getContext('2d');
//     tempCtx.drawImage(image, 0, 0);
//     const imageData = tempCtx.getImageData(0, 0, image.width, image.height);
    
//     // Convert Uint8 data to Float32
//     const floatData = new Float32Array(imageData.data.length);
//     for (let i = 0; i < imageData.data.length; i++) {
//         floatData[i] = imageData.data[i] / 255;  // Normalize to [0, 1]
//     }
    
//     gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, image.width, image.height, 0, gl.RGBA, gl.FLOAT, floatData);
// }

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

    sourceGl.deleteFramebuffer(framebuffer);
}

// function copyTexture(sourceGl, sourceTexture, destGl, destTexture) {
//     // Create a temporary canvas to read the source texture
//     const width = sourceGl.canvas.width;
//     const height = sourceGl.canvas.height;
    
//     // Read the source texture
//     const framebuffer = sourceGl.createFramebuffer();
//     sourceGl.bindFramebuffer(sourceGl.FRAMEBUFFER, framebuffer);
//     sourceGl.framebufferTexture2D(sourceGl.FRAMEBUFFER, sourceGl.COLOR_ATTACHMENT0, sourceGl.TEXTURE_2D, sourceTexture, 0);
//     const pixels = new Float32Array(width * height * 4);
//     sourceGl.readPixels(0, 0, width, height, sourceGl.RGBA, sourceGl.FLOAT, pixels);
    
//     // Copy to destination texture
//     destGl.bindTexture(destGl.TEXTURE_2D, destTexture);
//     destGl.texImage2D(destGl.TEXTURE_2D, 0, destGl.RGBA32F, width, height, 0, destGl.RGBA, destGl.FLOAT, pixels);
    
//     sourceGl.deleteFramebuffer(framebuffer);
// }

function computeDisplacementNorms(deformationMap, width = gl.canvas.width, height=gl.canvas.height) {
    const displacementNorms = new Float32Array(width * height);

    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const index = (y * width + x) * 2;
            const dx = deformationMap[index];
            const dy = deformationMap[index + 1];
            const norm = Math.sqrt(dx * dx + dy * dy);

            displacementNorms[y * width + x] = norm;
        }
    }
    return displacementNorms;
}



function generateInverseDeformationMap(width, height) {
    const deformationMap = readTextureData(displacementTexture, width, height);
    const displacementNorms = computeDisplacementNorms(deformationMap, width, height);

    // Initialize
    const inverseDeformationMap = new Float32Array(width * height * 2);
    const normMap = new Float32Array(width * height);

    // Initialize with default values
    for (let i = 0; i < inverseDeformationMap.length; i += 2) {
        inverseDeformationMap[i] = -1.0;
        inverseDeformationMap[i + 1] = -1.0;
    }
    
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const index = (y * width + x) * 2;
            const dx = deformationMap[index];
            const dy = deformationMap[index + 1];
            const norm = displacementNorms[y * width + x];
            
            // Calculate target position
            const targetX = Math.round(x + dx * width);
            const targetY = Math.round(y + dy * height);
            
            if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
                const targetIndex = targetY * width + targetX;
                
                // If this position has not been filled or has a smaller norm
                if (inverseDeformationMap[targetIndex * 2] === -1.0 || norm > normMap[targetIndex]) {
                    inverseDeformationMap[targetIndex * 2] = x / width;
                    inverseDeformationMap[targetIndex * 2 + 1] = y / height;
                    normMap[targetIndex] = norm;
                }
            }
        }
    }
    
    return inverseDeformationMap;
}


// function readTextureData(texture, width, height) {
//     const framebuffer = gl.createFramebuffer();
//     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

//     gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

//     // Create a buffer to store the texture data
//     const pixels = new Float32Array(width * height * 2); // Assuming RGBA format with 2 channels for deformation
//     gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);

//     // Unbind the framebuffer
//     gl.bindFramebuffer(gl.FRAMEBUFFER, null);

//     return pixels;
// }

// function readTextureData(texture, width, height) {
//     const framebuffer = gl.createFramebuffer();
//     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
//     gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    
//     // Create a buffer to store the texture data
//     const pixels = new Float32Array(width * height * 4); // RGBA format
//     gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);
    
//     // Unbind the framebuffer
//     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
//     gl.deleteFramebuffer(framebuffer);
    
//     return pixels;
// }

function readTextureData(texture, width, height) {
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    
    // Create a buffer to store the texture data
    const pixels = new Float32Array(width * height * 4); // RGBA format
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);
    
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    
    return pixels;
}


// Load data

async function loadMetadata(filePath) {
    const response = await fetch(filePath);
    return await response.json();
}

// Function to load individual mode data
async function loadModeData(filePath) {
    const response = await fetch(filePath);
    return await response.json();
}

// Main function to load and process all data
async function loadAllModeData() {
    try {
        const metadata = await loadMetadata();
        const k = Math.min(10, metadata.num_modes); // Load up to 10 modes or all if less

        let modeBasis = [];
        let modeFrequencies = [];
        let topKValuesWeights = [];
        let ranges = metadata.global_ranges;

        // Load data for each mode
        for (let i = 0; i < k; i++) {
            const modeData = await loadModeData(metadata.mode_filenames[i]);
            modeBasis.push(modeData.mode_basis);
            modeFrequencies.push(modeData.mode_frequency);
            topKValuesWeights.push(modeData.top_k_values_weight);
        }

        

    } catch (error) {
        console.error('Error loading mode data:', error);
    }
}



// If async
window.onload = () => {
    init().catch(console.error);
};




export {
    updateGlobalValues,
    updateModeValues
};