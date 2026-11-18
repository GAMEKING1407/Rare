import levels from "./levels.json" with { type: "json" };
import { materials } from "./materials.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 450;

const gravity = 0.6;
const startGravity = gravity;

let startTime = performance.now();
let deaths = 0;

let LEVEL_WIDTH = 800;
let LEVEL_HEIGHT = 450;

let platforms = [];
let movingPlatforms = [];
let hazards = [];

const keys = {};

const camera = {
  x: 0,
  y: 0,
};

const player = {
  x: 0,
  y: 0,
  w: 32,
  h: 32,
  
  vx: 0,
  vy: 0,
  
  speed: 5,
  jump: -12,
  
  grounded: false,
  wallDir: 0,
  wallJumpTimer: 0,
  
  jumpHeld: false,
  
  platform: null,
  
  // level: levels.length - 1
  level: 0
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
      e.code,
    )
  ) {
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function clonePlatforms(array) {
  return array.map((platform) => ({
    ...platform,
    durability: materials[platform.m]?.durability,
    maxDurability: materials[platform.m]?.durability,
    broken: false,
    breakTimer: 0,
  }));
}

function resetLevel(resetStats = false) {
  const currentLevel = levels[player.level];
  
  LEVEL_WIDTH = currentLevel.width || 800;
  LEVEL_HEIGHT = currentLevel.height || 450;
  
  platforms = clonePlatforms(currentLevel.platforms || []);
  movingPlatforms = clonePlatforms(currentLevel.movingPlatforms || []);
  hazards = currentLevel.hazards || [];
  
  player.x = currentLevel.spawn.x;
  player.y = currentLevel.spawn.y;
  
  player.vx = 0;
  player.vy = 0;
  
  player.grounded = false;
  player.wallDir = 0;
  player.wallJumpTimer = 0;
  player.jumpHeld = false;
  player.platform = null;
  
  camera.x = Math.max(
    0,
    Math.min(
      player.x + player.w / 2 - VIEW_WIDTH / 2,
      Math.max(0, LEVEL_WIDTH - VIEW_WIDTH),
    ),
  );
  
  camera.y = Math.max(
    0,
    Math.min(
      player.y + player.h / 2 - VIEW_HEIGHT / 2,
      Math.max(0, LEVEL_HEIGHT - VIEW_HEIGHT),
    ),
  );
  
  if (resetStats) {
    startTime = performance.now();
    deaths = 0;
  }
}

resetLevel(true);

function checkCollision(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function getAllPlatforms() {
  return [...platforms, ...movingPlatforms].filter((p) => !p.broken);
}

function getMaterial(platform) {
  return materials[platform.m] || materials.normal;
}

function movePlatforms() {
  for (const mp of movingPlatforms) {
    const oldX = mp.x;
    const oldY = mp.y;
    
    mp.x += mp.vx || 0;
    mp.y += mp.vy || 0;
    
    if (mp.x <= mp.minX || mp.x + mp.w >= mp.maxX) {
      mp.vx *= -1;
    }
    
    if (mp.y <= mp.minY || mp.y + mp.h >= mp.maxY) {
      mp.vy *= -1;
    }
    
    mp.deltaX = mp.x - oldX;
    mp.deltaY = mp.y - oldY;
  }
}

function handleInput() {
  const acceleration = 0.7;
  const maxSpeed = player.speed;
  
  if (player.wallJumpTimer > 0) {
    player.wallJumpTimer--;
  } else {
    if (keys.ArrowLeft || keys.KeyA) {
      player.vx -= acceleration;
    }
    
    if (keys.ArrowRight || keys.KeyD) {
      player.vx += acceleration;
    }
  }
  
  player.vx = Math.max(-maxSpeed, Math.min(player.vx, maxSpeed));
  
  const jumpPressed = keys.Space || keys.ArrowUp || keys.KeyW;
  
  const justPressedJump = jumpPressed && !player.jumpHeld;
  
  if (justPressedJump) {
    if (player.grounded) {
      jump();
    } else if (player.wallDir !== 0) {
      player.vy = player.jump * 0.95;
      player.vx = -player.wallDir * (player.speed * 1.4);
      player.wallJumpTimer = 7.5;
      player.wallDir = 0;
    }
  }
  
  player.jumpHeld = jumpPressed;
}

function jump() {
  const platform = player.platform;
  
  player.vy = player.jump;
  
  if (platform) {
    const material = getMaterial(platform);
    
    if (material.bounce) {
      player.vy *= material.bounce;
    }
    
    if (platform.durability !== undefined) {
      platform.durability--;
      
      if (platform.durability <= 0) {
        platform.broken = true;
      }
    }
  }
  
  player.grounded = false;
  player.platform = null;
}

function handleHorizontalCollision(allPlatforms) {
  player.x += player.vx;
  
  player.x = Math.max(0, Math.min(player.x, LEVEL_WIDTH - player.w));
  
  player.wallDir = 0;
  
  for (const p of allPlatforms) {
    if (!checkCollision(player, p)) continue;
    
    if (player.vx > 0) {
      player.x = p.x - player.w;
      player.wallDir = 1;
    } else if (player.vx < 0) {
      player.x = p.x + p.w;
      player.wallDir = -1;
    }
  }
  
  if (player.wallDir === 0 && !player.grounded) {
    const probingLeft = keys.ArrowLeft || keys.KeyA;
    const probingRight = keys.ArrowRight || keys.KeyD;
    
    for (const p of allPlatforms) {
      if (probingRight && checkCollision({ ...player, x: player.x + 1 }, p)) {
        player.wallDir = 1;
      }
      
      if (probingLeft && checkCollision({ ...player, x: player.x - 1 }, p)) {
        player.wallDir = -1;
      }
    }
  }
}

function handleVerticalCollision(allPlatforms) {
  const previousBottom = player.y + player.h;
  
  player.y += player.vy;
  
  player.grounded = false;
  player.platform = null;
  
  for (const p of allPlatforms) {
    if (!checkCollision(player, p)) continue;
    
    if (player.vy > 0 && previousBottom <= p.y + 8) {
      player.y = p.y - player.h;
      
      player.vy = 0;
      player.grounded = true;
      player.platform = p;
      
      if (p.deltaX) player.x += p.deltaX;
      if (p.deltaY) player.y += p.deltaY;
      
      const material = getMaterial(p);
      
      if (material.movement === "water") {
        player.vy = 0;
      }
    } else if (player.vy < 0) {
      player.y = p.y + p.h;
      player.vy = 0;
    }
  }
}

function applyPhysics() {
  const material = player.platform ? getMaterial(player.platform) : null;
  
  const friction = material?.friction ?? 0.8;
  
  if (player.grounded) {
    player.vx *= friction;
  } else {
    player.vx *= 0.99;
  }
  
  player.vy += gravity;
}

function updateCamera() {
  const targetX = player.x + player.w / 2 - VIEW_WIDTH / 2;
  
  const targetY = player.y + player.h / 2 - VIEW_HEIGHT / 2;
  
  const clampedX = Math.max(
    0,
    Math.min(targetX, Math.max(0, LEVEL_WIDTH - VIEW_WIDTH)),
  );
  
  const clampedY = Math.max(
    0,
    Math.min(targetY, Math.max(0, LEVEL_HEIGHT - VIEW_HEIGHT)),
  );
  
  camera.x += (clampedX - camera.x) * 0.12;
  camera.y += (clampedY - camera.y) * 0.12;
}

function die() {
  deaths++;
  resetLevel(false);
}

function update() {
  const currentLevel = levels[player.level];
  
  movePlatforms();
  
  const allPlatforms = getAllPlatforms();
  
  handleInput();
  
  applyPhysics();
  
  handleHorizontalCollision(allPlatforms);
  
  handleVerticalCollision(allPlatforms);
  
  updateCamera();
  
  const hitHazard = hazards.some((h) => checkCollision(player, h));
  
  if (hitHazard || player.y > LEVEL_HEIGHT) {
    die();
    return;
  }
  
  if (checkCollision(player, currentLevel.goal)) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    
    // alert(`Level Complete in ${elapsed}s! Deaths: ${deaths}`);
    
    player.level = (player.level + 1) % levels.length;
    
    resetLevel(true);
  }
}


function drawOutlinedRect(x, y, w, h, fillColor, strokeColor, lineWidth = 3) {
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);
  
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  
  ctx.strokeRect(
    x + lineWidth / 2,
    y + lineWidth / 2,
    w - lineWidth,
    h - lineWidth,
  );
}

