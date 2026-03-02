const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// Force crisp pixel-art scaling on browser draw instead of default blurry anti-aliasing
ctx.imageSmoothingEnabled = false;
const currentHeightDisplay = document.getElementById('current-height');
const currentGoldDisplay = document.getElementById('current-gold');
const startBtn = document.getElementById('start-btn');
const uiOverlay = document.getElementById('ui-overlay');
const shopOverlay = document.getElementById('shop-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const goScore = document.getElementById('go-score');
const goHighScore = document.getElementById('go-high-score');
const goScoreHolder = document.getElementById('go-score-holder');
const goYourName = document.getElementById('go-your-name');
const playAgainBtn = document.getElementById('play-again-btn');
const goShopBtn = document.getElementById('go-shop-btn');
const changeNameText = document.getElementById('change-name-text');
const hsForm = document.getElementById('new-high-score-form');
const hsInput = document.getElementById('hs-name-input');
const hsSubmitBtn = document.getElementById('hs-submit-btn');
const goStatsWrap = document.getElementById('game-over-stats');

// Keep gameplay bounds fixed, use CSS to scale uniformly without stretching vertically
const logicalWidth = 280;
const logicalHeight = 420; 

function resizeCanvas() {
    const container = document.getElementById('game-container') || canvas;

    const scale = Math.min(
        window.innerWidth / logicalWidth,
        window.innerHeight / logicalHeight
    );

    container.style.width = (logicalWidth * scale) + 'px';
    container.style.height = (logicalHeight * scale) + 'px';

    canvas.width = logicalWidth;
    canvas.height = logicalHeight;
    ctx.imageSmoothingEnabled = false; // Fix pixel art aliasing on resize
}
window.addEventListener('resize', resizeCanvas);
canvas.width = logicalWidth;
canvas.height = logicalHeight;
ctx.imageSmoothingEnabled = false; // Fix pixel art aliasing globally
resizeCanvas();

let score = 0, totalGold = parseInt(localStorage.getItem("pirateJumpGold") || "0"), highScore = parseInt(localStorage.getItem("pirateJumpHigh") || "0"), gameActive = false, tiltX = 0, keys = {};
let highScoreName = localStorage.getItem("pirateJumpName") || "Pirate";
let currentPlayerName = localStorage.getItem("pirateJumpPlayerName") || "Pirate";
let platforms = [], enemies = [], coins = [], items = [], selectedHat = localStorage.getItem("pirateJumpHat") || 'pirate';
let ownedHats = JSON.parse(localStorage.getItem("pirateJumpOwnedHats") || '["pirate"]');

const hats = {
    pirate: { name: "Classic Hat", price: 0, color: "#212121" },
    viking: { name: "Viking Horns", price: 500, color: "#9e9e9e" },
    chef: { name: "Chef's Toque", price: 1500, color: "#ffffff" },
    crown: { name: "Royal Crown", price: 5000, color: "#ffd700" }
};

const images = { platform: new Image(), breakingPlatform: new Image(), enemy: new Image(), powerup: new Image(), plank: new Image(), coin: new Image(),
    playerLeft: new Image(), playerRight: new Image(), cannon: new Image(), cannonball: new Image(), island: new Image(),
    bgSky: new Image(), bgClouds: new Image(), bgSpace: new Image(), oceanWaves: new Image(),
    pirate: new Image(), viking: new Image(), chef: new Image(), crown: new Image()
};
let imagesLoaded = 0;
const totalImages = 19;
function loadProcessedImage(imgObj, src) {
    const tempImg = new Image();
    tempImg.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = tempImg.width; tempCanvas.height = tempImg.height;
        const tCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
        tCtx.drawImage(tempImg, 0, 0);
        const imgData = tCtx.getImageData(0, 0, tempImg.width, tempImg.height);
        const data = imgData.data;
        const r = data[0], g = data[1], b = data[2], a = data[3];
        // Only strip the background color if the top-left pixel is actually solid
        if (a > 200) {
            let isMagentaKey = (r > 200 && g < 50 && b > 200);
            for (let i = 0; i < data.length; i += 4) {
                if (isMagentaKey) {
                    let pr = data[i], pg = data[i+1], pb = data[i+2];
                    // Magenta is Red + Blue. Spill is the excess of magenta over green
                    let spill = Math.max(0, Math.min(pr, pb) - pg);
                    if (spill > 0) {
                        // Suppress the purple tint from the heavily anti-aliased edge pixels
                        data[i] = Math.max(0, data[i] - spill);
                        data[i+2] = Math.max(0, data[i+2] - spill);
                        // Feather the alpha based on the amount of spill removed
                        data[i+3] = Math.max(0, data[i+3] - spill * 1.5);
                    }
                } else {
                    // Standard solid key for grey backgrounds
                    if (Math.abs(data[i] - r) < 30 && Math.abs(data[i+1] - g) < 30 && Math.abs(data[i+2] - b) < 30) {
                        data[i+3] = 0;
                    }
                }
            }
        }
        tCtx.putImageData(imgData, 0, 0);

        // Perform a sharp Nearest-Neighbor 2x Upscale on the transparent asset
        // This physically bakes the blocky aesthetic into the texture, preventing browser anti-aliasing on small sprites
        const upscaleCanvas = document.createElement('canvas');
        upscaleCanvas.width = tempImg.width * 2;
        upscaleCanvas.height = tempImg.height * 2;
        const uCtx = upscaleCanvas.getContext('2d');
        uCtx.imageSmoothingEnabled = false; // CRUCIAL for pixel art
        uCtx.drawImage(tempCanvas, 0, 0, tempImg.width, tempImg.height, 0, 0, upscaleCanvas.width, upscaleCanvas.height);

        imgObj.onload = () => { imagesLoaded++; };
        imgObj.src = upscaleCanvas.toDataURL('image/png');
    };
    tempImg.src = src;
}

