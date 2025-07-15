import * as main from './main.js';

class Mode {
    constructor(index, basis, strength, weight, frequency, damping, mass, url, last_impulse = math.complex(0.0,0.0), last_impulse_time = 0) {
        this.basis = basis;
        this.strength = strength;
        this.weight = weight;
        this.frequency = frequency;
        this.damping = damping;
        this.mass = mass;
        this.y = math.complex(0.0, 0.0);
        this.q_i = math.complex(0.0, 0.0);
        this.q_amp = 0.0;
        this.q_phase = 0.0;
        this.last_impulse = math.complex(0.0,0.0);
        this.last_impulse_time = last_impulse_time;
        this.url = url;
        this.instModalForce = 0.0;
        this.index = index;
    }

    addSuperposition(newImpulse, currentTime) {
        let msecs = currentTime - this.last_impulse_time;
        let samp, sphase;

        if (this.frequency > 0) {
            let nperiod = 0.001 * msecs * this.frequency;
            let d = Math.pow(0.5, nperiod * this.damping);
            samp = math.abs(this.last_impulse) * d;
            sphase = (nperiod + math.arg(this.last_impulse) / (2 * Math.PI)) % 1;
        } else {
            samp = 0;
            sphase = 0;
        }

        let oldsup = math.complex({ r: samp, phi: sphase * 2 * Math.PI });
        this.last_impulse = math.add(oldsup, newImpulse);
        this.last_impulse_time = currentTime;
    }


}

function setProperties(selectedModesList, strengths, damping, mass, topKValuesWeights) {
    console.log(selectedModesList);
    let sum = selectedModesList.reduce((acc, mode) => acc + mode.weight, 0);
    sum = 1;
    let i = 0;
    selectedModesList.forEach(mode => {
        if (sum !== 0) {
            let factor = strengths[i] / sum;
            mode.strength = factor;
            console.log("new strength: ", mode.strength);   
        } else {
            mode.strength = 0;
        }
        mode.damping = damping[i];
        mode.mass = mass;
        i++;
    });

    
}


function get_modal_force(d, p, mode) {
    if (!mode.basis || !mode.basis.length) {
        console.error('modeBasis is undefined or empty');
        return math.complex(0, 0);
    }

    let i = p[1];
    let j = p[0];
    let pixel = mode.basis[i][j];

    // Extract the two complex numbers from the pixel
    let cx = math.complex(pixel[0], pixel[1]);
    let cy = math.complex(pixel[2], pixel[3]);

    let r = math.add(
        math.multiply(cx, d[0]),
        math.multiply(cy, d[1])
    );

    let phshift = -math.arg(r);
    let amp = math.abs(r) * mode.strength *0.01;

    return math.complex({ r: amp, phi: phshift });
}

// function get_modal_force(d, p, mode) {
//     if (!mode.basis || !mode.basis.length) {
//         console.log("mode: ", mode);
//         console.error('modeBasis is undefined or empty');
//     }
//     let i = p[1];
//     let j = p[0];
//     let pixel = mode.basis[i][j];
//     let matrix = [
//         [pixel[0], pixel[2]],
//         [pixel[1], pixel[3]]
//     ];

//     let fsign = math.sign(math.dot(d, [1, 1]));
//     // let inner = math.multiply(matrix, d);
//     let inner1 = d[0] * matrix[0][0] + d[1] * matrix[0][1];
//     let inner2 = d[0] * matrix[1][0] + d[1] * matrix[1][1];
//     let inner = [inner1, inner2];

//     // console.log("inner: ", inner);

//     // return  math.norm(inner) * mode.strength, inner;
//     return   fsign*math.norm(inner) * mode.strength, inner;
//     // return 0.0
// }




function applyInstantaneousForce(selectedModes, d, p, currentTime) {
    selectedModes.forEach(mode => {
        let newImpulse = get_modal_force(d, p, mode);
        mode.addSuperposition(newImpulse, currentTime);
    });
}

// function applyInstantaneousForce(selectedModes,d,p, passed) {
//     selectedModes.forEach(mode => {
//         let newForce = get_modal_force(d, p, mode)[0];
//         // mode.instModalForce = newForce * 1000000.0 * mode.strength;
//         mode.instModalForce = newForce * 1.0 * mode.strength;
//     });
// }


// function simulate13(modes, timePassed, isMouseDown, speed) {

   
//     console.log("modes *#&)$*(!&)(*%)#@!&%)*&!#)(%)#@&%)!#&%)", modes);
   

//     let h = 0.0001;
//     let dt = h;

//     // console.log("MODES################:" , modes);
//     modes.forEach(mode => {
//     console.log(`Mode before update:`, {q_i: mode.q_i});

      
//         console.log("FORCE BEFORE LOOP", mode.instModalForce);
//         let w = mode.frequency * 2.0 * Math.PI;
//         let m = mode.mass;
//         // console.log("Frequency w: ", w);
//         dt = h * (1.0 / w);
//         // let dt = h;
//         // console.log("Time step h: ", dt);

//         let A11 = 1.0;
//         let A12 = dt;
//         let A21 = -w * w * dt;

