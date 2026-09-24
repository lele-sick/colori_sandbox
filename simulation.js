const canvas = document.getElementById("simulation");
const ctx = canvas.getContext("2d");


// ============================================================
// CONFIGURAZIONE
// ============================================================

const MIN_CIRCLE_RADIUS = 120;

const INTERACTION_DISTANCE = 180;

const MAX_SPEED = 700;

// Qualità della fisica
const MIN_SUBSTEPS = 2;          // sotto-passi minimi per frame
const MAX_SUBSTEPS = 10;         // sotto-passi massimi per frame
const COLLISION_ITERATIONS = 2;  // ripetizioni della risoluzione collisioni per passo
const REST_THRESHOLD = 60;       // sotto questa velocità (px/s) non c'è rimbalzo

// Mouse: attrazione / repulsione
const POINTER_FORCE = 2000;      // accelerazione (px/s²) verso / lontano dal cursore
const POINTER_DAMPING = 0.96;    // frenata per frame mentre le palline sono attratte
const POINTER_SOFT_RADIUS = 30;  // vicino al cursore la forza cala, per non far tremare le palline


// ============================================================
// CONTROLLI GUI
// ============================================================

const gravitySlider = document.getElementById("gravity");
const bounceSlider = document.getElementById("bounce");
const radiusSlider = document.getElementById("radius");
const colorForceSlider = document.getElementById("colorForce");
const ballCountSlider = document.getElementById("ballCount");
const ballSizeSlider = document.getElementById("ballSize");
const colorCountSlider = document.getElementById("colorCount");
const colorInteraction = document.getElementById("colorInteraction");
const circleButton = document.getElementById("circleButton");
const gyroButton = document.getElementById("gyroButton");

const gravityValue = document.getElementById("gravityValue");
const bounceValue = document.getElementById("bounceValue");
const radiusValue = document.getElementById("radiusValue");
const colorForceValue = document.getElementById("colorForceValue");
const ballCountValue = document.getElementById("ballCountValue");
const ballSizeValue = document.getElementById("ballSizeValue");
const colorCountValue = document.getElementById("colorCountValue");
const interactionLabel = document.getElementById("interactionLabel");


// ============================================================
// STATO DELLA SIMULAZIONE
// ============================================================

let width = 0;
let height = 0;

let centerX = 0;
let centerY = 0;

let availableRadius = 0;
let currentRadius = 200;

let balls = [];

// Se false: niente cerchio, le palline stanno nel rettangolo del canvas
let circleEnabled = true;

// Mouse sul canvas: mode = 1 attrae, -1 respinge, 0 niente
const pointer = { x: 0, y: 0, mode: 0 };

// Direzione della gravità (0, 1 = verso il basso).
// Con il giroscopio cambia in base all'inclinazione del telefono
let gravityDirX = 0;
let gravityDirY = 1;

let gyroEnabled = false;
let gyroReceived = false;

let lastTime = performance.now();


// ============================================================
// CONVERSIONE HUE → RGB
// ============================================================

