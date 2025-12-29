import { UserTable } from "../models/user.model";
import { RefreshTokenTable } from "../models/refreshToken.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { CartItemTable } from "../models/cartItem.model";
import { PersonalInfoTable } from "../models/personalInfo.model";
import { ItemTable } from "../models/item.model";
import { ReviewTable } from "../models/review.model";
import { FollowTable } from "../models/follow.model";
import { tryCatchHandler, HttpError } from ".";
import {
    PublicUserInfo,
    ProfileInfo,
    Review,
    PersonalInfo,
    CartItem,
    UserPageInfo,
    UserReview,
} from "../shared/types";
import { getPswdValidities } from "../shared/utils";

// export type UserInfo = {
//     name: string;
//     email: string;
//     pswd: string;
//     dateJoined: string;
//     plannerInfo?: PlannerInfo;
//     cart: CartItemType[];
// };

const { JWT_SECRET } = process.env;

export type Tokens = {
    refreshToken: string;
    accessToken: string;
};

if (!JWT_SECRET) {
    console.error(
        "One or more environment variables are not set. Please refer sample.env for the required format.",
    );
    // Don't exit in serverless - throw error instead
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required');
    }
    process.exit(1);
}

function isPswdValid(name: string, email: string, pswd: string) {
    const { pswdLen, nameOrEmail, ul, ll, nums, specChars } = getPswdValidities(
        name,
        email,
        pswd,
    );

    return pswdLen && nameOrEmail && ul && ll && nums && specChars;
}

function getAccessToken(userId: number) {
    return jwt.sign(
        {
            userId,
        },
        JWT_SECRET as jwt.Secret,
        {
            expiresIn: "1h",
        },
    );
}

function getRefreshToken() {
    return crypto.randomBytes(64).toString("base64");
}

export const getNewAccessToken = tryCatchHandler<string>(async (req) => {
    const { accessToken, refreshToken }: Tokens = req.body;
    // get userId through jwt even if the accessToken has expired
    const { userId } = jwt.decode(accessToken) as { userId: number };
    // I don't check if the userId exists in the db because no harm can be done if an invalid userId is used for the accessToken in this website
    const refreshTokenInDb = RefreshTokenTable.findOne({
        where: { refreshToken, userId },
    });
    if (!refreshTokenInDb) {
        throw new HttpError("Invalid refresh token.", 401);
    }
    return {
        msg: "Successfully renewed refresh token",
        data: getAccessToken(userId),
    };
});

/**
 * Will possibly throw an error
 */
async function createRefreshToken(
    userId: number,
): Promise<Tokens["refreshToken"]> {
    const REFRESH_TOKEN_EXPIRATION = 1000 * 60 * 60 * 24 * 30; // 30 days
    const refreshToken = getRefreshToken();
    await RefreshTokenTable.create({
        userId,
        refreshToken,
        expiration: new Date(new Date().getTime() + REFRESH_TOKEN_EXPIRATION),
    });
    return refreshToken;
}

export const emailAndNameExists = tryCatchHandler<{
    name: boolean;
    email: boolean;
}>(async (req) => {
    const { name, email }: { name: string; email: string } = req.body;
    const nameExists = !!(await UserTable.findOne({ where: { name } }));
    const emailExists = !!(await UserTable.findOne({ where: { email } }));
    return {
        msg: "Name and email checked.",
        data: { name: nameExists, email: emailExists },
    };
});

// https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs
export const createUser = tryCatchHandler<{ id: number } & Tokens>(
    async (req) => {
        const userCount = await UserTable.count();
        if (userCount >= 4_294_967_295) {
            throw new HttpError("User limit reached.", 403);
        }
        const { email, name, password }: ProfileInfo & { password: string } =
            req.body; // Don't bother creating my own type since this is only for type safety
        // the middleware already sanitizes this

        if (password.length > 100) {
            throw new HttpError("Password too long.", 400);
        }
        if (!isPswdValid(name, email, password)) {
            throw new HttpError("Invalid password.", 400);
        }
        const saltRounds = 10; // Default salt rounds recommended
        const pswdHash = await bcrypt.hash(password, saltRounds);

        // If the email does exist, because of the sequalize unique constraint, it will throw an error
        const user = await UserTable.create({
            email,
            name,
            pswdHash,
        });
        const accessToken = getAccessToken(user.id);
        const refreshToken = await createRefreshToken(user.id);
        return {
            msg: "User created successfully.",
            data: { id: user.id, accessToken, refreshToken },
        };
    },
    409,
    "Email or name already taken.",
);

