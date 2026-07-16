import GIF from 'gif.js';

export const encodeGif = async (frames: { dataUrl: string, duration: number }[], width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width,
      height,
      workerScript: '/gif.worker.js' // Requires gif.worker.js in public dir, we might need a workaround or inline it
    });

    // In a browser environment without worker script hosted, gif.js might fail.
    // Setting `workers: 0` makes it run on main thread (slower but works without worker script)
    const gifSync = new GIF({
      workers: 0,
      quality: 10,
      width,
      height,
      transparent: 0x000000 // we can set transparent color
    });

    let loadedFrames = 0;
    frames.forEach((frame) => {
      const img = new Image();
      img.onload = () => {
        gifSync.addFrame(img, { delay: frame.duration });
        loadedFrames++;
        if (loadedFrames === frames.length) {
          gifSync.on('finished', (blob: Blob) => {
            const url = URL.createObjectURL(blob);
            resolve(url);
          });
          gifSync.render();
        }
      };
      img.src = frame.dataUrl;
    });
  });
};