function hueToRgb(h) {

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const q = 1 - f;

    let r, g, b;

    switch (i % 6) {
        case 0: r = 1; g = f; b = 0; break;
        case 1: r = q; g = 1; b = 0; break;
        case 2: r = 0; g = 1; b = f; break;
        case 3: r = 0; g = q; b = 1; break;
        case 4: r = f; g = 0; b = 1; break;
        case 5: r = 1; g = 0; b = q; break;
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}


// ============================================================
// DISTANZA CROMATICA (la ruota cromatica è circolare)
// ============================================================

function colorDistance(h1, h2) {

    const difference = Math.abs(h1 - h2);

    return Math.min(difference, 1 - difference);
}


// ============================================================
// COLORE CASUALE TRA N COLORI EQUIDISTANTI
// ============================================================

function randomHue() {

    const numberOfColors = Number(colorCountSlider.value);

    return Math.floor(Math.random() * numberOfColors) / numberOfColors;
}


// ============================================================
// CLASSE PALLINA
// ============================================================

class Ball {

    constructor(x, y, hue) {

        this.x = x;
        this.y = y;

        // Velocità iniziale casuale
        this.vx = (Math.random() - 0.5) * 80;
        this.vy = (Math.random() - 0.5) * 80;

        // Colore
        this.setHue(hue);

        // Dimensione dallo slider
        this.radius = Number(ballSizeSlider.value);
    }


    // ========================================================
    // COLORE
    // ========================================================

    setHue(hue) {

        this.hue = hue;

        const rgb = hueToRgb(hue);

        this.color = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }


    // ========================================================
    // AGGIORNAMENTO FISICO
    // ========================================================

    update(dt, friction) {

        const gravity = Number(gravitySlider.value);

        // Gravità
        this.vx += gravity * gravityDirX * dt;
        this.vy += gravity * gravityDirY * dt;

        // Movimento
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.collideWithWall(friction);
    }


    // ========================================================
    // COLLISIONE CON IL BORDO DEL CERCHIO
    // ========================================================

    collideWithWall(friction) {

        const restitution = Number(bounceSlider.value);

        // ----------------------------------------------------
        // SENZA CERCHIO: pareti rettangolari (bordi del canvas)
        // ----------------------------------------------------

        if (!circleEnabled) {

            const minX = this.radius;
            const maxX = width - this.radius;
            const minY = this.radius;
            const maxY = height - this.radius;

            let hit = false;

            if (this.x < minX) {
                this.x = minX;
                if (this.vx < 0) {
                    this.vx = -this.vx * (-this.vx < REST_THRESHOLD ? 0 : restitution);
                }
                hit = true;
            } else if (this.x > maxX) {
                this.x = maxX;
                if (this.vx > 0) {
                    this.vx = -this.vx * (this.vx < REST_THRESHOLD ? 0 : restitution);
                }
                hit = true;
            }

            if (this.y < minY) {
                this.y = minY;
                if (this.vy < 0) {
                    this.vy = -this.vy * (-this.vy < REST_THRESHOLD ? 0 : restitution);
                }
                hit = true;
            } else if (this.y > maxY) {
                this.y = maxY;
                if (this.vy > 0) {
                    this.vy = -this.vy * (this.vy < REST_THRESHOLD ? 0 : restitution);
                }
                hit = true;
            }

            if (hit) {
                this.vx *= friction;
                this.vy *= friction;
            }

            return;
        }

        // ----------------------------------------------------
        // CON CERCHIO
        // ----------------------------------------------------

        const dx = this.x - centerX;
        const dy = this.y - centerY;

        const distance = Math.sqrt(dx * dx + dy * dy);

        const maxDistance = currentRadius - this.radius;

        if (distance > maxDistance && distance > 0) {

            // Normale del bordo
            const nx = dx / distance;
            const ny = dy / distance;

            // Riporta la pallina dentro il cerchio
            this.x = centerX + nx * maxDistance;
            this.y = centerY + ny * maxDistance;

            // Velocità lungo la normale
            const velocityNormal = this.vx * nx + this.vy * ny;

            // Rimbalzo (nessun rimbalzo se l'urto è molto lento)
            if (velocityNormal > 0) {

                const e = velocityNormal < REST_THRESHOLD ? 0 : restitution;

                this.vx -= (1 + e) * velocityNormal * nx;
                this.vy -= (1 + e) * velocityNormal * ny;
            }

            // Piccolo attrito
            this.vx *= friction;
            this.vy *= friction;
        }
    }


    // ========================================================
    // DISEGNO
    // ========================================================

    draw() {

        // Pallina
        ctx.beginPath();

        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        ctx.fillStyle = this.color;
        ctx.fill();
    }
}


// ============================================================
// PUNTO CASUALE DENTRO L'AREA DI GIOCO
// ============================================================

function randomSpawnPoint(ballRadius) {

    // Rettangolo (senza cerchio)
    if (!circleEnabled) {

        return {
            x: ballRadius + Math.random() * Math.max(1, width - 2 * ballRadius),
            y: ballRadius + Math.random() * Math.max(1, height - 2 * ballRadius)
        };
    }

    // Cerchio
    const spawnRadius = Math.max(10, currentRadius - ballRadius - 2);

    while (true) {

        const x = centerX + (Math.random() * 2 - 1) * spawnRadius;
        const y = centerY + (Math.random() * 2 - 1) * spawnRadius;

        const dx = x - centerX;
        const dy = y - centerY;

        if (Math.sqrt(dx * dx + dy * dy) <= spawnRadius) {
            return { x, y };
        }
    }
}


// ============================================================
// CREAZIONE PALLINE
// ============================================================

function createBalls() {

    balls = [];

    const ballRadius = Number(ballSizeSlider.value);

    const numberOfBalls = Number(ballCountSlider.value);

    for (let i = 0; i < numberOfBalls; i++) {

        const point = randomSpawnPoint(ballRadius);

        // Colore casuale tra quelli disponibili
        balls.push(new Ball(point.x, point.y, randomHue()));
    }
}


// ============================================================
// GRIGLIA SPAZIALE
// Evita di confrontare ogni pallina con tutte le altre:
// si controllano solo le palline nella stessa cella o in quelle vicine
// ============================================================

// Celle vicine da controllare (metà intorno, così ogni coppia compare una sola volta)
const HALF_X = [1, -1, 0, 1];
const HALF_Y = [0, 1, 1, 1];


function buildGrid(cellSize) {

    if (balls.length === 0) {
        return { cols: 0, rows: 0, head: new Int32Array(0), next: new Int32Array(0) };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const ball of balls) {
        if (ball.x < minX) minX = ball.x;
        if (ball.x > maxX) maxX = ball.x;
        if (ball.y < minY) minY = ball.y;
        if (ball.y > maxY) maxY = ball.y;
    }

    const cols = Math.floor((maxX - minX) / cellSize) + 1;
    const rows = Math.floor((maxY - minY) / cellSize) + 1;

    // head[cella] = prima pallina della cella, next[i] = pallina successiva
    const head = new Int32Array(cols * rows).fill(-1);
    const next = new Int32Array(balls.length);

    for (let i = 0; i < balls.length; i++) {

        const cx = Math.floor((balls[i].x - minX) / cellSize);
        const cy = Math.floor((balls[i].y - minY) / cellSize);

        const cell = cy * cols + cx;

        next[i] = head[cell];
        head[cell] = i;
    }

    return { cols, rows, head, next };
}


function forEachNearbyPair(grid, callback) {

    const { cols, rows, head, next } = grid;

    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {

            let i = head[cy * cols + cx];

            while (i !== -1) {

                // Stessa cella
                let j = next[i];

                while (j !== -1) {
                    callback(i, j);
                    j = next[j];
                }

                // Celle vicine
                for (let k = 0; k < 4; k++) {

                    const nx = cx + HALF_X[k];
                    const ny = cy + HALF_Y[k];

                    if (nx < 0 || nx >= cols || ny >= rows) {
                        continue;
                    }

                    j = head[ny * cols + nx];

                    while (j !== -1) {
                        callback(i, j);
                        j = next[j];
                    }
                }

                i = next[i];
            }
        }
    }
}