function loadRawImage(imgObj, src) {
    imgObj.onload = () => { imagesLoaded++; };
    imgObj.src = src;
}

// Web Audio API Synthesizer for retro sounds
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    
    if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'plank') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'flap') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'shield_break') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'powerup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'cannon') {
        // Modern, deep cinematic explosion boom
        let duration = 0.8;
        
        // 1. Transient sub-bass punch (Sine wave dropping rapidly in pitch)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);
        
        // 2. White noise blast layer
        let bufferSize = audioCtx.sampleRate * duration;
        let noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        let output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1; // White noise
        }
        let noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        
        // Filter the noise to sound muffled and explosive, not hissy
        let noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1200, audioCtx.currentTime);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + duration);
        
        // Noise volume envelope
        let noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(1.5, audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        
        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination); // Connect noise directly to destination, not through main gainNode
        noiseSrc.start();
        
        // Main boom volume envelope (for the sine wave)
        gainNode.gain.setValueAtTime(1.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }
}

loadProcessedImage(images.platform, 'assets/platform.png');
loadProcessedImage(images.breakingPlatform, 'assets/breaking.png');
loadProcessedImage(images.enemy, 'assets/ghost.png');
loadProcessedImage(images.powerup, 'assets/powerup.png');
loadProcessedImage(images.cannon, 'assets/cannon.png');
loadProcessedImage(images.cannonball, 'assets/cannonball.png');
loadProcessedImage(images.plank, 'assets/plank.png');
loadProcessedImage(images.coin, 'assets/coin.png');
loadProcessedImage(images.playerLeft, 'assets/player_left.png');
loadProcessedImage(images.playerRight, 'assets/player_right.png');
loadProcessedImage(images.pirate, 'assets/pirate_hat.png');
loadProcessedImage(images.viking, 'assets/viking_hat.png');
loadProcessedImage(images.chef, 'assets/chef_hat.png');
loadProcessedImage(images.crown, 'assets/crown_hat.png');
loadProcessedImage(images.island, 'assets/island.png');

loadProcessedImage(images.oceanWaves, 'assets/ocean_waves.png?v=2');
loadRawImage(images.bgSky, 'assets/bg_sky.png?v=2');
loadRawImage(images.bgClouds, 'assets/bg_clouds.png');
loadRawImage(images.bgSpace, 'assets/bg_space.png');

// Delta-Time Physics matching Doodle Jump specifications in Pixels Per Second
const GRAVITY = 1800; 
const JUMP_STRENGTH = -720; 
const SPRING_STRENGTH = -1080; 
const MOVE_SPEED = 360;
const TILT_SPEED = 500; // Scaled down from 720, provides a controlled max speed slightly faster than keyboard
const PARROT_SPEED = -650;
const PLATFORM_W = 50; // Standard Doodle Jump platform width
const STARTER_W = 120; // Massive safe starter platform

// GSAP Powerup Animation object
const powerupAnim = { scale: 1 };

const player = { x: 0, y: 0, w: 35, h: 35, vx: 0, vy: 0, parrotTimer: 0, deathTimer: 0, dead: false, hasShield: false, plankFlip: 0, lastDir: 'right', lastY: 0 };
let highScoreY = 0;
let islands = [];
let cannons = []; // Array of pirate ship cannons
let cannonballs = []; // Fired projectiles

function spawnIsland(y) {
    let w = 80 + Math.random() * 80;
    let x = Math.random() < 0.5 ? Math.random() * 30 - 30 : logicalWidth - w + Math.random() * 30;
    return { x, y, w, h: w }; 
}

function spawnPlatform(y, isFirst = false, isStarter = false) {
    let width = isStarter ? STARTER_W : PLATFORM_W;
    let plat = {
        x: (isFirst || isStarter) ? (logicalWidth / 2 - width / 2) : Math.random() * (logicalWidth - width),
        y: y,
        w: width, 
        h: 15,
        type: 'normal',
        dir: Math.random() > 0.5 ? 1 : -1,
        hasPlank: false,
        plankAnim: 0, // Spring deployment animation
        hasShield: false,
        hasParrot: false,
        broken: false,
        vy: 0, 
        isStarter: isStarter
    };
    
    if (isStarter) return plat; // Starter platform is always purely normal and safe
    
    // Mutually exclusive powerups
    if (!isFirst) {
        let pRoll = Math.random();
        if (pRoll < 0.05) plat.hasShield = true;
        else if (pRoll < 0.10) plat.hasParrot = true;
    }

    if (!isFirst) {
        // difficulty ranges from 0 to 1 based on score up to 20,000
        let difficulty = Math.min(score / 20000, 1); 
        
        // Base probabilities
        let pSpring = 0.05;
        let pBreaking = 0.10 + (difficulty * 0.10); // Starts at 10%, goes to 20%
        let pMoving = 0.05 + (difficulty * 0.35); // Starts at 5%, goes up to 40%
        
        let pStandard = 1.0 - (pSpring + pBreaking + pMoving);
        if (pStandard < 0.20) pStandard = 0.20; // Always guarantee at least 20% normal platforms

        let roll = Math.random();
        
        if (roll < pSpring) {
            plat.type = 'normal';
            if (!plat.hasShield && !plat.hasParrot) plat.hasPlank = true; // Mutually exclusive from other powerups
        } else if (roll < pSpring + pBreaking) {
            plat.type = 'breaking';
            plat.hasShield = false; plat.hasParrot = false; // No powerups on breaking
        } else if (roll < pSpring + pBreaking + pMoving) {
            plat.type = 'moving';
        } else {
            plat.type = 'normal';
        }
    }

    return plat;
}

