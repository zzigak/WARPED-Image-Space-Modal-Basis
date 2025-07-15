// State Update Stuff
import * as MS from "./stateUpdate.js";

let gl;
let accumulationProgram;
let finalRenderProgram;
let textocanvasProgram;
let arrowProgram;
let arrowBuffer;
let displacementTexture;
let originalTexture;
let originalImage;
let positionBuffer;
let texCoordBuffer;
let texDims = [];
let textures = [];
let modalTextures = [];
let framebuffers = [];
let k = 8;

let scaleX = 1;
let scaleY = 1;

// animating
let startTime;
let modes = [];
let dt = 0.01;
let msec = 100;
let d = [5, 5];
let p = [0, 0];
let numFrames = 100;
let currentFrameIndex = 0;
let currentTime = 0;
let modalCoordinatesList = [];
let arrowEndPoints = [];
let deformedModalCoordinates = [];

// mouse events
let isMouseDown = false;
let mouseDownPosition = [0, 0]; // [x,y]
let currentMousePosition = [0, 0]; // [x,y]
let alpha = 1.0;
let isDisplacementMode = true; // 0 is velocity mode, else is displacement mode

async function fetchData(path) {
  const response = await fetch(path);
  const data = await response.json();
  console.log("Loaded modal basis data JSON");
  return {
    modeBasis: data.mode_basis,
    modeFrequencies: data.mode_frequencies,
    topKValuesWeights: data.top_k_values_weights,
  };
}

function getMousePosition(event) {
  const rect = gl.canvas.getBoundingClientRect();
  const scaleX = gl.canvas.width / rect.width;
  const scaleY = gl.canvas.height / rect.height;
  return [
    (event.clientX - rect.left) * scaleX,
    (event.clientY - rect.top) * scaleY,
  ];
}

function handleMouseDown(event) {
  if (isMouseDown) return;
  else {
    // console.log("Mouse down position updating!!!");
    isMouseDown = true;
    mouseDownPosition = getMousePosition(event);
    currentMousePosition = [...mouseDownPosition];
    // console.log("Mouse down position:", mouseDownPosition);
    p = [Math.round(mouseDownPosition[0]), Math.round(mouseDownPosition[1])];

    // console.log("######## Mouse down, requesting renderNow!!! ######## ");
    // requestAnimationFrame(renderNow);
  }
}

function handleMouseUp() {
  // clear mouse down position
  mouseDownPosition = [0, 0];
  isMouseDown = false;
  normalAnimation();
  ``;
  // startTime = Date.now();
  // startNormalAnimation();
}

function handleMouseMove(event) {
  if (isMouseDown) {
    currentMousePosition = getMousePosition(event);
    console.log("New mouse current position:", currentMousePosition);
    console.log("########### UPDATING DEFORMATION ###########");
    updateDeformation();
    // updateModeDeformation();

    // // Render frame
    startRendering(gl.canvas.width, gl.canvas.height);
    console.log("shifting");
    deformedModalCoordinates.shift();
    gl.useProgram(arrowProgram);
    drawArrow(
      mouseDownPosition,
      currentMousePosition,
      [1.0, 0.0, 0.0, 1.0],
      6,
      30,
    );
  }
}

function updateModeDeformation() {
  // Calculate vectors and points
  let displacedStart = getDisplacedPoint(mouseDownPosition);
  let pointForce =
    (mouseDownPosition[0],
      mouseDownPosition[1],
      currentMousePosition[0] - mouseDownPosition[0],
      currentMousePosition[1] - mouseDownPosition[1]);
  let dDesired = currentMousePosition - displacedStart;

  // Set Superposition for Modes
  MS.setSuperposition(modes, pointForce);
  // MS.updateStateFromDirectManipulation(modes, pointForce, mouseDownPosition, isDisplacementMode);
  arrowEndPoints = [displacedStart, dDesired];
}

function getDisplacedPoint(point) {
  let displacement = [0, 0];

  for (let mode of modes) {
    let singleModeDisplacement = getSingleModeDisplacementForPoint(mode, point);
    displacement[0] += singleModeDisplacement[0];
    displacement[1] += singleModeDisplacement[1];
  }

  displacement[0] /= gl.canvas.width * 2.0;
  displacement[1] /= gl.canvas.height * 2.0;

  console.log("accumulated displacement", displacement);

  return [point[0] + displacement[0], point[1] + displacement[1]];
}

