const canvas = document.getElementById('simulationCanvas');
const context = canvas.getContext('2d');

let isMouseDown = false;
let mouseX = 0;
let mouseY = 0;
let velocityY = 0;
const gravity = 9.8; // gravitational acceleration (pixels per second^2)
const fps = 60; // frames per second
const timeInterval = 1 / fps; // time interval per frame

let lastTime = window.performance.now();

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

function handleMouseDown(event) {
    isMouseDown = true;
    const { x, y } = getMousePosition(event);
    mouseX = x;
    mouseY = y;
    velocityY = 0; // reset velocity when mouse is pressed
}

function handleMouseMove(event) {
    if (isMouseDown) {
        const { x, y } = getMousePosition(event);
        mouseX = x;
        mouseY = y;
    }
}

function handleMouseUp(event) {
    isMouseDown = false;
}

function getMousePosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function updateState() {
    if (!isMouseDown) {
        // Apply gravity only when the mouse is not down
        velocityY += gravity * timeInterval; // update velocity due to gravity
        mouseY += velocityY; // update position

        // Ensure the circle doesn't fall out of the canvas
        if (mouseY > canvas.height) {
            mouseY = canvas.height;
            velocityY = 0; // stop falling when it hits the bottom
        }
    }
}

function drawSimulationState() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (isMouseDown || mouseY < canvas.height) { // Draw circle only if mouse is down or it's still falling
        context.beginPath();
        context.arc(mouseX, mouseY, 30, 0, 2 * Math.PI, false);
        context.fillStyle = 'blue';
        context.fill();
        context.closePath();
    }
}

function simulation() {
    let currentTime = window.performance.now();
    var timePassed = currentTime - lastTime;
    console.log("timePassed: ", timePassed);

    updateState();
    drawSimulationState();

    lastTime = currentTime;

    requestAnimationFrame(simulation);
}

simulation();