function spawnEnemy(y) {
    let difficulty = Math.min(score / 8000, 1);
    // 5% base chance, up to 15% max to reduce chaotic multi-spawns
    if (Math.random() < 0.05 + (difficulty * 0.10)) {
        enemies.push({
            x: Math.random() * (logicalWidth - 40),
            y: y - 60,
            w: 35, h: 35,
            bob: Math.random() * Math.PI,
            vx: (Math.random() - 0.5) * (1.5 + difficulty)
        });
    }
}

function spawnCannon(y) {
    let difficulty = Math.min(score / 15000, 1);
    // Cannons don't spawn early at all, eventually scale up to a 15% chance per chunk
    if (score > 4000 && Math.random() < (difficulty * 0.15)) {
        let isLeft = Math.random() > 0.5;
        cannons.push({
            x: isLeft ? -10 : logicalWidth - 50,
            y: y,
            w: 60, 
            h: 40,
            dir: isLeft ? 1 : -1, // 1 shoots right, -1 shoots left
            fireTimer: Math.random() * 1.0 + 0.5, // 0.5s to 1.5s random initial fuse
            cooldownTimer: 0 // Will constantly reload and fire
        });
    }
}

function spawnCoin(y) {
    if (Math.random() < 0.3) { // 30% chance for a coin
        coins.push({
            x: Math.random() * (logicalWidth - 20) + 10,
            y: y - 80,
            w: 20, h: 20,
            bob: Math.random() * Math.PI,
            collected: false
        });
    }
}

function initGame() {
    platforms = []; enemies = []; coins = []; islands = []; cannons = []; cannonballs = []; score = 0;
    
    // The massive safe starter platform strictly at the bottom
    let currentY = logicalHeight - 30; // Slightly higher up for safety on zoomed screen
    platforms.push(spawnPlatform(currentY, true, true)); 
    
    // Seed initial parallax islands spanning down past the camera
    for (let i = 0; i < 4; i++) {
        islands.push(spawnIsland(logicalHeight - i * 250));
    }
    
    // Initial tight, easy cluster of completely safe normal platforms
    for (let i = 1; i < 15; i++) {
        currentY -= (40 + Math.random() * 20); // Very tight 40-60px gaps
        platforms.push(spawnPlatform(currentY));
    }
    
    // Player starts exactly on the center of the first massive platform
    player.x = platforms[0].x + (STARTER_W / 2) - (player.w / 2);
    player.y = platforms[0].y - player.h;
    player.vx = 0; player.parrotTimer = 0;
    player.dead = false;
    player.hasShield = false;
    player.plankFlip = 0;
    highScoreY = (logicalHeight / 2) - highScore; // Calculate initial drawing position for the score flag
    
    // Initial UI update
    currentHeightDisplay.innerText = 0;
    currentGoldDisplay.innerText = totalGold;
}

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

function updateShopUI() {
    const list = document.getElementById('shop-list'); list.innerHTML = '';
    for (let key in hats) {
        const item = hats[key], isOwned = ownedHats.includes(key);
        list.innerHTML += `<div class="shop-item"><span>${item.name}</span><button class="btn" style="background:${selectedHat === key ? '#888' : '#2e7d32'}" onclick="${isOwned ? `equipHat('${key}')` : `buyHat('${key}')`}">${selectedHat === key ? 'EQUIP' : (isOwned ? 'OWNED' : '$'+item.price)}</button></div>`;
    }
}
window.buyHat = (key) => { if (totalGold >= hats[key].price) { totalGold -= hats[key].price; ownedHats.push(key); localStorage.setItem("pirateJumpOwnedHats", JSON.stringify(ownedHats)); localStorage.setItem("pirateJumpGold", totalGold); updateShopUI(); } };
window.equipHat = (key) => { selectedHat = key; localStorage.setItem("pirateJumpHat", key); updateShopUI(); };
window.closeShop = () => shopOverlay.style.display = 'none';
document.getElementById('open-shop-btn').onclick = () => { shopOverlay.style.display = 'block'; updateShopUI(); };

let smoothedTiltX = 0;

function handleMotion(e) {
    let rawTilt = 0;
    if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.x !== null) {
        let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        rawTilt = (isIOS ? 1 : -1) * e.accelerationIncludingGravity.x / 2.5; // Medium scaling
    } else if (e.gamma !== undefined) {
        rawTilt = e.gamma / 20.0; // Comfortable ~20 degree tilt for 100% velocity
    }
    
    // 1. Establish strict [-1, 1] range
    rawTilt = Math.max(-1, Math.min(1, rawTilt));
    
    // 2. Deadzone 
    if (Math.abs(rawTilt) < 0.05) rawTilt = 0; 
    
    // 3. Optional Exponential curve for precise low-end and fast high-end 
    // rawTilt = Math.sign(rawTilt) * Math.pow(Math.abs(rawTilt), 1.2); 
    
    // 4. Update memory pointer, actual LPF lerp happens in updatePhysics() loop
    tiltX = rawTilt;
}

async function requestPermission() {
    try {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            const state = await DeviceMotionEvent.requestPermission();
            if (state === 'granted') window.addEventListener('devicemotion', handleMotion);
        } else {
            window.addEventListener('devicemotion', handleMotion);
            window.addEventListener('deviceorientation', handleMotion);
        }
    } catch(e) { window.addEventListener('deviceorientation', handleMotion); }
    startGame();
}

