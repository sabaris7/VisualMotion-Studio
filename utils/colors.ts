
export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export function rgbToHex(r: number, g: number, b: number) {
  return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

function parseColor(color: string): { r: number, g: number, b: number, a: number } | null {
  const str = color.trim().toLowerCase();
  
  if (str.startsWith('#')) {
    let hex = str.substring(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) {
        const num = parseInt(hex, 16);
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 1 };
    }
    if (hex.length === 8) {
        const num = parseInt(hex, 16);
        return { r: (num >> 24) & 255, g: (num >> 16) & 255, b: (num >> 8) & 255, a: (num & 255) / 255 };
    }
  }
  
  if (str.startsWith('rgb')) {
    const parts = str.match(/([\d.]+)/g);
    if (parts && parts.length >= 3) {
        return {
            r: parseFloat(parts[0]),
            g: parseFloat(parts[1]),
            b: parseFloat(parts[2]),
            a: parts[3] ? parseFloat(parts[3]) : 1
        };
    }
  }
  
  return null;
}

export function toHex(color: string): string {
  const c = parseColor(color);
  if (!c) return '#000000';
  return rgbToHex(c.r, c.g, c.b);
}

export function interpolateColor(color1: string, color2: string, t: number): string {
  const start = parseColor(color1);
  const end = parseColor(color2);
  
  if (!start || !end) return t < 0.5 ? color1 : color2;
  
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);
  const a = start.a + (end.a - start.a) * t;
  
  if (a >= 0.995) { 
      return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
