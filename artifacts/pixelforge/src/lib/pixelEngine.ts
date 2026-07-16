// Core algorithms for pixel drawing
export const pixelEngine = {
  // Bresenham's line algorithm
  drawLine: (x0: number, y0: number, x1: number, y1: number): {x: number, y: number}[] => {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
      points.push({x: x0, y: y0});
      if ((x0 === x1) && (y0 === y1)) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return points;
  },

  // Rectangle points
  drawRect: (x0: number, y0: number, x1: number, y1: number, fill: boolean): {x: number, y: number}[] => {
    const points = [];
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    if (fill) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          points.push({x, y});
        }
      }
    } else {
      for (let x = minX; x <= maxX; x++) {
        points.push({x, y: minY});
        if (minY !== maxY) points.push({x, y: maxY});
      }
      for (let y = minY + 1; y < maxY; y++) {
        points.push({x: minX, y});
        if (minX !== maxX) points.push({x: maxX, y});
      }
    }
    return points;
  },

  // Ellipse using Bresenham-based approach
  drawEllipse: (x0: number, y0: number, x1: number, y1: number, fill: boolean): {x: number, y: number}[] => {
    const points: {x: number, y: number}[] = [];
    const a = Math.abs(x1 - x0) / 2;
    const b = Math.abs(y1 - y0) / 2;
    const xc = Math.min(x0, x1) + a;
    const yc = Math.min(y0, y1) + b;

    if (a === 0 && b === 0) return [{x: x0, y: y0}];
    if (a === 0) return pixelEngine.drawLine(x0, y0, x1, y1);
    if (b === 0) return pixelEngine.drawLine(x0, y0, x1, y1);

    // Simple midpoint ellipse algorithm
    // For thick/filled ellipses we can just iterate the bounding box and check equation
    const minX = Math.floor(Math.min(x0, x1));
    const maxX = Math.ceil(Math.max(x0, x1));
    const minY = Math.floor(Math.min(y0, y1));
    const maxY = Math.ceil(Math.max(y0, y1));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - xc;
        const dy = y - yc;
        const val = (dx * dx) / (a * a) + (dy * dy) / (b * b);
        
        if (fill) {
          if (val <= 1.0) points.push({x, y});
        } else {
          // Outline roughly: we check if it's close to 1
          // A better approach for outline is to use proper midpoint algorithm
          // But for small canvas, this approximation works:
          const valOut = ((Math.abs(dx) + 0.5)**2) / (a * a) + ((Math.abs(dy) + 0.5)**2) / (b * b);
          const valIn = ((Math.abs(dx) - 0.5)**2) / (a * a) + ((Math.abs(dy) - 0.5)**2) / (b * b);
          if (val <= 1.0 && (valIn < 1.0 ? (valIn > 0.8 && val > 0.8) : true)) {
            // Check neighbors for hollow outline, a simpler hack for pixel art
          }
        }
      }
    }

    if (!fill) {
      // Better outline approach: draw border pixels that have an outside neighbor
      const filled = pixelEngine.drawEllipse(x0, y0, x1, y1, true);
      const set = new Set(filled.map(p => `${p.x},${p.y}`));
      const out = filled.filter(p => {
        return !set.has(`${p.x-1},${p.y}`) || !set.has(`${p.x+1},${p.y}`) || 
               !set.has(`${p.x},${p.y-1}`) || !set.has(`${p.x},${p.y+1}`);
      });
      return out;
    }

    return points;
  },

  // Flood fill (BFS)
  floodFill: (ctx: CanvasRenderingContext2D, x: number, y: number, fillColorStr: string) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    if (x < 0 || y < 0 || x >= width || y >= height) return [];

    // Parse fill color
    let fillR = 0, fillG = 0, fillB = 0, fillA = 255;
    if (fillColorStr.startsWith('#')) {
      const hex = fillColorStr.replace('#', '');
      if (hex.length === 6) {
        fillR = parseInt(hex.substring(0, 2), 16);
        fillG = parseInt(hex.substring(2, 4), 16);
        fillB = parseInt(hex.substring(4, 6), 16);
      }
    } else {
      // Support rgb/rgba strings if needed, keeping simple for now
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const targetIdx = (y * width + x) * 4;
    
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    // If target is same as fill color, do nothing
    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) {
      return [];
    }

    const points: {x: number, y: number}[] = [];
    const queue: {x: number, y: number}[] = [{x, y}];
    const seen = new Uint8Array(width * height);
    seen[y * width + x] = 1;

    while (queue.length > 0) {
      const {x: cx, y: cy} = queue.shift()!;
      points.push({x: cx, y: cy});

      const neighbors = [
        {x: cx + 1, y: cy},
        {x: cx - 1, y: cy},
        {x: cx, y: cy + 1},
        {x: cx, y: cy - 1}
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
          const idx = (n.y * width + n.x) * 4;
          if (!seen[n.y * width + n.x] &&
              data[idx] === targetR &&
              data[idx + 1] === targetG &&
              data[idx + 2] === targetB &&
              data[idx + 3] === targetA) {
            seen[n.y * width + n.x] = 1;
            queue.push(n);
          }
        }
      }
    }
    return points;
  }
};