export const logInUser = tryCatchHandler<{ id: number; name: string } & Tokens>(
    async (req) => {
        const { email, password }: { email: string; password: string } =
            req.body;

        const user = await UserTable.findOne({ where: { email }});
        const isMatch = await bcrypt.compare(password, user?.dataValues.pswdHash ?? "");
       

        if (!isMatch || !user) {
            throw new HttpError("Invalid credentials.", 401);
        }

        if(user.isBlocked) {
            throw new HttpError("This account has been blocked. Please contact the admin.", 401)
        }

        const accessToken = getAccessToken(user.id);

        // Only create if the count of the RefreshToken created for this userId doesn't exceed 100
        const count = await RefreshTokenTable.count({
            where: { userId: user.id },
        });
        let refreshToken;
        if (count <= 100) {
            refreshToken = await createRefreshToken(user.id);
        } else {
            const refreshTokenRow = await RefreshTokenTable.findOne({
                where: { userId: user.id },
                order: [["expiration", "DESC"]],
            }); // Returns the top-most row
            if (!refreshTokenRow) {
                throw new Error();
            }
            refreshToken = refreshTokenRow.refreshToken;
        }
        
        console.log(user.id, user.dataValues.name)

        return {
            msg: "Logged in successfully.",
            data: { id: user.id, name: user.dataValues.name, accessToken, refreshToken },
        };
    },
);

export const logOutUser = tryCatchHandler(
    async (req) => {
        const { accessToken }: Tokens = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        await RefreshTokenTable.destroy({ where: { userId } });

        return {
            msg: "Logged out successfully.",
            data: true,
        };
    },
    403,
    "Invalid user",
);

export const deleteUser = tryCatchHandler(
    async (req) => {
        const { accessToken }: Tokens = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        await RefreshTokenTable.destroy({ where: { userId } });
        await UserTable.destroy({ where: { id: userId } });
        return { msg: "User deleted successfully." };
    },
    403,
    "Invalid user",
);

export const checkOldPswd = tryCatchHandler(
    async (req) => {
        const {
            accessToken,
            oldPassword,
        }: {
            accessToken: string;
            oldPassword: string;
        } = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401
        const user = await UserTable.findOne({ where: { id: userId } });

        if (!user) {
            throw new Error();
        }
        if (!(await bcrypt.compare(oldPassword, user.pswdHash))) {
            throw new HttpError("Invalid old password.", 401);
        }

        return {
            msg: "Old password is correct.",
            data: true,
        };
    },
    404,
    "Old password is incorrect.",
);

export const changePassword = tryCatchHandler(
    async (req) => {
        const {
            accessToken,
            oldPassword,
            newPassword,
        }: {
            accessToken: string;
            oldPassword: string;
            newPassword: string;
        } = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        const user = await UserTable.findOne({ where: { id: userId } });

        if (!user) {
            throw new Error();
        }

        if (!(await bcrypt.compare(oldPassword, user.pswdHash))) {
            throw new HttpError("Invalid old password.", 401);
        } else if (!isPswdValid(user.name, user.email, newPassword)) {
            throw new HttpError("Invalid new password.", 403);
        }

        await updatePswd(userId, newPassword);
        return { msg: "Password updated successfully.", data: true };
    },
    404,
    "User not found",
);

