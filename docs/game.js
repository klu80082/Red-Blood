// game.js

// --- Asset Loading (images in assets/images/) ---
const bgImage = new Image();
bgImage.src = "assets/images/background.png";

const skin1 = new Image();
skin1.src = "assets/images/player1.png";

const skin2 = new Image();
skin2.src = "assets/images/player2.png";

// --- Sound Loading (audio in assets/sounds/) ---
// Main menu now uses your RED BLOOD theme:
const musicMenu = new Audio("assets/sounds/red-blood-menu.mp3");
musicMenu.loop = true;
musicMenu.volume = 0.5;

// Fight track:
const musicFight = new Audio("assets/sounds/fight-music.mp3");
musicFight.loop = true;
musicFight.volume = 0.2;

// SFX:
const sfxGun     = new Audio("assets/sounds/gun.mp3");
const sfxJump    = new Audio("assets/sounds/jump.mp3");
const sfxRestart = new Audio("assets/sounds/restart.mp3");

// --- Unlock sounds on first user interaction to avoid autoplay blocks ---
let soundsUnlocked = false;
function unlockSounds() {
  if (soundsUnlocked) return;
  // only unlock fight music & SFX (leave menu music alone)
  [musicFight, sfxGun, sfxJump, sfxRestart].forEach(s => {
    s.play().then(() => s.pause()).catch(() => {});
  });
  soundsUnlocked = true;
}
document.addEventListener('keydown', unlockSounds, { once: true });
document.addEventListener('click',   unlockSounds, { once: true });

// Play menu music on page load
musicMenu.play().catch(() => {});

// --- Canvas & UI References ---
const canvas  = document.getElementById("gameCanvas");
const ctx     = canvas.getContext("2d");
const menu    = document.getElementById("menu");
const pvpBtn  = document.getElementById("pvpBtn");
const pvaBtn  = document.getElementById("pvaBtn");
const backBtn = document.getElementById("backBtn");

// --- Dynamically create end-of-match UI ---
const endScreen = document.createElement("div");
endScreen.id = "endScreen";
Object.assign(endScreen.style, {
  display:   "none",
  position:  "absolute",
  top:       "50%",
  left:      "50%",
  transform: "translate(-50%, -50%)",
  textAlign: "center"
});
document.body.appendChild(endScreen);

function makeBtn(id, text, onClick) {
  const btn = document.createElement("button");
  btn.id = id;
  btn.textContent = text;
  btn.classList.add("styled-btn");
  btn.addEventListener("click", onClick);
  return btn;
}

const restartBtn = makeBtn("restartBtn", "Restart Match", () => {
  sfxRestart.currentTime = 0;
  sfxRestart.play();
  endScreen.style.display = "none";
  startMatch(mode);
});

const mainMenuBtn = makeBtn("mainMenuBtn", "Main Menu", () => {
  musicMenu.currentTime = 0;
  musicMenu.play();
  endScreen.style.display = "none";
  menu.style.display   = "block";
  canvas.style.display = "none";
});

