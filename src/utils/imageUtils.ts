/**
 * Compress an uploaded photo in the browser before sending it to the server,
 * so phone photos (5-15MB) upload quickly and load fast for customers.
 */
export async function optimizeImageFile(file: File, maxWidth = 1600, maxHeight = 1200, quality = 0.84): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ไม่สามารถเปิดไฟล์รูปภาพนี้ได้ (ลองบันทึกเป็น JPG แล้วอัปโหลดใหม่)'));
      el.src = objectUrl;
    });

    let { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) throw new Error('ไฟล์รูปภาพเสียหาย');
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการปรับขนาดรูป');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/webp', quality);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Photos to show for a room: the admin's photos if any, otherwise the defaults. */
export function getRoomImages(room: { id: string; images: string[] }, customImages?: Record<string, string[]>): string[] {
  const custom = customImages?.[room.id];
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return room.images || [];
}

/** Shown instead of a broken photo link. */
export const IMAGE_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'><rect width='160' height='100' fill='#e0f2fe'/><text x='80' y='58' font-size='34' text-anchor='middle'>🏖️</text></svg>"
  );

export function handleImageError(e: { currentTarget: HTMLImageElement }) {
  const img = e.currentTarget;
  if (img.src !== IMAGE_FALLBACK) img.src = IMAGE_FALLBACK;
}
