/**
 * Image compression utility using Canvas API.
 * Compresses images >2MB down to ≤2MB by reducing quality.
 */

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_DIMENSION = 2048; // Max width/height
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function isAllowedImageType(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type);
}

export async function compressImage(file: File): Promise<File> {
  // Skip if already small enough
  if (file.size <= MAX_SIZE) return file;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Scale down if too large
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Try decreasing quality until under 2MB
  const outputType = file.type === 'image/png' ? 'image/jpeg' : file.type;
  for (let quality = 0.8; quality >= 0.4; quality -= 0.1) {
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), outputType, quality)
    );
    if (blob.size <= MAX_SIZE) {
      bitmap.close();
      const ext = outputType === 'image/webp' ? '.webp' : '.jpg';
      return new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: outputType });
    }
  }

  // Last resort: further scale down (bitmap still open here)
  canvas.width = Math.round(width * 0.5);
  canvas.height = Math.round(height * 0.5);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close(); // Close after final use

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.5)
  );
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}