// ============================================================
// ATTRAZIONE / REPULSIONE TRA COLORI
// ============================================================

function applyColorForces(dt) {

    if (!colorInteraction.checked) {
        return;
    }

    const colorForce = Number(colorForceSlider.value);

    // Potenza 0: niente da calcolare
    if (colorForce === 0) {
        return;
    }

    const forceX = new Float64Array(balls.length);
    const forceY = new Float64Array(balls.length);

    const grid = buildGrid(INTERACTION_DISTANCE);

    forEachNearbyPair(grid, (i, j) => {

        const ballA = balls[i];
        const ballB = balls[j];

        const dx = ballB.x - ballA.x;
        const dy = ballB.y - ballA.y;

        const distanceSquared = dx * dx + dy * dy;

        // Evita divisione per zero e ignora le palline lontane
        if (
            distanceSquared < 0.000001 ||
            distanceSquared > INTERACTION_DISTANCE * INTERACTION_DISTANCE
        ) {
            return;
        }

        const distance = Math.sqrt(distanceSquared);

        // Direzione
        const nx = dx / distance;
        const ny = dy / distance;

        // Distanza tra i colori
        // 0.0 = stesso colore | 0.25 = soglia | 0.5 = colore opposto
        const colorDist = colorDistance(ballA.hue, ballB.hue);

        let colorFactor;

        if (colorDist < 0.25) {

            // Attrazione
            colorFactor = 1 - colorDist / 0.25;

        } else {

            // Repulsione
            colorFactor = -((colorDist - 0.25) / 0.25);
        }

        colorFactor = Math.max(-1, Math.min(1, colorFactor));

        // Forza in base alla distanza
        const distanceFactor =
            Math.max(0, 1 - distance / INTERACTION_DISTANCE);

        // Forza finale
        const force = colorForce * 2.0 * colorFactor * distanceFactor;

        // Azione e reazione: uguali e opposte
        forceX[i] += nx * force;
        forceY[i] += ny * force;

        forceX[j] -= nx * force;
        forceY[j] -= ny * force;
    });

    for (let i = 0; i < balls.length; i++) {

        const ball = balls[i];

        // Applica la forza
        ball.vx += forceX[i] * dt;
        ball.vy += forceY[i] * dt;

        // Limite velocità
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

        if (speed > MAX_SPEED) {

            ball.vx = ball.vx / speed * MAX_SPEED;
            ball.vy = ball.vy / speed * MAX_SPEED;
        }
    }
}