let lastTime = 0, accumulator = 0;
const timeStep = 1000 / 60; // Fixed 60FPS physics 

function gameLoop(time) {
    if (!gameActive) return;
    if (!lastTime) lastTime = time;
    let dt = time - lastTime;
    lastTime = time;
    
    if (dt > timeStep * 4) dt = timeStep * 4; // prevent spiral of death
    
    accumulator += dt;
    while (accumulator >= timeStep) {
        updatePhysics(timeStep / 1000); // Pass dt in seconds
        accumulator -= timeStep;
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() { 
    uiOverlay.style.display = 'none'; shopOverlay.style.display = 'none'; gameOverOverlay.style.display = 'none'; 
    initGame(); 
    gameActive = true; 
    lastTime = 0; accumulator = 0;
    requestAnimationFrame(gameLoop); 
}
startBtn.addEventListener('click', requestPermission);
playAgainBtn.addEventListener('click', startGame);
goShopBtn.addEventListener('click', () => { shopOverlay.style.display = 'block'; updateShopUI(); });

changeNameText.addEventListener('click', () => {
    let freshName = prompt("Enter your new Pirate Name:");
    if (freshName) {
        currentPlayerName = freshName;
        localStorage.setItem("pirateJumpPlayerName", currentPlayerName);
        goYourName.innerText = currentPlayerName;
        if (score >= highScore) {
            highScoreName = currentPlayerName;
            localStorage.setItem("pirateJumpName", highScoreName);
            goScoreHolder.innerText = highScoreName;
        }
    }
});

hsSubmitBtn.addEventListener('click', () => {
    let freshName = hsInput.value.trim() || "Pirate";
    highScoreName = freshName;
    currentPlayerName = freshName;
    localStorage.setItem("pirateJumpName", highScoreName);
    localStorage.setItem("pirateJumpPlayerName", currentPlayerName);
    
    goHighScore.innerText = highScore;
    goScoreHolder.innerText = highScoreName;
    goYourName.innerText = currentPlayerName;
    
    hsForm.style.display = 'none';
    goStatsWrap.style.display = 'block';
    playAgainBtn.style.display = 'inline-block';
    goShopBtn.style.display = 'inline-block';
});

function updatePhysics(dt) {
    if (!gameActive) return;

    // Apply Low-Pass Filter to gyroscope tilt to smooth out jitter
    smoothedTiltX += (tiltX - smoothedTiltX) * (10.0 * dt);

    if (player.dead) {
        if (player.deathTimer > 0) {
            player.deathTimer -= dt; 
            if (player.deathTimer <= 0) {
                player.vy = JUMP_STRENGTH * 0.6; // Small Mario hop proportional to gravity
            }
        } else {
            player.vy += GRAVITY * dt;
            player.y += player.vy * dt;
        }
        
        // Wait until player falls completely out of viewport to show game over
        if (player.y > logicalHeight + 20) gameOver();
        
        // Update enemy bobs and broken platforms falling
        enemies.forEach(en => { en.bob += 3.0 * dt; en.y += Math.sin(en.bob) * 0.4; en.x += en.vx * 60.0 * dt; if (en.x < 0 || en.x > logicalWidth - en.w) en.vx *= -1; });
        platforms.forEach(p => { if (p.broken && p.type === 'breaking') { p.vy = (p.vy || 0) + GRAVITY * dt; p.y += p.vy * dt; }});
        
        return;
    }

    player.vx = (keys['ArrowLeft'] ? -MOVE_SPEED : (keys['ArrowRight'] ? MOVE_SPEED : smoothedTiltX * TILT_SPEED));
    
    // Remember the last direction for drawing textures when standing still
    if (player.vx < -10.0) player.lastDir = 'left';
    else if (player.vx > 10.0) player.lastDir = 'right';
    
    player.x += player.vx * dt;
    if (player.x > logicalWidth) player.x = -player.w; if (player.x < -player.w) player.x = logicalWidth;

    // Track vertical delta for stomp mechanics
    player.lastY = player.y;

    if (player.parrotTimer > 0) {
        player.vy = PARROT_SPEED; // Slower, more controllable parrot flight, adjusted for new physics
        player.parrotTimer -= dt; // Decay timer in seconds
        
        // Firing flap sounds every ~100ms
        if (Math.floor(player.parrotTimer * 10) % 2 === 0 && !player._flapPlayed) {
            playSound('flap');
            player._flapPlayed = true; 
        } else if (Math.floor(player.parrotTimer * 10) % 2 !== 0) {
            player._flapPlayed = false;
        }
    } else {
        player.vy += GRAVITY * dt;
    }
    player.y += player.vy * dt;

    platforms.forEach((p) => {
        if (p.broken && p.type === 'breaking') {
            p.vy = (p.vy || 0) + GRAVITY * dt; // Crumbling down animation
            p.y += p.vy * dt;
        }

        if (p.type === 'moving') { p.x += p.dir * 1.5 * dt * 60; if (p.x <= 0 || p.x + p.w >= logicalWidth) p.dir *= -1; }
        
        // Tightened horizontal hitboxes: the player's center must be over the inner 80% of the platform, not just grazing the edge
        let playerCenterX = player.x + player.w/2;
        if (player.vy > 0 && !p.broken && playerCenterX > p.x + p.w * 0.1 && playerCenterX < p.x + p.w * 0.9 && player.y + player.h > p.y && player.y + player.h < p.y + p.h + (player.vy * dt)) {
            if (p.hasParrot) {
                playSound('powerup');
                player.parrotTimer = 3.33; // 3.33 seconds duration map scale
                p.hasParrot = false;
                // Animate player growth with GSAP
                gsap.fromTo(powerupAnim, { scale: 1.5 }, { scale: 1, duration: 0.8, ease: "elastic.out(1, 0.3)" });
            } else if (p.hasShield) {
                playSound('powerup');
                player.hasShield = true;
                p.hasShield = false;
                player.vy = JUMP_STRENGTH;
            } else {
                if (p.hasPlank) {
                    playSound('plank');
                    p.plankAnim = 1; // Trigger plank extension animation
                    player.vy = SPRING_STRENGTH;
                    player.plankFlip = -360; // 360 degree backflip
                    gsap.to(player, { plankFlip: 0, duration: 0.6, ease: "power1.out" });
                } else {
                    playSound('jump');
                    player.vy = JUMP_STRENGTH;
                }
            }
            if (p.type === 'breaking') p.broken = true;
        }
    });

    enemies.forEach((en) => {
        en.bob += 3.0 * dt; 
        en.y += Math.sin(en.bob) * 0.4; 
        en.x += en.vx * 60.0 * dt; // Converting old 1.5 per-frame horizontal movement speed to 90px/s
        if (en.x < 0 || en.x > logicalWidth - en.w) en.vx *= -1;
        
        // Tightened Hitbox: Reduced collision radius from 26 down to 18 so it only hits the inner sprite body, not the transparent edges
        if (Math.abs(player.x + player.w/2 - (en.x + en.w/2)) < 18 && Math.abs(player.y + player.h/2 - (en.y + en.h/2)) < 18) {
            
            // Stomp Mechanic: If falling, and center of player was historically above center of enemy
            if (player.vy > 0 && player.lastY + player.h/2 < en.y + en.h/2) {
                playSound('jump'); // Stomp sound
                en.y = 9999; // Pop enemy
                player.vy = JUMP_STRENGTH; // Bounce upwards!
            }
            else if (player.parrotTimer > 0) {
                // Parrot kills enemies or ignores them
            } else if (player.hasShield) {
                playSound('shield_break');
                player.hasShield = false;
                en.y = 9999; // Pop the enemy
            } else {
                // Mario style death! Freeze, hop, plumment
                player.dead = true;
                player.deathTimer = 0.25; // Pause for a quarter second
                player.vy = 0; 
                player.vx = 0;
            }
        }
    });

    cannons.forEach((c) => {
        if (c.fireTimer > 0) {
            c.fireTimer -= dt;
            if (c.fireTimer <= 0) {
                // Fire
                playSound('cannon'); // Deep boom sound
                cannonballs.push({
                    x: c.dir === 1 ? c.x + c.w - 10 : c.x + 10,
                    y: c.y + c.h/2 - 5,
                    w: 16, h: 16,
                    vx: c.dir * 300 // Fly across screen horizontally
                });
                c.cooldownTimer = 2.0 + Math.random() * 1.0; // 2 to 3 seconds of cooldown 
            }
        } else if (c.cooldownTimer > 0) {
            c.cooldownTimer -= dt;
            if (c.cooldownTimer <= 0) {
                // Restart fuse
                c.fireTimer = 1.0; // 1 second fuse lighting warning
            }
        }
    });

    for (let i = cannonballs.length - 1; i >= 0; i--) {
        let cb = cannonballs[i];
        cb.x += cb.vx * dt;
        
        // Cannonball Hitbox check against player
        if (Math.abs(player.x + player.w/2 - (cb.x + cb.w/2)) < 16 && Math.abs(player.y + player.h/2 - (cb.y + cb.h/2)) < 16) {
             if (player.hasShield) {
                 playSound('shield_break');
                 player.hasShield = false;
                 // Destroy cannonball
                 cannonballs.splice(i, 1);
                 continue;
             } else if (player.parrotTimer <= 0) {
                 // Direct hit! You die.
                 player.dead = true;
                 player.deathTimer = 0.25;
                 player.vy = 0; player.vx = 0;
             }
        }
        
        // Clean up escaped cannonballs to prevent memory leak
        if (cb.x < -100 || cb.x > logicalWidth + 100) cannonballs.splice(i, 1);
    }

    coins.forEach((c) => {
        if (c.collected) return;
        c.bob += 4.8 * dt; // Normalize the 0.08 per frame to Math.PI / dt
        c.y += Math.sin(c.bob) * 0.5;
        // Collision
        if (player.dead) return;
        if (Math.abs(player.x + player.w/2 - (c.x + c.w/2)) < 25 && Math.abs(player.y + player.h/2 - (c.y + c.h/2)) < 25) {
            c.collected = true;
            totalGold += 1;
            currentGoldDisplay.innerText = totalGold;
            // GSAP pop animation on coin pickup text or simple logic.
        }
    });

    if (player.y < logicalHeight / 2) {
        let diff = (logicalHeight / 2) - player.y;
        player.y = logicalHeight / 2; // Keep at center
        score += Math.floor(diff);
        currentHeightDisplay.innerText = score;
        
        platforms.forEach(p => { 
            p.y += diff;
            if (p.y > logicalHeight) {
                // Procedural level design mathematically scaling based on height (score)
                // Base gap starts at 40, scales linearly up to an absolute max of 160 on zoomed screen
                let maxPossibleGap = Math.min(40 + (score / 120), 160); 
                let minPossibleGap = Math.min(25 + (score / 180), 90); 
                let newGap = minPossibleGap + (Math.random() * (maxPossibleGap - minPossibleGap));
                
                let newY = platforms.reduce((min, plat) => Math.min(min, plat.y), 0) - newGap;
                Object.assign(p, spawnPlatform(newY));
                spawnEnemy(newY);
                spawnCannon(newY);
                spawnCoin(newY);
            }
        });
        enemies.forEach(en => en.y += diff);
        coins.forEach(c => c.y += diff);
        cannons.forEach(c => c.y += diff);
        cannonballs.forEach(cb => cb.y += diff);
        
        islands.forEach(isl => {
            isl.y += diff * 0.2; // Move at 20% speed for 3D parallax depth
            if (isl.y > logicalHeight) {
                let highestIsland = islands.reduce((min, i) => Math.min(min, i.y), logicalHeight);
                Object.assign(isl, spawnIsland(highestIsland - (Math.random() * 150 + 150)));
            }
        });
        
        highScoreY += diff;
    }

    if (player.y > logicalHeight) gameOver();
}

function gameOver() {
    gameActive = false;  
    
    // Save normal state
    localStorage.setItem("pirateJumpGold", totalGold);
    
    // Set up basic display first
    gameOverOverlay.style.display = 'block';
    goScore.innerText = score;
    goHighScore.innerText = highScore;
    goScoreHolder.innerText = highScoreName;
    goYourName.innerText = currentPlayerName;
    
    hsForm.style.display = 'none';
    goStatsWrap.style.display = 'block';
    playAgainBtn.style.display = 'inline-block';
    goShopBtn.style.display = 'inline-block';

    // Use GSAP library to animate the transition into the game over screen
    gsap.fromTo(gameOverOverlay, 
        { scale: 0.5, opacity: 0, y: 50 }, 
        { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.5)", onComplete: () => {
            if (score > highScore) {
                highScore = score;
                localStorage.setItem("pirateJumpHigh", highScore);
                
                // Show the HTML form instead of browser prompt
                goStatsWrap.style.display = 'none';
                playAgainBtn.style.display = 'none';
                goShopBtn.style.display = 'none';
                hsForm.style.display = 'block';
                hsInput.value = currentPlayerName;
                hsInput.focus();
            }
        }}
    );
}