const quitBtn = makeBtn("quitBtn", "Quit", () => {
  endScreen.style.display = "none";
  canvas.style.display    = "none";
  backBtn.style.display   = "none";
  menu.style.display      = "none";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

endScreen.append(restartBtn, mainMenuBtn, quitBtn);

// --- Match & Round State ---
let mode, scoreP1, scoreP2, currentRound, matchOver;
const MAX_ROUNDS = 3;

// --- Per-round State ---
let player1, player2, bulletsP1, bulletsP2, aiCd, gameOver;

// --- Transition State ---
let transitioning = false, fadeAlpha = 0, fadeDir = 1, onFadeEnd = null;

// --- Input & Physics ---
const keys = {}, gravity = 0.5;
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup",   e => keys[e.key] = false);

// --- Platforms ---
const platforms = [
  { x:150, y:260, w:200, h:10 },
  { x:450, y:200, w:200, h:10 }
];

// --- Player Factory ---
function createPlayer(x, skin, isAI = false) {
  return {
    x, y:300, w:50, h:50, skin,
    hp:5, vy:0, grounded:true, facing:1,
    shootCd:0, jumpCnt:isAI?2:1, isAI
  };
}

// --- Menu Handlers ---
pvpBtn.onclick = () => {
  musicMenu.pause();
  startMatch("pvp");
};
pvaBtn.onclick = () => {
  musicMenu.pause();
  startMatch("pva");
};
backBtn.onclick = () => {
  menu.style.display    = "block";
  canvas.style.display  = "none";
  backBtn.style.display = "none";
  musicMenu.currentTime = 0;
  musicMenu.play();
};

// --- Start Full Match ---
function startMatch(m) {
  mode         = m;
  menu.style.display   = "none";
  canvas.style.display = "block";
  backBtn.style.display = "none";

  scoreP1      = 0;
  scoreP2      = 0;
  currentRound = 1;
  matchOver    = false;
  startRound();
}

// --- Initialize & Begin One Round ---
function startRound() {
  // ensure menu music is fully stopped
  musicMenu.pause();

  player1   = createPlayer(100, skin1, false);
  player2   = createPlayer(650, skin2, mode === "pva");
  bulletsP1 = [];
  bulletsP2 = [];
  aiCd      = 60;
  gameOver  = false;

  if (currentRound === 1) {
    showCountdown(() => {
      musicFight.currentTime = 0;
      musicFight.play().catch(() => {});
      requestAnimationFrame(gameLoop);
    });
  } else {
    startTransition(() =>
      showCountdown(() => {
        musicFight.currentTime = 0;
        musicFight.play().catch(() => {});
        requestAnimationFrame(gameLoop);
      })
    );
  }
}

// --- Countdown 3-2-1-FIGHT ---
function showCountdown(cb) {
  let c = 3;
  function step() {
    drawFrame();
    drawScoreboard();
    drawHealthBars();
    ctx.fillStyle = "white";
    ctx.font      = "80px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText(c > 0 ? c : "FIGHT!", canvas.width/2, canvas.height/2);
    c--;
    if (c >= -1) setTimeout(step, 800);
    else {
      ctx.textAlign = "start";
      cb();
    }
  }
  step();
}

// --- Fade Transition ---
function startTransition(cb) {
  transitioning = true;
  fadeDir       = 1;
  onFadeEnd     = () => {
    cb();
    fadeDir   = -1;
    onFadeEnd = null;
    fadeStep();
  };
  fadeStep();
}

function fadeStep() {
  fadeAlpha += 0.02 * fadeDir;
  if (fadeAlpha <= 0 || fadeAlpha >= 1) {
    fadeAlpha = Math.max(0, Math.min(1, fadeAlpha));
    if (onFadeEnd) {
      const fn = onFadeEnd;
      onFadeEnd     = null;
      transitioning = false;
      fn();
    }
    return;
  }
  drawFrame();
  drawScoreboard();
  drawHealthBars();
  drawPlayers();
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  requestAnimationFrame(fadeStep);
}

// --- Drawing Routines ---
function drawFrame() {
  if (bgImage.complete) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.strokeStyle = "#eee";
  ctx.lineWidth   = 4;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  platforms.forEach(pl => {
    ctx.fillStyle = "#555";
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
  });
}

function drawScoreboard() {
  ctx.fillStyle = "white";
  ctx.font      = "16px 'Press Start 2P'";
  ctx.fillText(`Round ${currentRound}/${MAX_ROUNDS}`, canvas.width/2 - 50, 30);
  ctx.fillText(`P1: ${scoreP1}`, 20, 60);
  ctx.fillText(`${mode === "pva" ? "AI" : "P2"}: ${scoreP2}`, canvas.width - 140, 60);
}

function drawHealthBars() {
  ctx.fillStyle = "#444";
  ctx.fillRect(20, 80, 100, 12);
  ctx.fillStyle = "red";
  ctx.fillRect(20, 80, player1.hp * 20, 12);

  ctx.fillStyle = "#444";
  ctx.fillRect(canvas.width - 120, 80, 100, 12);
  ctx.fillStyle = "blue";
  ctx.fillRect(canvas.width - 120, 80, player2.hp * 20, 12);
}

function drawPlayers() {
  drawPlayer(player1, player2);
  drawPlayer(player2, player1);
}

function drawPlayer(p, o) {
  p.facing = p.x < o.x ? 1 : -1;
  ctx.save();
  if (p.facing < 0) {
    ctx.translate(p.x + p.w/2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(p.x + p.w/2), 0);
  }
  if (p.skin.complete) {
    ctx.drawImage(p.skin, p.x, p.y, p.w, p.h);
  } else {
    ctx.fillStyle = p === player1 ? "red" : "blue";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  ctx.restore();

  // muzzle flash
  ctx.fillStyle = "#fff";
  const ex = p.x + (p.facing > 0 ? p.w - 8 : 2);
  ctx.fillRect(ex, p.y + 14, 6, 6);
}

// --- Physics & Collision ---
function applyPhysics(p) {
  p.vy += gravity;
  let ny = p.y + p.vy;

  // floor
  if (ny >= 300) {
    ny = 300;
    p.vy = 0;
    p.grounded = true;
    p.jumpCnt = p.isAI ? 2 : 1;
  } else {
    p.grounded = false;
  }

  // platforms
  if (p.vy >= 0) {
    platforms.forEach(pl => {
      if (
        p.x + p.w > pl.x && p.x < pl.x + pl.w &&
        p.y + p.h <= pl.y && ny + p.h >= pl.y
      ) {
        ny = pl.y - p.h;
        p.vy = 0;
        p.grounded = true;
        p.jumpCnt = p.isAI ? 2 : 1;
      }
    });
  }

  p.y = ny;
}

// --- Main Game Loop ---
function gameLoop() {
  if (gameOver || matchOver || transitioning) return;

  drawFrame();
  drawScoreboard();
  drawHealthBars();

  [player1, player2].forEach(p => { if (p.shootCd > 0) p.shootCd--; });

  // Player 1 controls & sounds
  if (keys["a"]) player1.x -= 5;
  if (keys["d"]) player1.x += 5;
  if (keys["w"] && player1.jumpCnt > 0) {
    player1.vy = -12;
    player1.jumpCnt--;
    player1.grounded = false;
    sfxJump.currentTime = 0;
    sfxJump.play();
  }
  if (keys["e"] && player1.shootCd === 0) {
    player1.shootCd = 20;
    sfxGun.currentTime = 0;
    sfxGun.play();
    bulletsP1.push({
      x: player1.x + (player1.facing > 0 ? player1.w : 0),
      y: player1.y + player1.h/2,
      vx: 8 * player1.facing
    });
  }

  // Player 2 / AI controls & sounds
  if (mode === "pvp") {
    if (keys["ArrowLeft"])  player2.x -= 5;
    if (keys["ArrowRight"]) player2.x += 5;
    if (keys["ArrowUp"] && player2.jumpCnt > 0) {
      player2.vy = -12;
      player2.jumpCnt--;
      player2.grounded = false;
      sfxJump.currentTime = 0;
      sfxJump.play();
    }
    if (keys["0"] && player2.shootCd === 0) {
      player2.shootCd = 20;
      sfxGun.currentTime = 0;
      sfxGun.play();
      bulletsP2.push({
        x: player2.x + (player2.facing > 0 ? player2.w : 0),
        y: player2.y + player2.h/2,
        vx: 8 * player2.facing
      });
    }
  } else {
    // simple AI
    if (player2.x < player1.x - 60) player2.x += 2;
    if (player2.x > player1.x + 60) player2.x -= 2;
    if (player2.grounded && Math.random() < 0.01) {
      player2.vy = -12;
      player2.jumpCnt = 1;
      player2.grounded = false;
      sfxJump.currentTime = 0;
      sfxJump.play();
    } else if (!player2.grounded && player2.jumpCnt > 0 && Math.random() < 0.005) {
      player2.vy = -12;
      player2.jumpCnt--;
      sfxJump.currentTime = 0;
      sfxJump.play();
    }
    aiCd--;
    if (aiCd <= 0) {
      aiCd = 90;
      sfxGun.currentTime = 0;
      sfxGun.play();
      bulletsP2.push({
        x: player2.x + (player2.facing > 0 ? player2.w : 0),
        y: player2.y + player2.h/2,
        vx: 8 * player2.facing
      });
    }
  }

  // clamp & physics
  [player1, player2].forEach(p => {
    p.x = Math.max(0, Math.min(p.x, canvas.width - p.w));
    applyPhysics(p);
  });

  // bullets update & collision
  function updateBullets(arr, tgt) {
    arr.forEach((b, i) => {
      b.x += b.vx;
      ctx.fillStyle = arr === bulletsP1 ? "orange" : "cyan";
      ctx.fillRect(b.x, b.y, 10, 4);
      if (b.x < 0 || b.x > canvas.width) { arr.splice(i, 1); return; }
      if (
        b.x < tgt.x + tgt.w && b.x + 10 > tgt.x &&
        b.y < tgt.y + tgt.h && b.y + 4 > tgt.y
      ) {
        tgt.hp--;
        arr.splice(i, 1);
      }
    });
  }
  updateBullets(bulletsP1, player2);
  updateBullets(bulletsP2, player1);

  drawPlayers();

  // round / match end logic
  if (player1.hp <= 0 || player2.hp <= 0) {
    gameOver = true;
    if (player1.hp <= 0) scoreP2++; else scoreP1++;

    musicFight.pause();

    if (currentRound >= MAX_ROUNDS) {
      matchOver = true;
      setTimeout(() => {
        drawFrame();
        ctx.fillStyle = "yellow";
        ctx.font      = "32px 'Press Start 2P'";
        ctx.textAlign = "center";
        const winMsg = scoreP1 > scoreP2
          ? "Player 1 Wins Match!"
          : (mode === "pva" ? "AI Wins Match!" : "Player 2 Wins Match!");
        ctx.fillText(winMsg, canvas.width/2, canvas.height/2 - 40);
        endScreen.style.display = "block";
      }, 1000);
    } else {
      currentRound++;
      setTimeout(() => startRound(), 1500);
    }
    return;
  }

  requestAnimationFrame(gameLoop);
}