function getSingleModeDisplacementForPoint(mode, point) {
  let ampsXY = mode.ampsXY;
  let amplitude = Math.hypot(mode.q_i.re, mode.q_i.im);
  let phase = Math.atan2(mode.q_i.im, mode.q_i.re);

  let basisValue = getValueAt(mode, point);

  let xdisp = basisValue[1] * Math.cos(basisValue[0] + phase * 6.28) * ampsXY.x;
  let ydisp = basisValue[3] * Math.cos(basisValue[2] + phase * 6.28) * ampsXY.y;

  return [xdisp, ydisp] * amplitude;
}

function getValueAt(mode, point) {
  let x = Math.floor(point[0]);
  let y = Math.floor(point[1]);

  if (x >= 0 && x < mode.basis[0].length && y >= 0 && y < mode.basis.length) {
    return mode.basis[y][x];
  } else {
    return [0, 0, 0, 0];
  }
}

function drawArrow(
  from,
  to,
  color = [1.0, 1.0, 0.0, 1.0],
  lineWidth = 4,
  arrowSize = 20,
) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const angle = Math.atan2(dy, dx);
  const length = Math.sqrt(dx * dx + dy * dy);

  // Calculate the perpendicular vector for line thickness
  const perpX = ((-dy / length) * lineWidth) / 2;
  const perpY = ((dx / length) * lineWidth) / 2;

  // Create arrow geometry
  const vertices = new Float32Array([
    // Line
    from[0] + perpX,
    from[1] + perpY,
    from[0] - perpX,
    from[1] - perpY,
    to[0] + perpX,
    to[1] + perpY,
    to[0] - perpX,
    to[1] - perpY,

    // Arrowhead
    to[0],
    to[1],
    to[0] - arrowSize * Math.cos(angle - Math.PI / 6),
    to[1] - arrowSize * Math.sin(angle - Math.PI / 6),
    to[0] - arrowSize * Math.cos(angle + Math.PI / 6),
    to[1] - arrowSize * Math.sin(angle + Math.PI / 6),
  ]);

  gl.useProgram(arrowProgram);

  // Set color uniform
  const colorLocation = gl.getUniformLocation(arrowProgram, "uColor");
  gl.uniform4fv(colorLocation, color);

  // Set resolution uniform
  const resolutionLocation = gl.getUniformLocation(arrowProgram, "uResolution");
  gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

  // Set point size uniform (for arrowhead)
  const pointSizeLocation = gl.getUniformLocation(arrowProgram, "uPointSize");
  gl.uniform1f(pointSizeLocation, arrowSize);

  // Bind vertex buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, arrowBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // Set up attribute
  const positionLocation = gl.getAttribLocation(arrowProgram, "aPosition");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Draw the arrow line
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Draw the arrowhead
  gl.drawArrays(gl.TRIANGLES, 4, 3);
}

function normalAnimation() {
  // Read parameters from HTML
  let strength = parseFloat(document.getElementById("strength").value);
  let damping = parseFloat(document.getElementById("damping").value);
  let mass = parseFloat(document.getElementById("mass").value);

  // Update modes with new parameters
  MS.setDamping(modes, damping);
  MS.setStrength(modes, strength);
  MS.setMass(modes, mass);

  console.log("Rendering loop...");
  let frame = 0;
  let threshold = 0.0001;

  // setLastImpulseTime(modes);

  function renderFrame() {
    console.log("Rendering frame", frame);
    MS.update_state_time(1, dt, modes);
    let coordinates = modes.map((mode) => [mode.q_i.re, mode.q_i.im]);
    modalCoordinatesList.push(coordinates);

    // RENDER SINGLE FRAME
    startRendering(gl.canvas.width, gl.canvas.height);
    modalCoordinatesList.shift();

    if (checkConvergence(coordinates, threshold)) {
      console.log("Convergence reached");
    } else {
      frame += 1;
      requestAnimationFrame(renderFrame);
    }
  }

  requestAnimationFrame(renderFrame);
}

