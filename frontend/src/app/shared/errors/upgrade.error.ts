// frontend/src/app/shared/errors/upgrade.error.ts

export class UpgradeError extends Error {
    constructor(
        public originalError: any,
        public message: string,
        public code?: number,
    ) {
        super(message);
    }
}

export class UnauthorizedError extends UpgradeError {
    constructor(originalError: any) {
        super(originalError, "Unauthorized. Please log in again.", 401);
    }
}

export class ServerError extends UpgradeError {
    constructor(originalError: any) {
        super(originalError, "Server error. Please try again later.", 500);
    }
}

export class NotFoundError extends UpgradeError {
    constructor(originalError: any) {
        super(originalError, "Resource not found.", 404);
    }
}

export class ForbiddenError extends UpgradeError {
    constructor(originalError: any) {
        super(originalError, "Access forbidden.", 403);
    }
}
