// translated from ISMB_StateUpdate.py

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
        this.impulse = null;
        this.impulse_time = 0;
        this.last_impulse = last_impulse;
        this.last_impulse_time = 0;
        this.url = url;
        this.ampsXY = [1.0, 1.0, 1.0, 1.0];
    }

    // Interactive mode

    calculateModalCoordinate(d, p, alpha = this.strength) {

        alpha = this.strength;

        // Implement equation (15)
        if (!this.basis || !this.basis.length) {
            console.error('modeBasis is undefined or empty');
        }
        let i = p[1];
        let j = p[0];

        // console.log("basis", this.basis);
        // if (this.basis.every(row => row.every(pixel => pixel.every(val => val === 0)))) { console.log("basis is all zero"); } else {
        //     console.log("basis is not all zero");
        //     // output locations of non-zero pixels 
        //     let nonZeroLocations = [];
        //     this.basis.forEach((row, i) => {
        //         row.forEach((pixel, j) => {
        //             if (!pixel.every(val => val === 0)) {
        //                 nonZeroLocations.push([i, j]);
        //             }
        //         });
        //     });
        //     console.log("nonZeroLocations", nonZeroLocations);
        // }
        console.log("i / row", i, "j / column", j);
        console.log("basis [Row, column]", this.basis.length, this.basis[0].length);
        let pixel = this.basis[i][j];
        console.log("PIXEL", pixel);
        let matrix = [
            [pixel[0], pixel[2]],
            [pixel[1], pixel[3]]
        ];
        console.log("matrix", matrix, "d", d);
        let inner = math.multiply(matrix, d);
        return [math.norm(inner), inner];
    }


    setForTime(msecs, damping = true) {
        let amplitude = 0.0;
        let phase = 0.0;

        if (this.frequency > 0) {
            let nperiod = 0.001 * (msecs - this.impulse_time) * this.frequency;

            if (damping) {
                let d = Math.pow(0.5, nperiod * this.damping);
                amplitude = this.impulse * d;
            } else {
                amplitude = this.impulse;
            }

            phase = (nperiod + this.impulse_phase) % 1.0;
        }

        this.q_i = math.complex.polar(amplitude, phase * 2 * Math.PI);
        console.log("Phase changed:", phase);
        this.impulse_time = msecs;
    }

    setModalCoordinateFromDisplacement(d, p, mode, isDisplacement) {
        console.log("Setting coordinate, p is: ", p);
        let [q_mag, inner] = this.calculateModalCoordinate(d, p, mode);
        console.log("q_mag:", q_mag, "inner:", inner);

        // Check if inner product is zero or very close to zero
        if (Math.abs(inner[0]) < 1e-5 && Math.abs(inner[1]) < 1e-5) {
            console.warn("Inner product is very close to zero, setting q_i to zero");
            mode.q_i = math.complex(0, 0);
            return;
        }

        // Create a complex number from inner
        let innerComplex = math.complex(inner[0], inner[1]);
        console.log("innerComplex:", innerComplex);

        let q_phase;
        if (isDisplacement) {
            q_phase = -math.arg(innerComplex);
        } else {
            q_phase = -math.arg(innerComplex) + Math.PI / 2;
        }
        console.log("q_phase:", q_phase);

        if (isNaN(q_phase)) {
            console.error("q_phase is NaN, inner:", inner);
            return;
        }

        let q_real = q_mag * Math.cos(-1 * q_phase) * mode.strength;
        let q_img = q_mag * Math.sin(-1 * q_phase) * mode.strength;

        console.log("q_real:", q_real, "q_img:", q_img);

        if (isNaN(q_real) || isNaN(q_img)) {
            console.log("q_real or q_img is NaN, q_mag:", q_mag, "q_phase:", q_phase);
            return;
        }

        mode.q_i = math.complex(q_real, q_img);
        console.log("########## Final q_i( ): ", mode.q_i);
    }

}


function setStrength(modes, strength) {
    modes.forEach(mode => mode.strength = strength);
}

function setDamping(modes, damping) {
    modes.forEach(mode => mode.damping = damping);
}

function setMass(modes, mass) {
    modes.forEach(mode => mode.mass = mass);
}



