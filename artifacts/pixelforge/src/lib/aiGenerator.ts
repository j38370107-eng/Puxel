// Procedural pixel art generation
export const aiGenerator = {
  generate: (prompt: string, width: number, height: number): ImageData => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const p = prompt.toLowerCase();

    // Determine basic attributes
    let color1 = '#5b6ee1';
    let color2 = '#3f51b5';
    if (p.includes('fire') || p.includes('red') || p.includes('dragon')) { color1 = '#d95763'; color2 = '#ac3232'; }
    if (p.includes('tree') || p.includes('green') || p.includes('slime')) { color1 = '#99e550'; color2 = '#6abe30'; }
    if (p.includes('water') || p.includes('potion')) { color1 = '#5fcde4'; color2 = '#37946e'; }
    if (p.includes('gold') || p.includes('coin')) { color1 = '#fbf236'; color2 = '#d9a066'; }
    if (p.includes('sword') || p.includes('metal')) { color1 = '#9badb7'; color2 = '#847e87'; }

    // Clear background (transparent)
    ctx.clearRect(0, 0, width, height);

    const isSymmetric = !p.includes('facing left') && !p.includes('facing right');

    // Base generation: Perlin-ish blob
    const w2 = width / 2;
    const h2 = height / 2;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < (isSymmetric ? w2 : width); x++) {
        // Distance to center
        const dx = x - w2;
        const dy = y - h2;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Random chance based on distance
        const maxRadius = Math.min(w2, h2) * 0.8;
        if (dist < maxRadius) {
          const chance = 1 - (dist / maxRadius);
          if (Math.random() < chance + 0.2) {
            ctx.fillStyle = Math.random() > 0.5 ? color1 : color2;
            ctx.fillRect(x, y, 1, 1);
            if (isSymmetric) {
              ctx.fillRect(width - 1 - x, y, 1, 1);
            }
          }
        }
      }
    }

    // Add outline
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const outlineCtx = canvas.getContext('2d')!;
    outlineCtx.fillStyle = '#140c1c'; // dark outline
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] === 0) { // transparent
          // check neighbors
          const up = ((y - 1) * width + x) * 4 + 3;
          const down = ((y + 1) * width + x) * 4 + 3;
          const left = (y * width + (x - 1)) * 4 + 3;
          const right = (y * width + (x + 1)) * 4 + 3;
          if (data[up] > 0 || data[down] > 0 || data[left] > 0 || data[right] > 0) {
            outlineCtx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    return outlineCtx.getImageData(0, 0, width, height);
  }
};