export const getForgotPswdCode = tryCatchHandler<string>(
    async (req) => {
        const {
            email,
        }: {
            email: string;
        } = req.body;

        const user = await UserTable.findOne({ where: { email } });

        if (!user) {
            throw new Error();
        }

        const code = jwt.sign({ email }, JWT_SECRET as jwt.Secret, {
            expiresIn: "5m",
        });

        return { msg: "Code sent successfully.", data: code };
    },
    404,
    "No such user with that email",
);

export const forgotPswd = tryCatchHandler<string>(
    async (req) => {
        const { code }: { code: string } = req.body;

        let email = undefined;
        // As of right now sincec this is a simplistic implementation
        // I won't be invalidating the code after one use and could be used until the 5 minutes is up
        try {
            const decoded = jwt.verify(code, JWT_SECRET as jwt.Secret) as {
                email: string;
            };
            email = decoded.email;
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                throw new HttpError("Code has expired", 403);
            } else if (err instanceof jwt.JsonWebTokenError) {
                throw new HttpError("Invalid code", 401);
            } else {
                throw new HttpError(
                    "An unexpecteed error occurred in code verification",
                    500,
                );
            }
        }

        const user = await UserTable.findOne({ where: { email } });

        if (!user) {
            throw new HttpError("User doesn't exist anymore", 404);
        }
        const newPassword = crypto.randomBytes(8).toString("base64");
        await updatePswd(user.id, newPassword);
        return { msg: "Password updated successfully.", data: newPassword };
    },
    403,
    "Code has expired.",
);

async function updatePswd(userId: number, newPassword: string) {
    const saltRounds = 10; // Default salt rounds recommended
    const pswdHash = await bcrypt.hash(newPassword, saltRounds);

    await UserTable.update({ pswdHash }, { where: { id: userId } });
    await RefreshTokenTable.destroy({ where: { userId } });
}

export const getProfileInfo = tryCatchHandler<ProfileInfo>(
    async (req) => {
        const { accessToken }: Tokens = req.body;

        // console.log("something");

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        console.log(userId);
        const user = await UserTable.findOne({
            where: { id: userId },
            attributes: ["id", "name", "email", "dateJoined"],
        });
        if (!user) {
            console.log("what happened here");
            throw new Error();
        }

        // Defensive extraction in case some fields are undefined/null
        const userJson = user.toJSON ? user.toJSON() : (user as any);
        const profileInfo: ProfileInfo = {
            id: user.id ?? userJson.id ?? user.getDataValue("id"),
            name: user.name ?? userJson.name ?? user.getDataValue("name") ?? "",
            email:
                user.email ??
                userJson.email ??
                user.getDataValue("email") ??
                "",
            // Some legacy users may have null/undefined dateJoined. Fall back to empty string.
            dateJoined:
                user.dateJoined ??
                userJson.dateJoined ??
                user.getDataValue("dateJoined")
                    ? (user.dateJoined ??
                          userJson.dateJoined ??
                          user.getDataValue("dateJoined")
                      ).toISOString()
                    : "",
        };

        return { msg: "User found.", data: profileInfo };
    },
    404,
    "User not found.",
);

