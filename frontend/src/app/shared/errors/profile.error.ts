// frontend/src/app/shared/errors/inventory.error.ts

export class ProfileError extends Error {
    constructor(
        public originalError: any,
        public message: string,
        public code?: number,
    ) {
        super(message);
    }
}

export class UnauthorizedError extends ProfileError {
    constructor(originalError: any) {
        super(originalError, "Unauthorized. Please log in again.", 401);
    }
}

export class ServerError extends ProfileError {
    constructor(originalError: any) {
        super(originalError, "Server error. Please try again later.", 500);
    }
}

export class NotFoundError extends ProfileError {
    constructor(originalError: any) {
        super(originalError, "Resource not found.", 404);
    }
}

export class ForbiddenError extends ProfileError {
    constructor(originalError: any) {
        super(originalError, "Access forbidden.", 403);
    }
}