//         let term = 2.0 * mode.damping * w * dt; let A22 = 1.0 - term;
//         let qnr = 0.0;
//         let qni = 0.0;
//         // let qr = mode.q_i.re;
//         // let qi = mode.q_i.im;
//         let qr = mode.y.re;
//         let qi = mode.y.im;
        
//         let nUpdates = Math.min(Math.floor(timePassed/(speed*dt)), 100); // or 300 , do it with wall time
//         // let nUpdates = Math.min(Math.floor(timePassed*0.1 /(speed*dt)), 100); // or 300 , do it with wall time
//         // let nUpdates = Math.min(Math.floor(timePassed/dt), 800); // or 300
//         console.log("nUpdates: ", nUpdates);

//         console.log("A11: ", A11, "A12: ", A12, "A21: ", A21, "A22: ", A22, "damping", mode.damping, "frequency: ", mode.frequency, "dt: ", dt, "timePassed: ", timePassed, "instModalForce: ", mode.instModalForce, "w", w);
//         for (let i = 0; i < nUpdates; i++) {
//             qnr = A11 * qr + A12 * qi;
//             qni = A21 * qr + A22 * qi + mode.instModalForce * dt/m; 
//             qr = qnr;
//             qi = qni;

//             // // check if NaN
//             // if (isNaN(qr) || isNaN(qi) || isNaN(qnr) || isNaN(qni)) {
//             //     console.log("################# NaN detected ######################", i);
//             //     console.log("qr", qr, "qi", qi, "qnr", qnr, "qni", qni, "n", i);    
//             //     break;
//             // }
//         } 

//         mode.q_i = math.complex(qnr, qni);
//         mode.y = math.complex(qnr, qni);
//         mode.q_i = math.complex(mode.q_i.re, -mode.q_i.im / w);

//         const magnitude = Math.sqrt(mode.q_i.re * mode.q_i.re + mode.q_i.im * mode.q_i.im);
//         const phase = Math.atan2(mode.q_i.im, mode.q_i.re);
//         const adjustedPhase = (phase / (2.0 * Math.PI)) + 0.5;

//         mode.q_i = math.complex(magnitude * Math.cos(adjustedPhase * 2.0 * Math.PI), magnitude * Math.sin(adjustedPhase * 2.0 * Math.PI))
//         mode.q_amp = magnitude;
//         mode.q_phase = adjustedPhase;

//         // console.log(`Mode after update:`, { q_i: mode.q_i }, "Y after update:", mode.y);
//         // console.log("MODE UPDATED WITH:", mode.i, mode.q_amp, mode.q_phase, mode.y);
//         main.updateModeValues(mode.index, mode.q_amp, mode.q_phase, mode.y);
//     });
//     main.updateGlobalValues(h, dt);
// }


function simulate13(modes, time, isMouseDown, speed) {
    let h = 0.0001;
    modes.forEach(mode => {
        let timePassed = (time - mode.last_impulse_time)*0.001;

        let w = mode.frequency * 2.0 * Math.PI;
        let m = mode.mass;
        let dt = h * (1.0 / w);
        
        let A11 = 1.0;
        let A12 = dt;
        let A21 = -w * w * dt;
        let A22 = 1.0 - 2.0 * mode.damping * w * dt;

        let qr = mode.y.re;
        let qi = mode.y.im;

        let nUpdates = Math.min(Math.floor(timePassed  / (speed * dt)), 100);

        let fsign = Math.sign(mode.last_impulse.re);
        if (fsign !== 0) {
            fsign = -fsign / Math.abs(fsign);
        }

        let impulseadd = dt * fsign * math.abs(mode.last_impulse) * 100.0;

        for (let i = 0; i < nUpdates; i++) {
            let qnr = A11 * qr + A12 * qi;
            let qni = A21 * qr + A22 * qi + impulseadd / m;
            qr = qnr;
            qi = qni;
        }

        mode.y = math.complex(qr, qi);
        mode.q_i = math.complex(mode.y.re, -mode.y.im / w);

        const magnitude = math.abs(mode.q_i);
        const phase = math.arg(mode.q_i);
        const adjustedPhase = (phase / (2 * Math.PI)) + 0.5;

        mode.q_i = math.complex({ r: magnitude, phi: adjustedPhase * 2 * Math.PI });
        mode.q_amp = magnitude;
        mode.q_phase = adjustedPhase;

        // Reset the old_impulse after simulation

        mode.last_impulse_time = time;
        // mode.last_impulse = mode.impulse;

    });
}


/*
/////////////////////////////
OLD
/////////////////////////////
*/

function update_mode_state_one_step(modal_f, dt, mode) {
    let w = mode.frequency * 2 * Math.PI;
    dt = dt * (1 / w);
    let A = [[1, dt], [-w * w * dt, 1 - 2*mode.damping * w * dt]];
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
    get_modal_force,
    update_mode_state_one_step,
    update_mode_state_time_step,
    update_state_time,
    update_state_one_step,
    setUnitModalCoordinate,
    // setDamping,
    // setMass,
    // setStrength,
    simulate13,
    applyInstantaneousForce,
    // directlySetQ,
    setProperties
};



