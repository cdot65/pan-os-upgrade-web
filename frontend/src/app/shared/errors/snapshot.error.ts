// frontend/src/app/shared/errors/inventory.error.ts

import { HttpErrorResponse } from "@angular/common/http";

export class SnapshotError extends Error {
    constructor(
        public originalError: any,
        public message: string,
        public code?: number,
    ) {
        super(message);
    }
}

export class UnauthorizedError extends SnapshotError {
    constructor(originalError: HttpErrorResponse) {
        super(originalError, "Unauthorized. Please log in again.", 401);
    }
}

export class ForbiddenError extends SnapshotError {
    constructor(originalError: HttpErrorResponse) {
        super(originalError, "Access forbidden.", 403);
    }
}

export class NotFoundError extends SnapshotError {
    constructor(originalError: HttpErrorResponse) {
        super(originalError, "Resource not found.", 404);
    }
}

export class ServerError extends SnapshotError {
    constructor(originalError: HttpErrorResponse) {
        super(originalError, "Server error. Please try again later.", 500);
    }
}