function updateDeformation() {
  // console.log("texdims:", texDims[0], texDims[1]);
  // console.log("canvas, size:", gl.canvas.width, gl.canvas.height);
  // d = [currentMousePosition[0] - mouseDownPosition[0], currentMousePosition[1] - mouseDownPosition[1]];
  // // normalize d
  // const norm = Math.sqrt(d[0] ** 2 + d[1] ** 2);
  // d = [d[0] / norm, d[1] / norm];
  // d = [d[0] * texDims[0], d[1] * texDims[1]];

  // Calculate d as the difference between current and initial mouse positions
  // d = [currentMousePosition[0] - mouseDownPosition[0], currentMousePosition[1] - mouseDownPosition[1]];

  // Scale d to pixel dimensions, but don't normalize
  // d = [d[0] * texDims[0], d[1] * texDims[1]];
  // console.log("d:", d);

  // if (Math.hypot(d[0], d[1]) > 0.001) {
  //     console.log("Mouse down position, p, before:", mouseDownPosition);
  //     // Convert current mouse position to pixel coordinates
  //     p[0] = Math.round(currentMousePosition[0] * texDims[0]);
  //     p[1] = Math.round((1 - currentMousePosition[1]) * texDims[1]); // Flip Y-coordinate

  //     console.log("Mouse down position, p, after:", p);

  //     // Call the function from stateUpdate.js to update modal coordinates
  //     MS.updateStateFromDirectManipulation(modes, d, p, isDisplacementMode);
  //     let coordinates = modes.map(mode => [mode.q_i.re, mode.q_i.im]);
  //     modalCoordinatesList.push(coordinates);
  //     console.log("Q_i FROM DIRECT MANIPULATION:", coordinates[0][0], coordinates[0][1]);

  //     // Render frame
  //     startRendering(gl.canvas.width, gl.canvas.height);
  // }

  // Calculate d as the scaled difference between current and initial mouse positions

  d = [
    currentMousePosition[0] - mouseDownPosition[0],
    currentMousePosition[1] - mouseDownPosition[1],
  ];

  // // normalize d
  // const norm = Math.sqrt(d[0] ** 2 + d[1] ** 2);
  // d = [d[0] / norm, d[1] / norm];

  let pointForce =
    (mouseDownPosition[0],
      mouseDownPosition[1],
      currentMousePosition[0] - mouseDownPosition[0],
      currentMousePosition[1] - mouseDownPosition[1]);

  if (Math.hypot(d[0], d[1]) > 0.01) {
    // Convert current mouse position to scaled pixel coordinates
    console.log("currentMousePosition:", currentMousePosition);
    console.log("MouseDown position (p):", p);
    console.log("Displacement vector (d):", d);

    // Update and extract new modes
    MS.updateStateFromDirectManipulation(modes, d, p, isDisplacementMode);
    let coordinates = modes.map((mode) => [mode.q_i.re, mode.q_i.im]);
    // let states = modes.map(mode => [mode.y[0][0], mode.y[0][1]]);
    // modalCoordinatesList = [coordinates];
    deformedModalCoordinates.push(coordinates);

    // normalize the real and imag parts such that the sum over them separately is one
    let sumReal = 0;
    let sumImag = 0;
    for (let i = 0; i < modes.length; i++) {
      sumReal += Math.abs(coordinates[i][0]);
      sumImag += Math.abs(coordinates[i][1]);
    }
    for (let i = 0; i < modes.length; i++) {
      coordinates[i][0] /= sumReal;
      coordinates[i][1] /= sumImag;
    }

    // multiply all real by constant with vector operations
    let beta = 1;
    for (let i = 0; i < modes.length; i++) {
      coordinates[i][0] *= beta;
      coordinates[i][1] *= beta;
    }

    // console.log('mode', modes.length);
    // console.log("deformed shape", deformedModalCoordinates.length);
    console.log(
      "q_0 FROM DIRECT MANIPULATION:",
      deformedModalCoordinates[0][0],
      deformedModalCoordinates[0][1],
    );

    // // Render frame
    // startRendering(gl.canvas.width, gl.canvas.height);
    // gl.useProgram(arrowProgram);
    // drawArrow(mouseDownPosition, currentMousePosition, [1.0, 0.0, 0.0, 1.0], 6, 30);
  }
}