// ============================================================
// COLLISIONE TRA DUE PALLINE
// ============================================================

function ballCollision(a, b) {

    const dx = b.x - a.x;
    const dy = b.y - a.y;

    const minDistance = a.radius + b.radius;

    // Nessuna collisione (controllo veloce, senza radice quadrata)
    if (dx * dx + dy * dy >= minDistance * minDistance) {
        return;
    }

    const distance = Math.sqrt(dx * dx + dy * dy);

    // Caso speciale: due palline esattamente sovrapposte
    if (distance === 0) {

        const angle = Math.random() * Math.PI * 2;

        a.x += Math.cos(angle) * 0.1;
        a.y += Math.sin(angle) * 0.1;

        return;
    }

    // Normale
    const nx = dx / distance;
    const ny = dy / distance;

    // Separazione
    const overlap = minDistance - distance;

    a.x -= nx * overlap / 2;
    a.y -= ny * overlap / 2;

    b.x += nx * overlap / 2;
    b.y += ny * overlap / 2;

    // Velocità relativa
    const relativeVx = b.vx - a.vx;
    const relativeVy = b.vy - a.vy;

    const relativeVelocity = relativeVx * nx + relativeVy * ny;

    // Se si stanno già allontanando
    if (relativeVelocity > 0) {
        return;
    }

    // Impulso
    // Sotto una certa velocità niente rimbalzo:
    // evita il "tremolio" delle palline appoggiate
    const restitution =
        -relativeVelocity < REST_THRESHOLD
            ? 0
            : Number(bounceSlider.value);

    const impulse = -(1 + restitution) * relativeVelocity / 2;

    const impulseX = impulse * nx;
    const impulseY = impulse * ny;

    a.vx -= impulseX;
    a.vy -= impulseY;

    b.vx += impulseX;
    b.vy += impulseY;
}


// ============================================================
// RESIZE CANVAS
// ============================================================

function resizeCanvas() {

    const rect = canvas.getBoundingClientRect();

    width = rect.width;
    height = rect.height;

    // Device pixel ratio
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Centro del cerchio
    centerX = width / 2;
    centerY = height / 2;

    // Raggio massimo disponibile (margine ridotto a 15px)
    availableRadius = Math.min(width / 2 - 15, height / 2 - 15);
    availableRadius = Math.max(MIN_CIRCLE_RADIUS, availableRadius);

    // Il massimo dello slider segue lo spazio disponibile.
    // Se il valore corrente supera il nuovo massimo, il browser lo riduce da solo.
    radiusSlider.max = Math.floor(availableRadius);
    radiusValue.textContent = Math.round(Number(radiusSlider.value));

    // Raggio effettivo
    currentRadius = Math.min(
        Number(radiusSlider.value),
        availableRadius
    );

    // Mantieni le palline dentro l'area di gioco
    for (const ball of balls) {
        ball.collideWithWall(1);
    }
}


// ============================================================
// DISEGNO
// ============================================================

function draw() {

    // Sfondo
    ctx.clearRect(0, 0, width, height);

    // Cerchio (solo se attivo)
    if (circleEnabled) {

        ctx.beginPath();

        ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);

        ctx.fillStyle = "#fafafa";
        ctx.fill();

        ctx.strokeStyle = "#282828";
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    // Palline
    for (const ball of balls) {
        ball.draw();
    }
}


