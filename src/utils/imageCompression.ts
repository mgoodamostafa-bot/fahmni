/**
 * Compresses an image file by resizing it and reducing its quality.
 * Optionally removes outer white background (smart transparency).
 * Returns a Base64 string of the compressed image.
 */
export const compressImage = (
  file: File,
  maxWidth: number = 150,
  maxHeight: number = 150,
  quality: number = 0.5,
  format: 'image/jpeg' | 'image/webp' = 'image/webp',
  removeWhiteBackground: boolean = false
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize keeping aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use a white background for JPEG fallback if transparent
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        // Draw the image first
        ctx.drawImage(img, 0, 0, width, height);

        // Remove white background if requested (Smart WebP Transparency)
        if (removeWhiteBackground && format === 'image/webp') {
          try {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            const visited = new Uint8Array(width * height);
            const queue: [number, number][] = [];

            // A pixel is near-white if R, G, B are high and it is visible (alpha > 10)
            const isNearWhite = (r: number, g: number, b: number, a: number) => {
              return a > 10 && r > 215 && g > 215 && b > 215;
            };

            // Initialize queue with border pixels to do flood-fill from boundaries
            for (let x = 0; x < width; x++) {
              // Top border
              const idx = x * 4;
              if (isNearWhite(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                visited[x] = 1;
                queue.push([x, 0]);
              }
              // Bottom border
              const bottomY = height - 1;
              const bIdx = (bottomY * width + x) * 4;
              if (isNearWhite(data[bIdx], data[bIdx + 1], data[bIdx + 2], data[bIdx + 3])) {
                visited[bottomY * width + x] = 1;
                queue.push([x, bottomY]);
              }
            }

            for (let y = 0; y < height; y++) {
              // Left border
              const idx = y * width * 4;
              if (isNearWhite(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                visited[y * width] = 1;
                queue.push([0, y]);
              }
              // Right border
              const rightX = width - 1;
              const rIdx = (y * width + rightX) * 4;
              if (isNearWhite(data[rIdx], data[rIdx + 1], data[rIdx + 2], data[rIdx + 3])) {
                visited[y * width + rightX] = 1;
                queue.push([rightX, y]);
              }
            }

            // Breadth-First Search Flood Fill
            let queueIndex = 0;
            while (queueIndex < queue.length) {
              const [cx, cy] = queue[queueIndex++];
              const idx = (cy * width + cx) * 4;

              // Clear color values and make transparent
              data[idx] = 0;
              data[idx + 1] = 0;
              data[idx + 2] = 0;
              data[idx + 3] = 0; // Set Alpha to 0 (Transparent)

              // Check 4 neighbors
              const neighbors = [
                [cx + 1, cy],
                [cx - 1, cy],
                [cx, cy + 1],
                [cx, cy - 1],
              ];

              for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const vIdx = ny * width + nx;
                  if (visited[vIdx] === 0) {
                    const nIdx = vIdx * 4;
                    if (isNearWhite(data[nIdx], data[nIdx + 1], data[nIdx + 2], data[nIdx + 3])) {
                      visited[vIdx] = 1;
                      queue.push([nx, ny]);
                    }
                  }
                }
              }
            }

            ctx.putImageData(imgData, 0, 0);
          } catch (e) {
            console.error('Flood-fill transparency failed:', e);
          }
        }

        const base64 = canvas.toDataURL(format, quality);
        resolve(base64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Automatically detects if a base64 image has a white background,
 * and if so, runs a BFS flood-fill starting from the edges to make it transparent.
 */
export const removeWhiteBgFromBase64 = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = img.width;
      const height = img.height;

      if (width <= 2 || height <= 2) {
        resolve(base64Str);
        return;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0);

      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        const isNearWhite = (r: number, g: number, b: number, a: number) => {
          return a > 10 && r > 215 && g > 215 && b > 215;
        };

        const c1 = isNearWhite(data[0], data[1], data[2], data[3]);
        const c2 = isNearWhite(
          data[(width - 1) * 4],
          data[(width - 1) * 4 + 1],
          data[(width - 1) * 4 + 2],
          data[(width - 1) * 4 + 3]
        );
        const c3 = isNearWhite(
          data[(height - 1) * width * 4],
          data[(height - 1) * width * 4 + 1],
          data[(height - 1) * width * 4 + 2],
          data[(height - 1) * width * 4 + 3]
        );
        const c4 = isNearWhite(
          data[((height - 1) * width + width - 1) * 4],
          data[((height - 1) * width + width - 1) * 4 + 1],
          data[((height - 1) * width + width - 1) * 4 + 2],
          data[((height - 1) * width + width - 1) * 4 + 3]
        );

        if (c1 || c2 || c3 || c4) {
          const visited = new Uint8Array(width * height);
          const queue: [number, number][] = [];

          for (let x = 0; x < width; x++) {
            const idx = x * 4;
            if (isNearWhite(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
              visited[x] = 1;
              queue.push([x, 0]);
            }
            const bottomY = height - 1;
            const bIdx = (bottomY * width + x) * 4;
            if (isNearWhite(data[bIdx], data[bIdx + 1], data[bIdx + 2], data[bIdx + 3])) {
              visited[bottomY * width + x] = 1;
              queue.push([x, bottomY]);
            }
          }

          for (let y = 0; y < height; y++) {
            const idx = y * width * 4;
            if (isNearWhite(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
              visited[y * width] = 1;
              queue.push([0, y]);
            }
            const rightX = width - 1;
            const rIdx = (y * width + rightX) * 4;
            if (isNearWhite(data[rIdx], data[rIdx + 1], data[rIdx + 2], data[rIdx + 3])) {
              visited[y * width + rightX] = 1;
              queue.push([rightX, y]);
            }
          }

          let queueIndex = 0;
          let pixelsRemoved = 0;
          while (queueIndex < queue.length) {
            const [cx, cy] = queue[queueIndex++];
            const idx = (cy * width + cx) * 4;

            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 0;
            pixelsRemoved++;

            const neighbors = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1],
            ];

            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const vIdx = ny * width + nx;
                if (visited[vIdx] === 0) {
                  const nIdx = vIdx * 4;
                  if (isNearWhite(data[nIdx], data[nIdx + 1], data[nIdx + 2], data[nIdx + 3])) {
                    visited[vIdx] = 1;
                    queue.push([nx, ny]);
                  }
                }
              }
            }
          }

          if (pixelsRemoved > 0) {
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/webp', 0.9));
            return;
          }
        }
      } catch (e) {
        console.error('removeWhiteBgFromBase64 error:', e);
      }
      resolve(base64Str);
    };
    img.onerror = () => resolve(base64Str);
  });
};
