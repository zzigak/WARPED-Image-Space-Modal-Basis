// import * as math from '../node_modules/mathjs/lib/browser/math.js';

class Mode {
    constructor(basis, strength, frequency, damping, mass, url, last_impulse = 0, last_impulse_time = 0) {
        this.basis = basis;
        this.strength = strength;
        this.frequency = frequency;
        this.damping = damping;
        this.mass = mass;
        this.y = [[0.0], [0.0]];
        this.q_i = math.complex(0.0, 0.0);
        this.last_impulse = last_impulse;
        this.last_impulse_time = last_impulse_time;
        this.url = url;
    }
}

function setStrength(modes, s, selectedModeIndices) {
    // set strenght for all modes such that they add up to strength
    // let selectedModes = modes.filter((mode, i) => selectedModeIndices.includes(i));
    // let sum = selectedModes.reduce((acc, mode) => acc + mode.strength, 0);
    let sum = modes.reduce((acc, mode) => acc + mode.strength, 0);
    let factor = s / sum;
    modes.forEach(mode => mode.strength *= factor);
}

function setDamping(modes, damping) {
    modes.forEach(mode => mode.damping = damping);
}

function setMass(modes, mass) {
    modes.forEach(mode => mode.mass = mass);
}

// function getYiFromQi(q, omega_i) {
//     let a = q.re;
//     let b = q.im;
//     let qi = a;
//     let qi_prime = -b * omega_i;
//     return [qi, qi_prime];
// }

// function setMaxDisplacement(d, p, mode) {
//     let basis = mode.basis[p].slice(0, 2).concat(mode.basis[p].slice(2));
//     let q_mag = math.norm(math.multiply(basis, d)) * mode.strength;
//     let q_phase = -math.arg(math.multiply(basis, math.transpose(d)));
//     let q_img = q_mag * Math.sin(q_phase);
//     let q_real = q_mag * Math.cos(q_phase);
//     mode.q_i = math.complex(math.sum(q_real), math.sum(q_img));
//     mode.y = getYiFromQi(mode.q_i, mode.frequency * 2 * Math.PI);
// }

function get_modal_force(d, p, mode) {
    if (!mode.basis || !mode.basis.length) {
        console.error('modeBasis is undefined or empty');
    }
    let i = p[1];
    let j = p[0];
    let pixel = mode.basis[i][j];
    let matrix = [
        [pixel[0], pixel[2]],
        [pixel[1], pixel[3]]
    ];
    let fsign = math.sign(math.dot(d, [1, 1]));
    console.log(fsign);
    return fsign * math.norm(math.multiply(matrix, d)) * mode.strength;
}

function update_mode_state_one_step(modal_f, dt, mode) {
    let w = mode.frequency * 2 * Math.PI;
    dt = dt * (1 / w);
    let A = [[1, dt], [-w * w * dt, 1 - mode.damping * w * dt]];
    let B = [[0], [dt / mode.mass]];

    let y_new = math.add(math.multiply(A, mode.y), math.multiply(B, modal_f));
    mode.y = y_new;
    mode.q_i = math.complex(y_new[0][0], -y_new[1][0] / w);
}

function update_mode_state_time_step(dt, mode, msec, current_time) {
    let n_updates = Math.floor(msec / dt);
    let accum = 0;
    for (let i = 0; i < n_updates; i++) {
        console.log("last impulse", mode.last_impulse);
        mode.last_impulse *= Math.exp(-mode.damping * accum);
        update_mode_state_one_step(mode.last_impulse, dt, mode);
        accum += 1;
    }
}

function update_state_time(msec, dt, modes, current_time) {
    modes.forEach(mode => {
        update_mode_state_time_step(dt, mode, msec, current_time);
    });
}

function update_state_one_step(d, p, dt, modes) {
    modes.forEach(mode => {
        let modal_f = get_modal_force(d, p, mode);
        update_mode_state_one_step(modal_f, dt, mode);
    });
}

function setUnitModalCoordinate(modes, idx) {
    modes.forEach((mode, i) => {
        if (idx === i) mode.q_i = math.complex(1, 0);
    });
}

export {
    Mode,
    // getYiFromQi,
    // setMaxDisplacement,
    get_modal_force,
    update_mode_state_one_step,
    update_mode_state_time_step,
    update_state_time,
    update_state_one_step,
    setUnitModalCoordinate,
    setDamping,
    setMass,
    setStrength
};