// ============================================================
// ANIMAZIONE
// ============================================================

function animate(timestamp) {

    // Delta time
    let dt = (timestamp - lastTime) / 1000;

    lastTime = timestamp;

    // Evita salti quando la finestra viene bloccata/ridimensionata
    dt = Math.max(0, Math.min(dt, 0.03));

    // Forze cromatiche (una volta per frame)
    applyColorForces(dt);

    // Mouse
    applyPointerForce(dt);

    // Sotto-passi: a ogni passo nessuna pallina deve muoversi
    // più del proprio raggio, altrimenti attraversa le altre
    let maxSpeed = 0;
    let minRadius = Infinity;
    let maxRadius = 0;

    for (const ball of balls) {
        maxSpeed = Math.max(maxSpeed, Math.hypot(ball.vx, ball.vy));
        minRadius = Math.min(minRadius, ball.radius);
        maxRadius = Math.max(maxRadius, ball.radius);
    }

    // Celle grandi almeno quanto due palline (più un piccolo margine)
    const collisionCellSize = maxRadius * 2 + 4;

    const collide = (i, j) => ballCollision(balls[i], balls[j]);

    const steps = Math.min(
        MAX_SUBSTEPS,
        Math.max(MIN_SUBSTEPS, Math.ceil(maxSpeed * dt / minRadius))
    );

    const subDt = dt / steps;

    // Attrito indipendente dal frame rate
    const friction = Math.pow(0.995, subDt * 60);

    for (let s = 0; s < steps; s++) {

        // Movimento e bordo
        for (const ball of balls) {
            ball.update(subDt, friction);
        }

        // Collisioni (ripetute per gestire le palline ammassate)
        for (let k = 0; k < COLLISION_ITERATIONS; k++) {

            forEachNearbyPair(buildGrid(collisionCellSize), collide);

            // Le collisioni possono spingere le palline oltre il bordo
            for (const ball of balls) {
                ball.collideWithWall(1);
            }
        }
    }

    draw();

    requestAnimationFrame(animate);
}


// ============================================================
// EVENTI SLIDER
// ============================================================

gravitySlider.addEventListener("input", () => {

    gravityValue.textContent = Math.round(Number(gravitySlider.value));
});


bounceSlider.addEventListener("input", () => {

    bounceValue.textContent = Number(bounceSlider.value).toFixed(2);
});


radiusSlider.addEventListener("input", () => {

    radiusValue.textContent = Math.round(Number(radiusSlider.value));

    resizeCanvas();
});


colorForceSlider.addEventListener("input", () => {

    colorForceValue.textContent = Math.round(Number(colorForceSlider.value));
});


ballCountSlider.addEventListener("input", () => {

    ballCountValue.textContent = Number(ballCountSlider.value);

    // Ricrea le palline con il nuovo numero
    createBalls();
});


ballSizeSlider.addEventListener("input", () => {

    const size = Number(ballSizeSlider.value);

    ballSizeValue.textContent = size;

    // Ridimensiona le palline esistenti
    for (const ball of balls) {
        ball.radius = size;
    }

    // Riporta dentro il cerchio le palline che sporgono
    resizeCanvas();
});


colorCountSlider.addEventListener("input", () => {

    colorCountValue.textContent = Number(colorCountSlider.value);

    // Riassegna i colori alle palline esistenti
    // senza cambiarne posizione e velocità
    for (const ball of balls) {
        ball.setHue(randomHue());
    }
});


colorInteraction.addEventListener("change", () => {

    interactionLabel.textContent = colorInteraction.checked
        ? "Interazione colori: ON"
        : "Interazione colori: OFF";
});


// ============================================================
// RESET
// ============================================================

function reset() {

    createBalls();
}


document.getElementById("resetButton").addEventListener("click", reset);


circleButton.addEventListener("click", () => {

    circleEnabled = !circleEnabled;

    circleButton.textContent =
        circleEnabled ? "Cerchio: ON" : "Cerchio: OFF";

    // Il raggio non serve senza cerchio
    radiusSlider.disabled = !circleEnabled;

    if (circleEnabled) {

        // Sposta dentro il cerchio le palline che sono rimaste fuori
        for (const ball of balls) {

            const dx = ball.x - centerX;
            const dy = ball.y - centerY;

            if (Math.sqrt(dx * dx + dy * dy) > currentRadius - ball.radius) {

                const point = randomSpawnPoint(ball.radius);

                ball.x = point.x;
                ball.y = point.y;
            }
        }
    }
});