function draw() {
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    
    // Dynamic Background logic
    let skyAlpha = 1, cloudsAlpha = 0, spaceAlpha = 0;
    if (score < 8000) {
        skyAlpha = 1;
    } else if (score < 10000) {
        let p = (score - 8000) / 2000;
        skyAlpha = 1 - p; cloudsAlpha = p;
    } else if (score < 18000) {
        cloudsAlpha = 1;
    } else if (score < 20000) {
        let p = (score - 18000) / 2000;
        cloudsAlpha = 1 - p; spaceAlpha = p;
    } else {
        spaceAlpha = 1;
    }

    if (imagesLoaded >= totalImages) {
        let rawScroll = score * 0.05; // Slower background scroll
        
        function drawBlendedTiledBg(img, alpha) {
            if (alpha <= 0 || !img.width) return;
            ctx.globalAlpha = alpha;
            let cycle = rawScroll % logicalHeight;

            // Draw primary tile
            ctx.drawImage(img, 0, cycle, logicalWidth, logicalHeight);
            // Draw tile above it
            ctx.drawImage(img, 0, cycle - logicalHeight, logicalWidth, logicalHeight);

            // Hide the cutoff seam between the two tiles using a soft overlay gradient
            // The seam is always exactly at 'cycle' (the bottom of the top tile / top of the bottom tile)
            let seamY = cycle;
            
            ctx.globalCompositeOperation = 'source-atop'; // Only draw over existing background pixels
            let blend = ctx.createLinearGradient(0, seamY - 40, 0, seamY + 40);
            
            // Sample average colors for the blend based on which background is visible
            if (img === images.bgClouds) {
                blend.addColorStop(0, 'rgba(75, 0, 130, 0)'); // Indigo fade
                blend.addColorStop(0.5, 'rgba(75, 0, 130, 0.4)');
                blend.addColorStop(1, 'rgba(75, 0, 130, 0)');
            } else if (img === images.bgSpace) {
                blend.addColorStop(0, 'rgba(20, 0, 40, 0)'); // Deep purple/black fade
                blend.addColorStop(0.5, 'rgba(20, 0, 40, 0.6)');
                blend.addColorStop(1, 'rgba(20, 0, 40, 0)');
            } else {
                blend.addColorStop(0, 'rgba(135, 206, 235, 0)'); // Sky blue fade
                blend.addColorStop(0.5, 'rgba(135, 206, 235, 0.5)');
                blend.addColorStop(1, 'rgba(135, 206, 235, 0)');
            }
            
            ctx.fillStyle = blend;
            ctx.fillRect(0, seamY - 40, logicalWidth, 80);
            
            ctx.globalCompositeOperation = 'source-over'; // Restore normal drawing
        }

        ctx.fillStyle = '#87CEEB'; 
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        // Render daytime sky at max 40% opacity to dramatically soften and reduce the visual density of the clouds
        drawBlendedTiledBg(images.bgSky, skyAlpha * 0.4);
        drawBlendedTiledBg(images.bgClouds, cloudsAlpha);
        drawBlendedTiledBg(images.bgSpace, spaceAlpha);

        ctx.globalAlpha = 1.0;
        
        // Draw the transparent ocean waves foreground fixed at ground level
        // Ocean scrolls downwards with parallax depth alongside islands
        let groundY = logicalHeight - 140; // Base visible water height when score=0
        let oceanScrollY = groundY + score * 0.2; 
        if (oceanScrollY < logicalHeight && images.oceanWaves.width > 0) {
            ctx.drawImage(images.oceanWaves, 0, oceanScrollY, logicalWidth, 140);
        }
        
        // Draw parallax islands beneath the platforms
        // No darkening filters, relying purely on the 0.2x vertical Parallax Scroll speed for depth context
        islands.forEach(isl => {
            if (images.island.width > 0) {
                ctx.drawImage(images.island, isl.x, isl.y, isl.w, isl.h);
            }
        });
    } else {
        // Fallback gradient if images are not ready
        let skyGrad = ctx.createLinearGradient(0, 0, 0, logicalHeight);
        skyGrad.addColorStop(0, '#87CEEB');  
        skyGrad.addColorStop(1, '#4682B4');  
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    }

    // Draw High Score Flag Line in world space
    if (highScore > 0) {
        let relFlagY = highScoreY;
        
        // Only draw if relatively near camera
        if (relFlagY > -50 && relFlagY < logicalHeight + 50) {
            ctx.strokeStyle = '#c62828'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(0, relFlagY); ctx.lineTo(logicalWidth, relFlagY); ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw Pirate Flag icon and Name
            ctx.fillStyle = 'black'; ctx.fillRect(logicalWidth - 50, relFlagY - 20, 25, 15);
            ctx.fillStyle = 'white'; ctx.font = '10px Arial'; ctx.fillText('☠️ ' + highScoreName, logicalWidth - 85, relFlagY - 5);
        }
    }

    platforms.forEach(p => {
        if (p.broken && p.type === 'breaking') {
            if (imagesLoaded >= totalImages) {
                ctx.globalAlpha = 0.5;
                ctx.drawImage(images.breakingPlatform, p.x, p.y - 10, p.w, p.h + 20); // Render crumbling platform
                ctx.globalAlpha = 1.0;
            }
            return;
        }
        if (p.broken) return;

        if (imagesLoaded >= totalImages) {
            let img = p.type === 'breaking' ? images.breakingPlatform : images.platform;
            ctx.drawImage(img, p.x, p.y - 10, p.w, p.h + 20);
        } else {
            ctx.fillStyle = p.type === 'moving' ? '#1a237e' : (p.type === 'breaking' ? '#8d6e63' : '#5d4037');
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
        
        if (p.type === 'breaking' && imagesLoaded < totalImages) {
            ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(p.x + p.w/2, p.y); ctx.lineTo(p.x + p.w/2, p.y + p.h); ctx.stroke();
        }
        if (p.hasPlank) { 
            if (imagesLoaded >= totalImages) {
                ctx.drawImage(images.plank, p.x + p.w/2 - 15, p.y - 15, 30, 20);
            } else {
                ctx.fillStyle = '#8d6e63'; ctx.fillRect(p.x + p.w/2 - 15, p.y - 8, 30, 8); 
            }
        }
        if (p.hasParrot) {
            if (imagesLoaded >= totalImages) {
                ctx.drawImage(images.powerup, p.x + p.w/2 - 15, p.y - 25, 30, 30);
            } else {
                ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(p.x + p.w/2, p.y - 10, 8, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff9800'; ctx.fillRect(p.x + p.w/2 + 2, p.y - 12, 4, 3);
            }
        }
        if (p.hasShield) { // Pirate Wheel Shield item
            let cx = p.x + p.w / 2; // Perfectly centered on platform width
            let cy = p.y - 12;
            
            // Faint pulsing blue aura behind the pirate shield
            let pulse = Math.sin(Date.now() / 200) * 3 + 12;
            let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse);
            grad.addColorStop(0, 'rgba(0, 191, 255, 0.6)'); // Deep Sky Blue glow
            grad.addColorStop(1, 'rgba(0, 191, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, Math.PI * 2); ctx.fill();
            
            // Draw Pirate Wheel Shape
            ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(cx, cy, 7.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#d7ccc8'; ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI*2); ctx.fill();
            for(let a=0; a<4; a++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(a*Math.PI/4); ctx.fillStyle='#5d4037'; ctx.fillRect(-9, -1.5, 18, 3); ctx.restore(); }
        }
    });

    enemies.forEach(en => {
        if (imagesLoaded >= totalImages) {
            ctx.drawImage(images.enemy, en.x, en.y, en.w, en.h);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath();
            ctx.arc(en.x + en.w/2, en.y + en.h/2, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'black'; ctx.fillRect(en.x+9, en.y+10, 3, 3); ctx.fillRect(en.x+15, en.y+10, 3, 3);
        }
    });

    coins.forEach(c => {
        if (c.collected) return;
        if (imagesLoaded >= totalImages) {
            ctx.drawImage(images.coin, c.x, c.y, c.w, c.h);
        } else {
            ctx.fillStyle = 'gold'; ctx.beginPath();
            ctx.arc(c.x + c.w/2, c.y + c.h/2, 10, 0, Math.PI*2); ctx.fill();
        }
    });

    // Pirate Mascot
    if (imagesLoaded >= totalImages) {
        ctx.save();
        ctx.translate(player.x + player.w/2, player.y + player.h/2);
        
        // Upside down if dead
        if (player.dead) ctx.scale(1, -1);
        else if (player.plankFlip !== 0) ctx.rotate(player.plankFlip * Math.PI / 180);
        
        let drawW = (player.w + 20) * (player.parrotTimer > 0 && !player.dead ? powerupAnim.scale : 1);
        let drawH = (player.h + 20) * (player.parrotTimer > 0 && !player.dead ? powerupAnim.scale : 1);
        
        // Pick proper facing AND proper hat texture
        let currentSprite = (player.lastDir === 'left') ? images.playerLeft : images.playerRight;
        
        // Draw character (centered directly on hitbox)
        if (currentSprite && currentSprite.width > 0) {
            ctx.drawImage(currentSprite, -drawW/2, -drawH/2, drawW, drawH);
            
            // Draw Hat if equipped, correctly scaled and specifically pushed down just onto the top of the head block
            if (images[selectedHat]) {
                let hatScale = (selectedHat === 'crown') ? 0.35 : ((selectedHat === 'chef') ? 0.45 : 0.55);
                let hatW = drawW * hatScale;
                let hatH = drawH * hatScale;
                
                // Fine-tuned Y pixel offsets. -10 floated, 8 was on the body. 0 to 2 lands perfectly on the head.
                let hatY = (selectedHat === 'viking' || selectedHat === 'pirate') ? 0 : 3;
                
                ctx.drawImage(images[selectedHat], -hatW/2, -drawH/2 + hatY, hatW, hatH);
            }
        }
        
        ctx.restore();
        
        // Draw Bubble Shield
        if (player.hasShield) {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = 'rgba(0, 200, 255, 1)';
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)'; ctx.lineWidth = 3;
            ctx.fillStyle = 'rgba(0, 200, 255, 0.2)';
            ctx.beginPath(); ctx.arc(player.x + player.w/2, player.y + player.h/2, player.w * 0.85, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.beginPath(); ctx.arc(player.x + player.w/2 - 8, player.y + player.h/2 - 12, 4, 0, Math.PI*2); ctx.fill(); // Specular highlight
            ctx.restore();
        }
    } else {
        ctx.fillStyle = 'white'; ctx.fillRect(player.x + 5, player.y + 10, player.w - 10, 20);
        ctx.fillStyle = '#1a237e'; ctx.fillRect(player.x + 5, player.y + 14, player.w - 10, 2);
        ctx.fillRect(player.x + 5, player.y + 22, player.w - 10, 2);
        ctx.fillStyle = '#ffccbc'; ctx.fillRect(player.x + 5, player.y + 5, player.w - 10, 10);
        ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(player.x + 12, player.y + 10, 3, 0, Math.PI*2); ctx.fill();

        // Hat
        ctx.fillStyle = hats[selectedHat].color;
        if (selectedHat === 'pirate') {
            ctx.beginPath(); ctx.moveTo(player.x - 5, player.y + 5); ctx.lineTo(player.x + player.w + 5, player.y + 5); ctx.lineTo(player.x + player.w/2, player.y - 10); ctx.fill();
        } else { ctx.fillRect(player.x+5, player.y-5, 25, 10); }
    }

    // Parrot Flapping Animation
    if (player.parrotTimer > 0 && !player.dead) {
        if (imagesLoaded >= totalImages) {
            let flapScale = 0.8 + Math.abs(Math.sin(Date.now() / 80)) * 0.4; // Quick continuous flapping
            
            ctx.save();
            ctx.translate(player.x + player.w/2, player.y - 15);
            ctx.scale(1, flapScale);
            ctx.drawImage(images.powerup, -15, -15, 30, 30);
            ctx.restore();
        } else {
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(player.x - 5, player.y - 15, 45, 5); // Spinning wings
            ctx.fillStyle = 'red';
            ctx.beginPath(); ctx.arc(player.x + player.w/2, player.y - 20, 6, 0, Math.PI*2); ctx.fill();
        }
    }

    // Draw Pirate Ship Cannons & Hazards
    cannons.forEach(c => {
        if (imagesLoaded >= totalImages && images.cannon && images.cannon.width > 0) {
            ctx.save();
            ctx.translate(c.x + c.w/2, c.y + c.h/2);
            if (c.dir === -1) {
                // Cannon is on right wall shooting left, flip texture horizontally
                ctx.scale(-1, 1);
            }
            // Draw pirate ship asset
            ctx.drawImage(images.cannon, -c.w/2, -c.h/2, c.w, c.h);
            ctx.restore();
        } else {
            // Fallback squares
            ctx.fillStyle = '#4e342e'; ctx.fillRect(c.x, c.y, c.w, c.h);
            ctx.fillStyle = '#212121'; let bx = c.dir === 1 ? c.x + 40 : c.x - 10; ctx.fillRect(bx, c.y + 10, 30, 16);
            ctx.fillStyle = '#424242'; ctx.fillRect(bx + (c.dir === 1 ? 25 : 0), c.y + 8, 5, 20); // Cannon muzzle
        }

        // Fuse Spark indicator if preparing to fire (fuse crackling)
        if (c.fireTimer > 0) {
             let sparkX = c.dir === 1 ? c.x + 20 : c.x + c.w - 20; // Anchor to back of ship
             let sparkSize = Math.random() * 4 + 2;
             ctx.fillStyle = '#ff3d00';
             ctx.beginPath(); ctx.arc(sparkX, c.y + 10, sparkSize, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#ffeb3b';
             ctx.beginPath(); ctx.arc(sparkX, c.y + 10, sparkSize/2, 0, Math.PI*2); ctx.fill();
        }
    });

    cannonballs.forEach(cb => {
        if (imagesLoaded >= totalImages && images.cannonball && images.cannonball.width > 0) {
            ctx.drawImage(images.cannonball, cb.x, cb.y, cb.w, cb.h);
        } else {
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(cb.x + cb.w/2, cb.y + cb.h/2, cb.w/2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(cb.x + cb.w/2 - 3, cb.y + cb.h/2 - 3, 2, 0, Math.PI*2);
            ctx.fill();
        }
    });
}
