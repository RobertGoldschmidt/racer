// Jack Daniels / Jimmy Gilbert VDOT formulas
// Reference: "Oxygen Power" (Gilbert & Daniels) and "Daniels' Running Formula"

function oxygenCost(v) {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

function pctVO2max(t) {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

export function calcVDOT(distanceMeters, timeMinutes) {
  const velocity = distanceMeters / timeMinutes;
  const vo2 = oxygenCost(velocity);
  const pct = pctVO2max(timeMinutes);
  return vo2 / pct;
}

export function predictRaceTime(vdot, distanceMeters) {
  let lo = 1;
  let hi = 600;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const computed = calcVDOT(distanceMeters, mid);
    if (computed > vdot) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}

export const VDOT_TABLE = {
  30: { tenK: 3829, threshold: 384, interval: 353 },
  31: { tenK: 3725, threshold: 374, interval: 344 },
  32: { tenK: 3627, threshold: 365, interval: 335 },
  33: { tenK: 3534, threshold: 356, interval: 327 },
  34: { tenK: 3445, threshold: 348, interval: 319 },
  35: { tenK: 3362, threshold: 340, interval: 312 },
  36: { tenK: 3282, threshold: 332, interval: 305 },
  37: { tenK: 3207, threshold: 325, interval: 298 },
  38: { tenK: 3135, threshold: 318, interval: 292 },
  39: { tenK: 3066, threshold: 312, interval: 286 },
  40: { tenK: 3001, threshold: 306, interval: 280 },
  41: { tenK: 2938, threshold: 300, interval: 275 },
  42: { tenK: 2878, threshold: 294, interval: 269 },
  43: { tenK: 2821, threshold: 288, interval: 264 },
  44: { tenK: 2766, threshold: 283, interval: 259 },
  45: { tenK: 2713, threshold: 278, interval: 255 },
  46: { tenK: 2663, threshold: 273, interval: 250 },
  47: { tenK: 2614, threshold: 268, interval: 246 },
  48: { tenK: 2568, threshold: 264, interval: 242 },
  49: { tenK: 2523, threshold: 259, interval: 238 },
  50: { tenK: 2480, threshold: 255, interval: 234 },
  51: { tenK: 2438, threshold: 251, interval: 230 },
  52: { tenK: 2398, threshold: 247, interval: 227 },
  53: { tenK: 2359, threshold: 243, interval: 223 },
  54: { tenK: 2322, threshold: 240, interval: 220 },
  55: { tenK: 2286, threshold: 236, interval: 216 },
  56: { tenK: 2251, threshold: 233, interval: 213 },
  57: { tenK: 2217, threshold: 229, interval: 210 },
  58: { tenK: 2184, threshold: 226, interval: 207 },
  59: { tenK: 2153, threshold: 223, interval: 205 },
  60: { tenK: 2122, threshold: 220, interval: 202 },
  61: { tenK: 2092, threshold: 217, interval: 199 },
  62: { tenK: 2063, threshold: 214, interval: 196 },
  63: { tenK: 2035, threshold: 212, interval: 194 },
  64: { tenK: 2008, threshold: 209, interval: 191 },
  65: { tenK: 1982, threshold: 206, interval: 189 },
  66: { tenK: 1956, threshold: 204, interval: 187 },
  67: { tenK: 1932, threshold: 201, interval: 185 },
  68: { tenK: 1907, threshold: 199, interval: 182 },
  69: { tenK: 1884, threshold: 197, interval: 180 },
  70: { tenK: 1861, threshold: 194, interval: 178 },
  71: { tenK: 1839, threshold: 192, interval: 176 },
  72: { tenK: 1817, threshold: 190, interval: 174 },
  73: { tenK: 1796, threshold: 188, interval: 172 },
  74: { tenK: 1775, threshold: 186, interval: 170 },
  75: { tenK: 1755, threshold: 184, interval: 168 },
  76: { tenK: 1736, threshold: 182, interval: 167 },
  77: { tenK: 1717, threshold: 180, interval: 165 },
  78: { tenK: 1698, threshold: 178, interval: 163 },
  79: { tenK: 1680, threshold: 176, interval: 162 },
  80: { tenK: 1662, threshold: 174, interval: 160 },
  81: { tenK: 1645, threshold: 173, interval: 158 },
  82: { tenK: 1628, threshold: 171, interval: 157 },
  83: { tenK: 1611, threshold: 169, interval: 155 },
  84: { tenK: 1595, threshold: 168, interval: 154 },
  85: { tenK: 1579, threshold: 166, interval: 152 },
};

function interpolateVdot(entries, secPerKm) {
  for (let i = 0; i < entries.length - 1; i++) {
    const [v1, p1] = entries[i];
    const [v2, p2] = entries[i + 1];
    if (secPerKm <= p1 && secPerKm >= p2) {
      const frac = (p1 - secPerKm) / (p1 - p2);
      return v1 + frac * (v2 - v1);
    }
  }
  // Extrapolate linearly beyond table bounds instead of clamping
  if (secPerKm > entries[0][1]) {
    // Slower than VDOT 30: extrapolate downward
    const slope = (entries[1][0] - entries[0][0]) / (entries[0][1] - entries[1][1]);
    return entries[0][0] - (secPerKm - entries[0][1]) * slope;
  }
  // Faster than VDOT 85: extrapolate upward
  const n = entries.length;
  const slope = (entries[n - 1][0] - entries[n - 2][0]) / (entries[n - 2][1] - entries[n - 1][1]);
  return entries[n - 1][0] + (entries[n - 1][1] - secPerKm) * slope;
}

export function vdotFromThresholdPace(secPerKm) {
  const entries = Object.entries(VDOT_TABLE).map(([v, d]) => [Number(v), d.threshold]);
  return interpolateVdot(entries, secPerKm);
}

export function vdotFromIntervalPace(secPerKm) {
  const entries = Object.entries(VDOT_TABLE).map(([v, d]) => [Number(v), d.interval]);
  return interpolateVdot(entries, secPerKm);
}
