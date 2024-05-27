/* eslint-disable max-len */
// src/app/shared/errors/auth.error.ts

/**
 * Represents an authentication error.
 */
export class AuthError extends Error {
    /**
     * Creates a new instance of the AuthError class.
     * @param originalError The original error object.
     * @param message The error message.
     * @param code The error code (optional).
     */
    constructor(
        public originalError: any,
        public message: string,
        public code?: number,
    ) {
        super(message);
    }
}

/**
 * Represents an error that occurs when invalid credentials are provided or unauthorized access is attempted.
 * Inherits from the base AuthError class.
 */
export class InvalidCredentialsError extends AuthError {
    /**
     * Creates a new instance of the InvalidCredentialsError class.
     * @param originalError The original error object.
     * @param message The error message.
     */
    constructor(originalError: any, message: string) {
        if (!message) {
            message = "Invalid credentials or unauthorized access.";

            if (
                originalError?.error?.non_field_errors &&
                originalError.error.non_field_errors.length > 0
            ) {
                // Get the first error message
                message = originalError.error.non_field_errors[0];
            }
        }

        super(originalError, message, 401);
    }
}

/**
 * Represents an error that occurs during the registration process.
 * Inherits from the AuthError class.
 */
export class RegistrationError extends AuthError {
    /**
     * Creates a new instance of the RegistrationError class.
     * @param originalError The original error that occurred during registration.
     */
    constructor(originalError: any) {
        super(originalError, "Registration failed.", 400); // Or appropriate error code
    }
}