function updateStateFromDirectManipulation(modes, d, p, isDisplacement) {
    for (let i = 0; i < modes.length; i++) {
        console.log("######################### MODE ", i);
        let mode = modes[i];
        mode.setModalCoordinateFromDisplacement(d, p, mode, isDisplacement);
        mode.y = [[mode.q_i.re], [-mode.q_i.im / (mode.frequency * 2 * Math.PI)]];
        mode.impulse = math.abs(mode.q_i);
        mode.impulse_phase = math.arg(mode.q_i) / (2 * Math.PI);
        mode.impulse_time = 0;
        // mode.y = getYiFromQi(mode.q_i, mode.frequency * 2 * Math.PI);
        // Update the mode state

    }
}


// Non interactive mode

function getYiFromQi(q, omega_i) {
    let a = q.re;
    let b = q.im;
    let qi = a;
    let qi_prime = -b * omega_i;
    return [qi, qi_prime];
}


function get_modal_force(d, p, mode) {
    if (!mode.basis || !mode.basis.length) {
        console.error('modeBasis is undefined or empty');
    }
    let i = p[0];
    let j = p[1];
    let pixel = mode.basis[i][j];
    let matrix = [
        [pixel[0], pixel[2]],
        [pixel[1], pixel[3]]
    ];
    return math.norm(math.multiply(matrix, d)) * mode.strength;
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
    console.log(n_updates);
    let accum = 0;
    for (let i = 0; i < n_updates; i++) {
        mode.last_impulse *= Math.exp(-mode.damping * accum);
        update_mode_state_one_step(mode.last_impulse, dt, mode);
        accum += dt;
    }
}

function update_state_time(msec, dt, modes, current_time) {
    modes.forEach(mode => update_mode_state_time_step(dt, mode, msec, current_time));
}

// function update_mode_state_one_step(modal_f, dt, mode) {
//     let w = mode.frequency * 2 * Math.PI;
//     dt = dt * (1 / w);
//     let A = [[1, dt], [-w * w * dt, 1 - mode.damping * w * dt]];
//     let B = [[0], [dt / mode.mass]];

//     let y_new = math.add(math.multiply(A, mode.y), math.multiply(B, modal_f));
//     mode.y = y_new;
//     mode.q_i = math.complex(y_new[0][0], -y_new[1][0] / w);
// }

// function update_mode_state_time_step(dt, mode, mTime) {
//     let accumTime = dt * 100;

//     console.log("mtime", mTime);
//     let h = (1.0 / (mode.frequency * 2 * Math.PI)) * 0.01;
//     console.log("last_impulse_time", mode.last_impulse_time);
//     let deltaTime = (mTime - mode.last_impulse_time) * 0.001; // in ms
//     console.log("deltaTime", deltaTime);

//     let n_updates = Math.floor(deltaTime / h);
//     console.log("n_updates", n_updates);
//     n_updates = Math.min(n_updates, 10);

//     for (let i = 0; i < n_updates; i++) {
//         // mode.last_impulse *= Math.exp(-mode.damping * accumTime);
//         update_mode_state_one_step(mode.last_impulse, dt, mode);
//         accumTime += dt;
//     }
//     mode.last_impulse_time = mTime;
//     console.log("mode.last_impulse_time", mode.last_impulse_time);
// }



// function update_state_time(mTime, dt, modes) {
//     modes.forEach(mode => update_mode_state_time_step(dt, mode, mTime));
// }

// function update_state_time_whole(msecs, dt, modes) {
//     modes.forEach(mode => {
//         const timePassed = (msecs - mode.last_impulse_time) * 0.001; // Convert to seconds
//         const wdi = mode.frequency * 2 * Math.PI;
//         const wi = wdi; // Assuming no frequency adjustment for damping

//         const h = dt / wdi;

//         const A11 = 1;
//         const A21 = h;
//         const A12 = -h * (wi * wi);
//         const A22 = (1.0 - (2.0 * mode.damping * wi * h));

//         const nSpins = Math.min(Math.floor(timePassed / h), 8000); // Limit max iterations

//         let impulse = math.complex(mode.last_impulse, 0);
//         let fsign = Math.sign(impulse.re);
//         if (fsign === 0) fsign = 1;

//         const impulseAdd = h * fsign * math.abs(impulse) * 100.0;

