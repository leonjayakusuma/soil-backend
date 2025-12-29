import { Request, Response, NextFunction } from "express";
import { body, validationResult, ValidationChain } from "express-validator";

// Lightweight sanitizer that strips angle brackets to reduce XSS risk
// without pulling in heavy DOM libraries (which break on serverless/ESM)
const sanitizeInput = (value: any): string => {
    const str = typeof value === 'string' ? value : String(value);
    // Remove basic HTML tags; adjust as needed
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

/* Using a library to validate the types passed in */
export function validatePositiveInt(
    paramName: string,
    validator: (field: string) => ValidationChain = body,
): Array<ValidationChain | ((req: Request, res: Response, next: NextFunction) => void | Response)> {
    return [
        validator(paramName).notEmpty().isInt({ min: 1 }).toInt(),
        (req: Request, res: Response, next: NextFunction): void | Response => {
            console.log(req.query);
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({ msg: "Invalid id" });
            }
            next();
        },
    ];
}

export function validatePositiveFloat(
    paramName: string,
    validator: (field: string) => ValidationChain = body,
): Array<ValidationChain | ((req: Request, res: Response, next: NextFunction) => void | Response)> {
    return [
        validator(paramName).notEmpty().isFloat({ min: 0 }).toFloat(),
        (req: Request, res: Response, next: NextFunction): void | Response => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({ msg: "Invalid id" });
            }
            next();
        },
    ];
}

export function validateString(
    paramName: string,
    validator: (field: string) => ValidationChain = body,
): Array<
    | ValidationChain
    | ((req: Request, res: Response, next: NextFunction) => void | Response)
> {
    return [
        validator(paramName)
            .notEmpty()
            .isString()
            .customSanitizer(sanitizeInput),
        (req: Request, res: Response, next: NextFunction): void | Response => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({ msg: "Invalid string" });
            }
            next();
        },
    ];
}

export function validateEmail(
    paramName: string,
    validator: (field: string) => ValidationChain = body,
): Array<ValidationChain | ((req: Request, res: Response, next: NextFunction) => void | Response)> {
    return [
        validator(paramName)
            .notEmpty()
            .isString()
            .isEmail()
            .customSanitizer(sanitizeInput),
        (req: Request, res: Response, next: NextFunction): void | Response => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({ msg: "Invalid email" });
            }
            next();
        },
    ];
}

export function validateBoolean(
    paramName: string,
    validator: (field: string) => ValidationChain = body,
): Array<ValidationChain | ((req: Request, res: Response, next: NextFunction) => void | Response)> {
    return [
        validator(paramName).notEmpty().isBoolean().toBoolean(),
        (req: Request, res: Response, next: NextFunction): void | Response => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({ msg: "Invalid boolean" });
            }
            next();
        },
    ];
}

// Validator for access tokens - validates but does NOT sanitize to preserve JWT integrity
export function validateAccessToken(
    paramName: string = "accessToken",
    validator: (field: string) => ValidationChain = body,
): Array<
    | ValidationChain
    | ((req: Request, res: Response, next: NextFunction) => void | Response)
> {
    return [
        validator(paramName)
            .notEmpty()
            .withMessage("Access token is required")
            .custom((value) => {
                // Accept any value that can be converted to a non-empty string
                // This handles form-urlencoded data which comes as strings
                if (value === null || value === undefined) {
                    throw new Error("Access token is required");
                }
                const token = String(value).trim();
                if (token.length === 0) {
                    throw new Error("Access token cannot be empty");
                }
                return true;
            }),
        (req: Request, res: Response, next: NextFunction): void | Response => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({ msg: "Invalid access token" });
            }
            // Ensure it's a string (form-urlencoded should already be string, but just in case)
            if (req.body && req.body[paramName] !== undefined) {
                req.body[paramName] = String(req.body[paramName]);
            }
            next();
        },
    ];
}