document.addEventListener("keydown", (event) => {

    if (event.key.toLowerCase() === "r") {
        reset();
    }
});


// ============================================================
// RESIZE DELLA FINESTRA
// ============================================================

window.addEventListener("resize", () => {

    resizeCanvas();
});


// ============================================================
// MOUSE: TASTO DESTRO ATTIRA, TASTO SINISTRO RESPINGE
// ============================================================

function updatePointer(event) {

    // Solo mouse (il tocco sul telefono continua a scorrere la pagina)
    if (event.pointerType !== "mouse") {
        return;
    }

    const rect = canvas.getBoundingClientRect();

    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;

    // buttons: 1 = sinistro, 2 = destro
    if (event.buttons & 2) {
        pointer.mode = 1;
    } else if (event.buttons & 1) {
        pointer.mode = -1;
    } else {
        pointer.mode = 0;
    }
}


canvas.addEventListener("pointerdown", (event) => {

    if (event.pointerType === "mouse") {

        // Continua a ricevere gli eventi anche fuori dal canvas
        canvas.setPointerCapture(event.pointerId);
    }

    updatePointer(event);
});

canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerup", updatePointer);

canvas.addEventListener("pointercancel", () => {
    pointer.mode = 0;
});

// Niente menu del tasto destro sopra la simulazione
canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});


function applyPointerForce(dt) {

    if (pointer.mode === 0) {
        return;
    }

    const damping = Math.pow(POINTER_DAMPING, dt * 60);

    for (const ball of balls) {

        const dx = pointer.x - ball.x;
        const dy = pointer.y - ball.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.001) {
            continue;
        }

        // Direzione verso il cursore (attrazione) o opposta (repulsione)
        const nx = dx / distance * pointer.mode;
        const ny = dy / distance * pointer.mode;

        // Vicino al cursore la forza si riduce (solo in attrazione)
        const soft = pointer.mode === 1
            ? Math.min(1, distance / POINTER_SOFT_RADIUS)
            : 1;

        ball.vx += nx * POINTER_FORCE * soft * dt;
        ball.vy += ny * POINTER_FORCE * soft * dt;

        // In attrazione le palline si fermano vicino al cursore
        // invece di oscillare all'infinito
        if (pointer.mode === 1) {
            ball.vx *= damping;
            ball.vy *= damping;
        }

        // Limite velocità
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

        if (speed > MAX_SPEED) {
            ball.vx = ball.vx / speed * MAX_SPEED;
            ball.vy = ball.vy / speed * MAX_SPEED;
        }
    }
}


// ============================================================
// GRAVITÀ COL GIROSCOPIO (SOLO MOBILE)
// ============================================================

function screenAngle() {

    const orientation = window.screen && window.screen.orientation;

    if (orientation && typeof orientation.angle === "number") {
        return orientation.angle;
    }

    return Number(window.orientation) || 0;
}


function onDeviceOrientation(event) {

    if (event.beta === null || event.gamma === null) {
        return;
    }

    gyroReceived = true;

    const beta = event.beta * Math.PI / 180;    // inclinazione avanti/indietro
    const gamma = event.gamma * Math.PI / 180;  // inclinazione destra/sinistra

    // Componenti della gravità sul piano dello schermo
    // (telefono in verticale: x verso destra, y verso il basso).
    // Telefono in piano = nessuna gravità, in verticale = gravità piena.
    const gx = Math.sin(gamma) * Math.cos(beta);
    const gy = Math.sin(beta);

    // Compensa la rotazione dello schermo (verticale / orizzontale)
    switch (screenAngle()) {

        case 90:
            gravityDirX = gy;
            gravityDirY = -gx;
            break;

        case 180:
        case -180:
            gravityDirX = -gx;
            gravityDirY = -gy;
            break;

        case 270:
        case -90:
            gravityDirX = -gy;
            gravityDirY = gx;
            break;

        default:
            gravityDirX = gx;
            gravityDirY = gy;
    }
}