//         let qr = mode.q_i.re;
//         let qi = mode.q_i.im;

//         for (let i = 0; i < nSpins; i++) {
//             const qnr = A11 * qr + A21 * qi;
//             const qni = A12 * qr + A22 * qi + impulseAdd;
//             qr = qnr;
//             qi = qni;
//         }

//         mode.q_i = math.complex(qr, qi);

//         // Convert back to phase representation
//         const mag = math.abs(mode.q_i);
//         let phase = math.atan2(mode.q_i.im, mode.q_i.re) / (2 * Math.PI) + 0.5;
//         phase = (phase + 1) % 1; // Ensure phase is between 0 and 1

//         mode.q_i = math.complex.polar(mag, phase * 2 * Math.PI);

//         mode.last_impulse_time = msecs;
//     });
// }

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




function setSuperposition(modes, i) {

    let newImpulse; let msec; let newSuperposition;

    // add newImpulse superposition
    for (let mode of modes) {
        newImpulse = forceToSuperposition(modes, i, system.t);
        msec = newImpulse.time;
        newSuperposition = math.complex(newImpulse.amp, newImpulse.phase);

        let nperiod = 0.001 * (msec - mode.impulse_time) * mode.frequency;
        let d = Math.pow(0.5, nperiod * mode.damping);
        let superpositionAmp = Math.hypot(mode.impulse) * d;
        let superpositionPhase = Math.abs(nperiod + Math.atan2(mode.impulse[0], mode.impulse[1]), 1.0);

        // complex superposition for mode.impulse and newImpulse
        let superposition = math.complex(superpositionAmp, superpositionPhase);
        mode.impulse = math.add(superposition, newSuperposition);
        mode.impulse_time = newImpulse.time;
    }

}

function forceToSuperposition(mode, i, t) {
    // Get screen dimensions (normalized)
    let screenV = [mode.basis[0].length, mode.basis.length];
    let screenVLength = Math.hypot(screenV[0], screenV[1]);
    let screenVNorm = [screenV[0] / screenVLength, screenV[1] / screenVLength];

    // Calculate force vector
    let forceV = [i[2] * screenVNorm[0], i[3] * screenVNorm[1]];
    let forceVLength = Math.hypot(forceV[0], forceV[1]);
    let forceVNorm = forceVLength > 0 ? [forceV[0] / forceVLength, forceV[1] / forceVLength] : [0, 0];

    // Get basis value at displaced mousedownlocation
    let x = Math.floor(i[0]);
    let y = Math.floor(i[1]);
    let tval = (x >= 0 && x < mode.basis[0].length && y >= 0 && y < mode.basis.length)
        ? mode.basis[y][x]
        : [0, 0, 0, 0];

    if (forceVLength === 0 || (tval[1] === 0 && tval[3] === 0)) {
        return { time: t, phase: 0, amp: 0 };
    }

    mode.ampsXY = [Math.abs(forceVNorm[0]), Math.abs(forceVNorm[1]), 1.0, 1.0];

    // Calculate complex numbers
    let cx = [tval[1] * Math.cos(tval[0]), tval[1] * Math.sin(tval[0])];
    let cy = [tval[3] * Math.cos(tval[2]), tval[3] * Math.sin(tval[2])];

    let r = [
        cx[0] * forceVNorm[0] - cx[1] * forceVNorm[0] + cy[0] * forceVNorm[1] - cy[1] * forceVNorm[1],
        cx[0] * forceVNorm[0] + cx[1] * forceVNorm[0] + cy[0] * forceVNorm[1] + cy[1] * forceVNorm[1]
    ];

    let phshift = -Math.atan2(r[1], r[0]);
    let amp = Math.hypot(r[0], r[1]) * mode.strength * forceVLength;

    return { time: t, phase: (phshift / (2 * Math.PI)), amp: amp };
}



export {
    Mode,
    // getYiFromQi,
    // setMaxDisplacement,
    updateStateFromDirectManipulation,
    get_modal_force,
    update_mode_state_one_step,
    update_mode_state_time_step,
    update_state_time,
    update_state_one_step,
    setUnitModalCoordinate,
    setDamping,
    setMass,
    setStrength,
    setSuperposition
};