export const getUserPageInfo = tryCatchHandler<UserPageInfo>(
    async (req) => {
        console.log('getUserPageInfo called, query:', req.query.userId);   // <— add here
        const userId: number = req.query.userId as unknown as number; // Because the middleware already takes care of this
        // console.log(userId);
        const user = await UserTable.findOne({
            where: { id: userId },
            attributes: ["id", "name", "dateJoined"],
        });

        // console.log(user);

        if (!user) {
            throw new Error();
        }

        const reviewsFromDb = await ReviewTable.findAll({
            where: { userId },
            include: [{ model: ItemTable, attributes: ["id", "title"] }],
        });

        // Some legacy rows may reference an itemId that no longer exists.
        // In that case, `review.item` will be undefined; we guard against it
        // instead of throwing a TypeError on `review.item.title`.
        const userReviews: UserReview[] = reviewsFromDb
            .filter((review) => review.item) // drop reviews with missing items
            .map((review) => ({
                reviewId: review.id,
                itemId: review.itemId,
                itemName: review.item!.title, // safe because of filter above
                rating: review.rating,
                reviewTxt: review.isDeleted ? "" : review.reviewTxt,
                dateCreated: review.dateCreated
                    ? review.dateCreated.toISOString()
                    : "",
                isDeleted: review.isDeleted,
            }));

        // console.log("userReviews:", userReviews)

        const numReviews = userReviews.length;
        const meanRating =
            numReviews === 0
                ? 0
                : Math.round(
                      (userReviews.reduce(
                          (acc, review) => acc + review.rating,
                          0,
                      ) /
                          numReviews) *
                          100,
                  ) / 100; // https://stackoverflow.com/a/11832950/23929926

        return {
            msg: "User found.",
            data: {
                id: user.id,
                name: user.name,
                dateJoined: user.dateJoined
                    ? user.dateJoined.toISOString()
                    : "",
                reviews: userReviews,
                numReviews,
                meanRating,
            },
        };
    },
    404,
    "User not found.",
);

export const getUserFollowings = tryCatchHandler<PublicUserInfo[]>(
    async (req) => {
        const { accessToken }: Tokens = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        const followingsFromDb = await UserTable.findAll({
            include: [
                {
                    model: UserTable,
                    as: "following",
                    where: { id: userId },
                    attributes: ["id", "name"],
                },
            ],
        });

        const followings: PublicUserInfo[] = followingsFromDb.map(
            (following) => ({
                id: following.id,
                name: following.name,
                dateJoined: following.dateJoined
                    ? following.dateJoined.toISOString()
                    : "",
            }),
        );

        return { msg: "Followings found.", data: followings };
    },
    404,
    "User not found.",
);