function toggleDisplacementMode(isDisplacement) {
  isDisplacementMode = isDisplacement;
}

function renderNow() {
  if (isMouseDown) {
    // updateDeformation();
    startRendering(gl.canvas.width, gl.canvas.height);
    gl.useProgram(arrowProgram);
    drawArrow(
      mouseDownPosition,
      currentMousePosition,
      [1.0, 0.0, 0.0, 1.0],
      6,
      3,
    );
  } else {
    // check if converged
    startNormalAnimation();
    return;
  }

  requestAnimationFrame(renderNow);
}

function startNormalAnimation() {
  console.log("Starting normal animation");

  let strength = parseFloat(document.getElementById("strength").value);
  let damping = parseFloat(document.getElementById("damping").value);
  let mass = parseFloat(document.getElementById("mass").value);

  // Update modes with new parameters
  MS.setDamping(modes, damping);
  MS.setStrength(modes, strength);
  MS.setMass(modes, mass);

  let frame = 0;
  let threshold = 0.001;

  setLastImpulseTime(modes);

  function renderFrame() {
    let mTime = Date.now() - startTime;
    MS.update_state_time(mTime, dt, modes);
    // let coordinates = modes.map(mode => [mode.y[0][0], mode.y[1][0]]);
    let coordinates = modes.map((mode) => [mode.q_i.re, mode.q_i.im]);
    // modalCoordinatesList.push(coordinates);

    // // RENDER SINGLE FRAME
    // startRendering(gl.canvas.width, gl.canvas.height);
    // modalCoordinatesList.shift();

    if (checkConvergence(coordinates, threshold)) {
      console.log("Convergence reached");
      return;
    } else {
      modalCoordinatesList.push(coordinates);
      // RENDER SINGLE FRAME
      startRendering(gl.canvas.width, gl.canvas.height);
      modalCoordinatesList.shift();
      frame += 1;
      requestAnimationFrame(renderFrame);
    }
  }

  let coord = [];
  for (let i = 0; i < modes.length; i++) {
    coord.push([modes[i].q_i.re, modes[i].q_i.im]);
  }

  if (checkConvergence(coord, threshold)) {
    console.log("Already rest state, don't start animation");
  } else {
    requestAnimationFrame(renderFrame);
  }
}

// initialize mode objects

function initializeModes(modeBasis, modeFrequencies, topKValuesWeights, urls) {
  // console.log('modeBasis:', modeBasis);
  // console.log('modeFrequencies:', modeFrequencies);
  // console.log('topKValuesWeights:', topKValuesWeights);
  // console.log('urls:', urls);

  if (!modeBasis || !modeBasis.length) {
    console.error("modeBasis is undefined or empty");
    return;
  }

  for (let i = 0; i < Math.min(modeBasis.length, k); i++) {
    let basis = modeBasis[i];
    // console.log(basis[0].length, basis.length);
    let strength = topKValuesWeights[i] * alpha;
    let frequency = modeFrequencies[i];
    let damping = 0.07;
    let mass = 1;
    let url = urls[i];
    let last_impulse_time = 0;
    modes.push(
      new MS.Mode(
        basis,
        strength,
        frequency,
        damping,
        mass,
        url,
        (last_impulse_time = last_impulse_time),
      ),
    );
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
  const parts = input.split(",").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) {
    throw new Error("Invalid input format. Expected format: x,y");
  }
  return parts;
}

function setLastImpulseTime(modes) {
  modes.forEach((mode) => {
    mode.last_impulse_time = Date.now();
  });
}

