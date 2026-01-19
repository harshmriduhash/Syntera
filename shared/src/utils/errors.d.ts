/**
 * Shared Error Utilities
 * Standardized error handling across all services
 */
import { Response } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    code?: string | undefined;
    isOperational: boolean;
    constructor(statusCode: number, message: string, code?: string | undefined, isOperational?: boolean);
}
export interface ErrorResponse {
    error: string;
    code?: string;
    details?: unknown;
}
export declare function handleError(err: unknown, res: Response): Response;
export declare function notFound(res: Response, resource: string, id: string): Response;
export declare function forbidden(res: Response, message?: string): Response;
export declare function badRequest(res: Response, message: string): Response;
export declare function handleApiError(error: unknown, defaultMessage?: string): ErrorResponse;
//# sourceMappingURL=errors.d.ts.map