export const isFollowing = tryCatchHandler<boolean>(
    async (req) => {
        const {
            accessToken,
            userId,
        }: {
            accessToken: string;
            userId: number;
        } = req.body;

        // get userId through jwt
        const { userId: followerId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        const isFollowing = await FollowTable.findOne({
            where: { followerId, followingId: userId },
        });

        return { msg: "Followings found.", data: !!isFollowing };
    },
    404,
    "User not found.",
);

export const removeUserFollowing = tryCatchHandler(
    async (req) => {
        const {
            accessToken,
            userIdToRemove,
        }: {
            accessToken: string;
            userIdToRemove: number;
        } = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        await FollowTable.destroy({
            where: { followerId: userId, followingId: userIdToRemove },
        });

        return { msg: "User unfollowed successfully." };
    },
    404,
    "User not found.",
);

export const followUser = tryCatchHandler(
    async (req) => {
        const {
            accessToken,
            userIdToFollow,
        }: {
            accessToken: string;
            userIdToFollow: number;
        } = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        if (userId === userIdToFollow) {
            throw new HttpError("Can't follow yourself.", 403);
        }

        await FollowTable.create({
            followerId: userId,
            followingId: userIdToFollow,
        });

        return { msg: "User followed successfully." };
    },
    404,
    "User not found.",
);

export const getPersonalInfo = tryCatchHandler<PersonalInfo | undefined>(
    async (req) => {
        const { accessToken }: Tokens = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        const personalInfo = await PersonalInfoTable.findOne({
            where: { userId },
        });

        // If the user has not set personal info yet, return a safe default object
        // so the client always gets a data payload instead of `undefined`.
        const defaultPersonalInfo = {
            sex: "male",
            age: 23,
            weight: 68,
            weightGoal: 71,
            weightGainPerWeek: 1,
            height: 170,
            bodyFatPerc: 26,
            activityLevel: "low",
            healthGoal: "health improvements",
            dietaryPreference: "any",
        };

        return {
            msg: "Personal info found.",
            data: personalInfo
                ? {
                      sex: personalInfo.dataValues.isMale ? "male" : "female",
                      age: personalInfo.dataValues.age,
                      weight: personalInfo.dataValues.weight,
                      weightGoal: personalInfo.dataValues.weightGoal,
                      weightGainPerWeek: personalInfo.dataValues.weightGainPerWeek,
                      height: personalInfo.dataValues.height,
                      bodyFatPerc: personalInfo.dataValues.bodyFatPerc,
                      activityLevel: personalInfo.dataValues.activityLevelName,
                      healthGoal: personalInfo.dataValues.healthGoalName,
                      dietaryPreference: personalInfo.dataValues.dietaryPreferenceName,
                  }
                : defaultPersonalInfo,
        }; // TODO: make sure the db names are correct
    },
    404,
    "User not found.",
);

export const getUserCart = tryCatchHandler<CartItem[]>(
    async (req) => {
        const { accessToken }: Tokens = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        // Verify user exists
        const user = await UserTable.findOne({
            where: { id: userId },
        });
        if (!user) {
            throw new Error();
        }

        const cartItemsFromDb = await CartItemTable.findAll({
            where: { userId },
        });

        const cartItems: CartItem[] = await Promise.all(
            cartItemsFromDb.map(async (cartItem) => {
                const itemModel = await ItemTable.findOne({
                    where: { id: cartItem.dataValues.itemId },
                });
                if (!itemModel) {
                    throw new Error(`No item found with id ${cartItem.dataValues.itemId}`);
                }
                const item = itemModel.get({ plain: true });
                return {
                    item,
                    quantity: cartItem.quantity,
                };
            }),
        );

        // const cartItems = cartItemsFromDb.map((cartItem) => ({
        //     itemId: cartItem.itemId,
        //     quantity: cartItem.quantity,
        // }));

        return { msg: "Cart found.", data: cartItems };
    },
    404,
    "User not found.",
);

export const getUserReviews = tryCatchHandler<Review[]>(
    async (req) => {
        const userId: number = req.query.userId as unknown as number; // Because the middleware already takes care of this

        const reviewsFromDb = await ReviewTable.findAll({
            where: { userId },
            include: [
                { model: ItemTable, attributes: ["id"] },
                { model: UserTable, attributes: ["name"] },
            ],
        });

        // Some legacy rows may reference a userId that no longer exists.
        // In that case, `review.user` will be undefined; we guard against it
        // instead of throwing a TypeError on `review.user.name`.
        const reviews = reviewsFromDb
            .filter((review) => review.user) // drop reviews with missing users
            .map((review) => ({
                id: review.id,
                userId: review.userId,
                userName: review.user!.name, // safe because of filter above
                itemId: review.itemId,
                rating: review.rating,
                reviewTxt: review.isDeleted ? "" : review.reviewTxt,
                dateCreated: review.dateCreated
                    ? review.dateCreated.toISOString()
                    : "",
                isDeleted: review.isDeleted,
                isFlagged: review.isFlagged,
            }));

        return { msg: "Reviews found.", data: reviews };
    },
    404,
    "User not found.",
);

export const updateBasicUserInfo = tryCatchHandler(
    async (req) => {
        const { accessToken, name, email }: ProfileInfo & Tokens = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        await UserTable.update({ name, email }, { where: { id: userId } });

        return { msg: "User updated successfully." };
    },
    404,
    "User not found.",
);

export const updatePersonalInfo = tryCatchHandler(
    async (req) => {
        const {
            accessToken,
            isMale,
            age,
            weight,
            weightGoal,
            weightGainPerWeek,
            height,
            bodyFatPerc,
            activityLevel,
            healthGoal,
            dietaryPreference,
        }: Tokens & PersonalInfo & { isMale: boolean } = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        // Checking if the strings match
        if (
            !["low", "med", "high"].includes(activityLevel) ||
            !["weight loss", "health improvements", "muscle gain"].includes(
                healthGoal,
            ) ||
            !["any", "vegetarian", "vegan"].includes(dietaryPreference)
        ) {
            throw new HttpError("Invalid personal info.", 403);
        }

        // Use upsert for a single atomic database operation (INSERT ... ON CONFLICT UPDATE)
        // This is faster than findOrCreate + update as it's a single SQL query
        const [, created] = await PersonalInfoTable.upsert({
            userId,
            isMale,
            age,
            weight,
            weightGoal,
            weightGainPerWeek,
            height,
            bodyFatPerc,
            activityLevelName: activityLevel as "low" | "med" | "high",
            healthGoalName: healthGoal as "weight loss" | "health improvements" | "muscle gain",
            dietaryPreferenceName: dietaryPreference as "any" | "vegetarian" | "vegan",
        }, {
            conflictFields: ['userId'],
        });

        return { 
            msg: created 
                ? "Personal info created successfully." 
                : "Personal info updated successfully." 
        };
    },
    404,
    "User not found.",
);

export const addItemToCart = tryCatchHandler(
    async (req) => {
        const { accessToken, itemId }: { accessToken: string; itemId: number } =
            req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        // Check if item exists in cart, if so then add one to the quantity
        const cartItem = await CartItemTable.findOne({
            where: { userId, itemId },
        });

        if (cartItem) {
            if (cartItem.quantity > 255) {
                throw new HttpError("Item quantity limit reached.", 403);
            }
            // if (cartItem.quantity >= 255) { Just handle this client side and even if someone sends a fetch request to do this it will still error out of the trycatchhandler because of mysql
            //     throw new HttpError("Item quantity limit reached.", 403);
            // }
            await CartItemTable.update(
                { quantity: cartItem.quantity + 1 },
                { where: { userId, itemId } },
            );
        } else {
            await CartItemTable.create({ userId, itemId }); // Default value for quantity in sequelize is 1
        }

        return { msg: "Item added to cart successfully.", data: true };
    },
    404,
    "User not found.",
);

export const updateItemQuantityFromCart = tryCatchHandler(
    async (req) => {
        const {
            accessToken,
            itemId,
            quantity,
        }: {
            accessToken: string;
            itemId: number;
            quantity: number;
        } = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        // Check if item exists in cart, if so then subtract one to the quantity
        // const cartItem = await CartItemTable.findOne({
        //     where: { userId, itemId },
        // });

        // if (cartItem) {
        if (quantity == 0) {
            await CartItemTable.destroy({ where: { userId, itemId } });
        } else {
            await CartItemTable.update(
                { quantity },
                { where: { userId, itemId } },
            );
        }
        // }

        return { msg: "Item removed from cart successfully." };
    },
    404,
    "User not found.",
);

// export const decreaseItemQuantityFromCart = tryCatchHandler(
//     async (req) => {
//         const { accessToken, itemId }: { accessToken: string; itemId: number } =
//             req.body;

//         // get userId through jwt
//         const { userId } = jwt.verify(
//             accessToken,
//             JWT_SECRET as jwt.Secret,
//         ) as {
//             userId: number;
//         }; // try catch handler will handle the error and return 401

//         // Check if item exists in cart, if so then subtract one to the quantity
//         const cartItem = await CartItemTable.findOne({
//             where: { userId, itemId },
//         });

//         if (cartItem) {
//             if (cartItem.quantity <= 1) {
//                 await CartItemTable.destroy({ where: { userId, itemId } });
//             } else {
//                 await CartItemTable.update(
//                     { quantity: cartItem.quantity - 1 },
//                     { where: { userId, itemId } },
//                 );
//             }
//         }

//         return { msg: "Item removed from cart successfully." };
//     },
//     404,
//     "User not found.",
// );

export const deleteItemFromCart = tryCatchHandler(
    async (req) => {
        const { accessToken, itemId }: { accessToken: string; itemId: number } =
            req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        await CartItemTable.destroy({ where: { userId, itemId } });

        return { msg: "Item deleted from cart successfully.", data: true };
    },
    404,
    "User not found.",
);

export const clearCart = tryCatchHandler(
    async (req) => {
        const { accessToken }: Tokens = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        await CartItemTable.destroy({ where: { userId } });

        return { msg: "Cart cleared successfully.", data: true };
    },
    404,
    "User not found.",
);