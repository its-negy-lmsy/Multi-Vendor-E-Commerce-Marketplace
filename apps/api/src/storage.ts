import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicUploadsDir = path.resolve(__dirname, '../public/uploads');

// Ensure upload directory exists
if (!fs.existsSync(publicUploadsDir)) {
  fs.mkdirSync(publicUploadsDir, { recursive: true });
}

export type UploadResult = {
  url: string;
  provider: 'local' | 's3';
  filename: string;
};

export async function saveBase64Image(dataUrl: string, originalName = 'upload.jpg'): Promise<UploadResult> {
  const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  const ext = originalName.includes('.') ? path.extname(originalName) : '.jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

  if (matches && matches[2]) {
    const buffer = Buffer.from(matches[2], 'base64');
    const targetPath = path.join(publicUploadsDir, filename);
    await fs.promises.writeFile(targetPath, buffer);
    return {
      url: `/uploads/${filename}`,
      provider: 'local',
      filename,
    };
  }

  // If it's already an HTTP URL, return as-is
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return {
      url: dataUrl,
      provider: 'local',
      filename: originalName,
    };
  }

  throw new Error('Invalid image payload; expected data:image/...;base64,...');
}
