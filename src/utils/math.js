// Math utilities for Aetheria simulation

/**
 * Calculate distance between two points
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance (faster, no sqrt)
 */
export function distanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Check if point is within bounds
 */
export function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

/**
 * Get angle between two points
 */
export function angle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Normalize angle to 0-2PI
 */
export function normalizeAngle(angle) {
  let a = angle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a;
}

/**
 * Random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random float between min and max
 */
export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Check collision between two circles
 */
export function circleCollision(x1, y1, r1, x2, y2, r2) {
  const dist = distance(x1, y1, x2, y2);
  return dist <= r1 + r2;
}