function handleImpulseOneByOne() {
  console.log("Impulse Button Clicked");
  resetModes();

  // Read parameters from HTML
  let p = parseInput(document.getElementById("pPoint").value);
  let d = parseInput(document.getElementById("dVector").value);
  let strength = parseFloat(document.getElementById("strength").value);
  let damping = parseFloat(document.getElementById("damping").value);
  let mass = parseFloat(document.getElementById("mass").value);

  // Update modes with new parameters
  MS.setDamping(modes, damping);
  MS.setStrength(modes, strength);
  MS.setMass(modes, mass);
  applyImpulse(d, p);

  console.log("Rendering loop...");
  let frame = 0;
  let threshold = 0.0001;

  // setLastImpulseTime(modes);

  function renderFrame() {
    console.log("Rendering frame", frame);
    MS.update_state_time(1, dt, modes);
    // let coordinates = modes.map(mode => [mode.y[0][0], mode.y[1][0]]);
    let coordinates = modes.map((mode) => [mode.q_i.re, mode.q_i.im]);
    modalCoordinatesList.push(coordinates);

    // RENDER SINGLE FRAME
    startRendering(gl.canvas.width, gl.canvas.height);
    modalCoordinatesList.shift();

    if (checkConvergence(coordinates, threshold)) {
      console.log("Convergence reached");
    } else {
      frame += 1;
      requestAnimationFrame(renderFrame);
    }
  }

  requestAnimationFrame(renderFrame);
}

function checkConvergence(coordinates, threshold) {
  return coordinates.every(
    (coord) => Math.abs(coord[0]) < threshold && Math.abs(coord[1]) < threshold,
  );
}

// function renderFramesWithDelay(fps = 60) {
//     const frameDelay = 60 / fps;  // Correct frame delay calculation in milliseconds
//     let lastFrameTime = 0;

//     function renderFrame(currentTime) {
//         if (currentTime - lastFrameTime >= frameDelay) {
//             if (modalCoordinatesList.length > 0) {
//                 startRendering(gl.canvas.width, gl.canvas.height);
//                 modalCoordinatesList.shift();
//                 lastFrameTime = currentTime;
//             }
//         }

//         if (modalCoordinatesList.length > 0) {
//             requestAnimationFrame(renderFrame);
//         }
//     }

//     requestAnimationFrame(renderFrame);
// }

// reset coordinates and impulses
function resetModes() {
  modes.forEach((mode) => {
    mode.y = [[0.0], [0.0]];
    mode.q_i = { re: 0.0, im: 0.0 };
    mode.last_impulse = 0;
    mode.last_impulse_time = 0;
  });
}

// computes modalCoordinates for numFrames using last_impulse set in initializeModes
function computeModalCoordinates(numFrames) {
  console.log("Computing Modal Coordinates");
  let currentTime = 0;
  let l = [];

  for (let i = 0; i < numFrames; i++) {
    MS.update_state_time(1, dt, modes, currentTime);
    // let coordinates = modes.map(mode => [mode.y[0][0], mode.y[1][0]]);
    let coordinates = modes.map((mode) => [mode.q_i.re, mode.q_i.im]);
    l.push(coordinates);
    currentTime += 1;
  }

  return l;
}

