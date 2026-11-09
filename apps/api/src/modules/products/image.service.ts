import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Secure product-image storage:
 * - validates MIME type and size,
 * - generates random file names (no user-controlled paths),
 * - creates an optimized 320px WebP thumbnail with sharp when available
 *   (falls back to the original file when sharp cannot process the image).
 */
@Injectable()
export class ImageService {
  private logger = new Logger('ImageService');
  readonly uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  readonly maxSize = Number(process.env.MAX_IMAGE_SIZE_BYTES || 5_242_880);

  async ensureDir() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async saveImage(buffer: Buffer, mimeType: string): Promise<{ fileName: string; thumbnailName: string | null; mimeType: string; sizeBytes: number }> {
    const ext = ALLOWED_MIME[mimeType];
    if (!ext) throw new BadRequestException('Faqat JPEG, PNG yoki WebP rasmlar ruxsat etiladi');
    if (buffer.length === 0) throw new BadRequestException('Fayl bo‘sh');
    if (buffer.length > this.maxSize) throw new BadRequestException(`Fayl hajmi ${Math.round(this.maxSize / 1_048_576)}MB dan oshmasligi kerak`);

    await this.ensureDir();
    const fileName = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(this.uploadDir, fileName), buffer);

    let thumbnailName: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharp = require('sharp');
      thumbnailName = `${randomUUID()}.webp`;
      await sharp(buffer)
        .resize(320, 320, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(this.uploadDir, thumbnailName));
    } catch (err) {
      this.logger.warn(`Thumbnail generation failed, using original: ${(err as Error).message}`);
      thumbnailName = null;
    }
    return { fileName, thumbnailName, mimeType, sizeBytes: buffer.length };
  }

  async removeFiles(fileName: string, thumbnailName: string | null) {
    for (const name of [fileName, thumbnailName]) {
      if (!name) continue;
      // Path-traversal guard: only plain file names are allowed.
      if (name.includes('/') || name.includes('\\') || name.includes('..')) continue;
      await fs.unlink(path.join(this.uploadDir, name)).catch(() => undefined);
    }
  }
}
