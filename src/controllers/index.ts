import { Request, Response } from "express";
export * from "./Item";
export * from "./User";

export class HttpError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

/* Higher order function to send response back to the client */
type ResType<T> = {
    msg: string;
    data?: T;
};
export function tryCatchHandler<T>(
    fn: (req: Request) => Promise<ResType<T>>,
    defaultErrorCode: number = 401,
    defaultErrorMsg: string = "An unexpected error occurred",
) {
    return async (req: Request, res: Response<ResType<T>>) => {
        try {
            const ret = await fn(req);
            res.status(200).json(ret);
        } catch (error) {
            console.error("\nerrored: " + error);
            if (error instanceof HttpError) {
                res.status(error.status).json({ msg: error.message });
            } else {
                const errorCode =
                    error instanceof Error ? defaultErrorCode : 500;
                res.status(errorCode).json({ msg: defaultErrorMsg });
            }
        }
    };
}
