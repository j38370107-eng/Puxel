export const humanizer = {
  apply: (imageData: ImageData, options: { amount?: number } = {}): ImageData => {
    const { amount = 1 } = options;
    const data = new Uint8ClampedArray(imageData.data);
    const w = imageData.width;
    const h = imageData.height;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // skip transparent
      
      // 1. Color Jitter (± 5-10)
      if (Math.random() < 0.5 * amount) {
        const jitter = (Math.random() - 0.5) * 15 * amount;
        data[i] = Math.min(255, Math.max(0, data[i] + jitter));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + jitter));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + jitter));
      }

      // 2. Scattered single pixel noise (3%)
      if (Math.random() < 0.03 * amount) {
        const noise = (Math.random() - 0.5) * 40 * amount;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
    }

    // 3. Edge variation (move 1-2 boundary pixels) - Simplified: randomly fade some boundary pixels
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 0) {
          // Check neighbors
          const up = ((y - 1) * w + x) * 4 + 3;
          const down = ((y + 1) * w + x) * 4 + 3;
          const left = (y * w + (x - 1)) * 4 + 3;
          const right = (y * w + (x + 1)) * 4 + 3;
          
          const isEdge = data[up] === 0 || data[down] === 0 || data[left] === 0 || data[right] === 0;
          if (isEdge && Math.random() < 0.1 * amount) {
            // Erode
            data[idx + 3] = 0;
          }
        }
      }
    }

    return new ImageData(data, w, h);
  }
};
