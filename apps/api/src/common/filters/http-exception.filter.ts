import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

/** Normalizes error responses; never leaks internals or stack traces to clients. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ichki server xatoligi';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = Array.isArray(b.message) ? (b.message as string[]).join(', ') : String(b.message ?? exception.message);
        details = b.details;
      }
    } else {
      // Log unexpected errors server-side only.
      this.logger.error(`${req.method} ${req.url}: ${(exception as Error)?.message}`, (exception as Error)?.stack);
    }

    res.status(status).json({ statusCode: status, message, ...(details !== undefined ? { details } : {}) });
  }
}
