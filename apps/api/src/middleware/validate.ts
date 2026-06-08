import { Injectable, PipeTransform } from '@nestjs/common'
import { ZodError, ZodSchema } from 'zod'

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)
    if (!result.success) throw new ZodError(result.error.issues)
    return result.data
  }
}