async function init() {
  const canvas = document.getElementById("glCanvas");
  gl = canvas.getContext("webgl");
  console.log("Canvas size:", gl.canvas.width, gl.canvas.height);
  texDims = [gl.canvas.width, gl.canvas.height];
  console.log(texDims, gl.canvas.width, gl.canvas.height);

  if (!gl) {
    console.error(
      "Unable to initialize WebGL 2. Your browser may not support it.",
    );
    return;
  }

  const ext = gl.getExtension("EXT_frag_depth");
  if (!ext) {
    console.warn("EXT_frag_depth extension not supported");
  }

  // Load shaders from Files
  const accumulationVertSource = await loadShaderFile(
    "accumulation-vertex.vert",
  );
  const accumulationFragSource = await loadShaderFile(
    "accumulation-fragment.frag",
  );
  const finalRenderVertSource = await loadShaderFile(
    "final-render-vertex.vert",
  );
  const finalRenderFragSource = await loadShaderFile(
    "final-render-fragment.frag",
  );
  const textocanvasFragSource = await loadShaderFile("textocanvas.frag");
  const textocanvasVertSource = await loadShaderFile("textocanvas.vert");
  const arrowVertSource = await loadShaderFile("drawArrow.vert");
  const arrowFragSource = await loadShaderFile("drawArrow.frag");

  const accumulationVert = loadShader(
    gl,
    gl.VERTEX_SHADER,
    accumulationVertSource,
  );
  const accumulationFrag = loadShader(
    gl,
    gl.FRAGMENT_SHADER,
    accumulationFragSource,
  );
  const finalRenderVert = loadShader(
    gl,
    gl.VERTEX_SHADER,
    finalRenderVertSource,
  );
  const finalRenderFrag = loadShader(
    gl,
    gl.FRAGMENT_SHADER,
    finalRenderFragSource,
  );
  const textocanvasVert = loadShader(
    gl,
    gl.VERTEX_SHADER,
    textocanvasVertSource,
  );
  const textocanvasFrag = loadShader(
    gl,
    gl.FRAGMENT_SHADER,
    textocanvasFragSource,
  );

  const arrowVert = loadShader(gl, gl.VERTEX_SHADER, arrowVertSource);
  const arrowFrag = loadShader(gl, gl.FRAGMENT_SHADER, arrowFragSource);

  // // Create shader programs
  accumulationProgram = createShaderProgram(accumulationVert, accumulationFrag);
  finalRenderProgram = createShaderProgram(finalRenderVert, finalRenderFrag);
  textocanvasProgram = createShaderProgram(textocanvasVert, textocanvasFrag);
  arrowProgram = createShaderProgram(arrowVert, arrowFrag);

  // Create arrow buffer
  arrowBuffer = gl.createBuffer();

  console.log("Created shader programs");

  // Create quad buffers
  positionBuffer = createPositionBuffer();
  texCoordBuffer = createTexCoordBuffer();

  // // Load multiple modal images as textures
  const modalUrls = [];
  for (let i = 0; i < k; i++) {
    modalUrls.push(`./assets/modes_two/mode${i}_v3.png`);
  }

  // Initialize modes
  const modeData = await fetchData("./assets/modes_data_2.json");
  console.log("Got mode data");
  initializeModes(
    modeData.modeBasis,
    modeData.modeFrequencies,
    modeData.topKValuesWeights,
    modalUrls,
  );

  console.log("initialized modes");

  // Load modal images and bind them as textures
  loadImages(modalUrls, (images) => {
    for (let i = 0; i < images.length; i++) {
      const texture = createAndSetupTexture(gl);
      bindTextureWithImage(texture, images[i]);
      modalTextures.push(texture);
    }
  });

  console.log("Loaded modal images as textures");

  // Initialize original texture
  originalTexture = createAndSetupTexture(gl);
  originalImage = loadImage(
    "./assets/original_images/first_frame.png",
    function (image) {
      bindTextureWithImage(originalTexture, image);

      scaleX = image.width / gl.canvas.width;
      scaleY = image.height / gl.canvas.height;
      console.log("ScaleX, ScaleY:", scaleX, scaleY);

      canvas.width = image.width;
      canvas.height = image.height;

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      drawOriginalImage();
    },
  );

  console.log("Ready to render...");

  gl.canvas.addEventListener("mousedown", handleMouseDown);
  gl.canvas.addEventListener("mousemove", handleMouseMove);
  gl.canvas.addEventListener("mouseup", handleMouseUp);
  document
    .getElementById("impulseButton")
    .addEventListener("click", handleImpulseOneByOne);

  // if (isMouseDown) {
  //     console.log("Mouse down, requesting renderNow!!!");
  //     requestAnimationFrame(renderNow);
  // }
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
  const canvas = document.getElementById("glCanvas");
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
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    let fbo = gl.createFramebuffer();
    framebuffers.push(fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
  }
}