function setGyroState(on) {

    gyroEnabled = on;

    gyroButton.textContent = on ? "Giroscopio: ON" : "Giroscopio: OFF";
    gyroButton.classList.toggle("active", on);

    if (on) {

        gyroReceived = false;

        window.addEventListener("deviceorientation", onDeviceOrientation);

        // Se dopo un po' non arriva nessun dato, il sensore non è utilizzabile
        setTimeout(() => {

            if (gyroEnabled && !gyroReceived) {

                setGyroState(false);

                window.alert(
                    "Nessun dato dal giroscopio. Il browser lo permette solo " +
                    "su pagine HTTPS (o localhost) e su dispositivi con sensore."
                );
            }
        }, 1500);

    } else {

        window.removeEventListener("deviceorientation", onDeviceOrientation);

        // Torna la gravità normale, verso il basso
        gravityDirX = 0;
        gravityDirY = 1;
    }
}


async function startGyro() {

    if (window.isSecureContext === false) {

        window.alert(
            "Il giroscopio funziona solo se la pagina è servita in HTTPS " +
            "(o da localhost)."
        );

        return;
    }

    // iOS chiede il permesso, e solo dopo un tocco dell'utente
    const DeviceOrientation = window.DeviceOrientationEvent;

    if (DeviceOrientation && typeof DeviceOrientation.requestPermission === "function") {

        try {

            const answer = await DeviceOrientation.requestPermission();

            if (answer !== "granted") {

                window.alert("Permesso per il giroscopio negato.");

                return;
            }

        } catch (error) {

            window.alert("Impossibile ottenere il permesso per il giroscopio.");

            return;
        }
    }

    // La gravità a 0 non farebbe vedere nessun effetto
    if (Number(gravitySlider.value) === 0) {

        gravitySlider.value = 100;

        gravitySlider.dispatchEvent(new Event("input", { bubbles: true }));
    }

    setGyroState(true);
}


gyroButton.addEventListener("click", () => {

    if (gyroEnabled) {
        setGyroState(false);
    } else {
        startGyro();
    }
});


// Il pulsante compare solo su dispositivi touch con il sensore
if (
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches &&
    "DeviceOrientationEvent" in window
) {
    gyroButton.hidden = false;
}


// ============================================================
// ROTELLA DEL MOUSE SUGLI SLIDER
// ============================================================

// Quanti "scatti" di rotella servono per percorrere tutto lo slider
const WHEEL_NOTCHES = 50;

document.querySelectorAll('input[type="range"]').forEach((slider) => {

    slider.addEventListener("wheel", (event) => {

        if (slider.disabled) {
            return;
        }

        // Evita che la pagina scorra mentre si regola lo slider
        event.preventDefault();

        const min = Number(slider.min);
        const max = Number(slider.max);
        const step = Number(slider.step) || 1;

        // Ogni scatto sposta lo slider di circa 1/50 della sua corsa
        // (almeno di uno step)
        const stepsPerNotch =
            Math.max(1, Math.round((max - min) / step / WHEEL_NOTCHES));

        // Rotella in su = aumenta, in giù = diminuisce
        const direction = (event.deltaY || event.deltaX) < 0 ? 1 : -1;

        const newValue = Math.max(
            min,
            Math.min(max, Number(slider.value) + direction * stepsPerNotch * step)
        );

        slider.value = newValue;

        // Fa scattare gli stessi gestori del trascinamento
        slider.dispatchEvent(new Event("input", { bubbles: true }));

    }, { passive: false });
});


// ============================================================
// INIZIALIZZAZIONE VALORI GUI
// ============================================================

gravityValue.textContent = Math.round(Number(gravitySlider.value));
bounceValue.textContent = Number(bounceSlider.value).toFixed(2);
radiusValue.textContent = Math.round(Number(radiusSlider.value));
colorForceValue.textContent = Math.round(Number(colorForceSlider.value));
ballCountValue.textContent = Number(ballCountSlider.value);
ballSizeValue.textContent = Number(ballSizeSlider.value);
colorCountValue.textContent = Number(colorCountSlider.value);


// ============================================================
// AVVIO
// ============================================================

resizeCanvas();

// Raggio massimo di default: lo slider ha già il massimo
// calcolato sullo spazio disponibile, lo portiamo al massimo
radiusSlider.value = radiusSlider.max;

resizeCanvas();

createBalls();

requestAnimationFrame(animate);
