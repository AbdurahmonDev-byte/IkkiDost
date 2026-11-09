import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** Validates request body against a Zod schema. */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw new BadRequestException({ message: 'Ma’lumotlar noto‘g‘ri', details });
    }
    return result.data;
  }
}