function multiPassRendering() {
  let readFramebuffer = framebuffers[0];
  let writeFramebuffer = framebuffers[1];
  console.log("MODAL TEXTURES", modalTextures.length);

  // Initial pass setup
  gl.useProgram(accumulationProgram);
  gl.disable(gl.DEPTH_TEST);
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
    gl.uniform1i(
      gl.getUniformLocation(accumulationProgram, "uAccumulatedDisplacement"),
      0,
    );

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, modalTextures[i]);
    gl.uniform1i(
      gl.getUniformLocation(accumulationProgram, "uModalTexture"),
      1,
    );

    if (isMouseDown) {
      console.log("LENGTHHHH", i);
      gl.uniform1f(
        gl.getUniformLocation(accumulationProgram, "uModalCoordinateX"),
        deformedModalCoordinates[0][i][0],
      );
      gl.uniform1f(
        gl.getUniformLocation(accumulationProgram, "uModalCoordinateY"),
        deformedModalCoordinates[0][i][1],
      );
    } else {
      gl.uniform1f(
        gl.getUniformLocation(accumulationProgram, "uModalCoordinateX"),
        modalCoordinatesList[currentFrameIndex][i][0],
      );
      gl.uniform1f(
        gl.getUniformLocation(accumulationProgram, "uModalCoordinateY"),
        modalCoordinatesList[currentFrameIndex][i][1],
      );
    }

    gl.uniform1f(
      gl.getUniformLocation(accumulationProgram, "uFraction"),
      1.0 / k,
    );

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
  const pixels = new Uint8Array(
    gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
  );
  gl.readPixels(
    0,
    0,
    gl.drawingBufferWidth,
    gl.drawingBufferHeight,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );

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
  gl.uniform2f(
    gl.getUniformLocation(finalRenderProgram, "uResolution"),
    width,
    height,
  );
  gl.viewport(0, 0, width, height);
}

function drawQuad(program) {
  program = accumulationProgram;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(gl.getAttribLocation(program, "aPosition"));
  gl.vertexAttribPointer(
    gl.getAttribLocation(program, "aPosition"),
    2,
    gl.FLOAT,
    false,
    0,
    0,
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.enableVertexAttribArray(gl.getAttribLocation(program, "aTexCoord"));
  gl.vertexAttribPointer(
    gl.getAttribLocation(program, "aTexCoord"),
    2,
    gl.FLOAT,
    false,
    0,
    0,
  );

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

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
  const aPositionLocation = gl.getAttribLocation(
    finalRenderProgram,
    "aPosition",
  );
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
  gl.uniform1i(
    gl.getUniformLocation(finalRenderProgram, "uAccumulatedDisplacement"),
    0,
  );

  // Bind original texture

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, originalTexture);
  gl.uniform1i(
    gl.getUniformLocation(finalRenderProgram, "uOriginalTexture"),
    1,
  );

  // gl.activeTexture(gl.TEXTURE1);
  // gl.bindTexture(gl.TEXTURE_2D, originalTexture);
  // const uOriginalTextureLocation = gl.getUniformLocation(finalRenderProgram, "uOriginalTexture");
  // gl.uniform1i(uOriginalTextureLocation, 1);

  // Set texture dimensions
  const uTexDimWidthLocation = gl.getUniformLocation(
    finalRenderProgram,
    "texDimWidth",
  );
  const uTexDimHeightLocation = gl.getUniformLocation(
    finalRenderProgram,
    "texDimHeight",
  );
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
  gl.enableVertexAttribArray(
    gl.getAttribLocation(textocanvasProgram, "aPosition"),
  );
  gl.vertexAttribPointer(
    gl.getAttribLocation(textocanvasProgram, "aPosition"),
    2,
    gl.FLOAT,
    false,
    0,
    0,
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.enableVertexAttribArray(
    gl.getAttribLocation(textocanvasProgram, "aTexCoord"),
  );
  gl.vertexAttribPointer(
    gl.getAttribLocation(textocanvasProgram, "aTexCoord"),
    2,
    gl.FLOAT,
    false,
    0,
    0,
  );

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, originalTexture);

  gl.uniform1i(
    gl.getUniformLocation(textocanvasProgram, "uOriginalTexture"),
    0,
  );

  console.log("Original texture bound:", gl.isTexture(originalTexture));

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      "An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader),
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function loadShaderFile(url) {
  return fetch(url).then((response) => response.text());
}

function createShaderProgram(vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      "Unable to initialize the shader program: " +
      gl.getProgramInfoLog(program),
    );
    return null;
  }

  return program;
}

function createPositionBuffer() {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const positions = new Float32Array([
    -1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  return buffer;
}

function createTexCoordBuffer() {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const texCoords = new Float32Array([0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0]);
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

// If async
window.onload = () => {
  init().catch(console.error);
};