function drawEquilateralTriangle(x, y, size, fillColor, strokeColor, lineWidth = 3) {
  const height = size * (Math.sqrt(3) / 2);
  
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y);
  ctx.lineTo(x, y + height);
  
  ctx.lineTo(x + size, y + height);
  ctx.closePath();
  
  ctx.fillStyle = fillColor;
  ctx.fill();
  
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
}

function drawPlatform(platform) {
  const material = getMaterial(platform);
  
  if (platform.broken) return;
  
  drawOutlinedRect(
    platform.x,
    platform.y,
    platform.w,
    platform.h,
    material.color,
    material.outline,
  );
  
  if (platform.durability !== undefined) {
    const damage = 1 - platform.durability / platform.maxDurability;
    
    if (damage > 0) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(platform.x + 5, platform.y + 5);
      ctx.lineTo(platform.x + platform.w / 2, platform.y + platform.h / 2);
      ctx.lineTo(platform.x + platform.w - 5, platform.y + platform.h - 5);
      ctx.stroke();
    }
  }
}

function draw() {
  const currentLevel = levels[player.level];
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  
  bg.addColorStop(0, "#87ceeb");
  bg.addColorStop(1, "#2481a7");
  
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const scale = Math.min(
    canvas.width / VIEW_WIDTH,
    canvas.height / VIEW_HEIGHT,
  );
  
  const offsetX = (canvas.width - VIEW_WIDTH * scale) / 2;
  
  const offsetY = (canvas.height - VIEW_HEIGHT * scale) / 2;
  
  ctx.save();
  
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.clip();
  
  ctx.save();
  
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
  
  for (const p of platforms) {
    drawPlatform(p);
  }
  
  for (const p of movingPlatforms) {
    drawPlatform(p);
  }
  
  drawOutlinedRect(
    currentLevel.goal.x,
    currentLevel.goal.y,
    currentLevel.goal.w,
    currentLevel.goal.h,
    "#8338ec",
    "#5723a1",
  );
  
  drawOutlinedRect(
    player.x,
    player.y,
    player.w,
    player.h,
    "#e63946",
    "#b62b36",
  );
  
  ctx.restore();
  ctx.restore();
}

function loop() {
  update();
  draw();
  
  requestAnimationFrame(loop);
}

loop();
