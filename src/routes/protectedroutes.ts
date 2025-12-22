import express from "express";
import {
    addItemToCart,
    changePassword,
    deleteItemFromCart,
    deleteUser,
    followUser,
    getPersonalInfo,
    getProfileInfo,
    getUserCart,
    getUserFollowings,
    getUserReviews,
    logOutUser,
    // decreaseItemQuantityFromCart,
    updateItemQuantityFromCart,
    removeUserFollowing,
    updateBasicUserInfo,
    updatePersonalInfo,
    isFollowing,
    checkOldPswd,
    clearCart,
} from "../controllers/User";
import { createReview, deleteReview, editReview } from "../controllers/Item";
import {
    validatePositiveInt,
    validateEmail,
    validateString,
    validatePositiveFloat,
    validateBoolean,
} from "../config/validators";
import { query } from "express-validator";

export const protectedRouter = express.Router();

// User
/**
 * @openapi
 * /api/protected/deleteUser:
 *   post:
 *     summary: Delete user account
 *     tags:
 *       - User
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *             required:
 *               - accessToken
 *     responses:
 *       200:
 *         description: User deleted successfully.
 */
protectedRouter.post("/deleteUser", validateString("accessToken"), deleteUser);

/**
 * @openapi
 * /api/protected/logout:
 *   post:
 *     summary: Log out user
 *     tags:
 *       - Auth
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *             required:
 *               - accessToken
 *     responses:
 *       200:
 *         description: Logged out successfully.
 */
protectedRouter.post("/logout", validateString("accessToken"), logOutUser);

/**
 * @openapi
 * /api/protected/changePassword:
 *   post:
 *     summary: Change user password
 *     tags:
 *       - User
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *             required:
 *               - accessToken
 *               - oldPassword
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password changed successfully.
 */
protectedRouter.post(
    "/changePassword",
    validateString("accessToken"),
    validateString("oldPassword"),
    validateString("newPassword"),
    changePassword,
);

/**
 * @openapi
 * /api/protected/checkOldPswd:
 *   post:
 *     summary: Verify old password
 *     tags:
 *       - User
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               oldPassword:
 *                 type: string
 *             required:
 *               - accessToken
 *               - oldPassword
 *     responses:
 *       200:
 *         description: Password verification result.
 */
protectedRouter.post(
    "/checkOldPswd",
    validateString("accessToken"),
    validateString("oldPassword"),
    checkOldPswd,
);

/**
 * @openapi
 * /api/protected/updateBasicUserInfo:
 *   post:
 *     summary: Update basic user information (name and email)
 *     tags:
 *       - User
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *             required:
 *               - accessToken
 *               - name
 *               - email
 *     responses:
 *       200:
 *         description: User info updated successfully.
 */
protectedRouter.post(
    "/updateBasicUserInfo",
    validateString("accessToken"),
    validateString("name"),
    validateEmail("email"),
    updateBasicUserInfo,
);

// Profile
/**
 * @openapi
 * /api/protected/profileInfo:
 *   post:
 *     summary: Get user profile information
 *     tags:
 *       - Profile
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *             required:
 *               - accessToken
 *     responses:
 *       200:
 *         description: Profile information returned successfully.
 */
protectedRouter.post(
    "/profileInfo",
    validateString("accessToken"),
    getProfileInfo,
);

/**
 * @openapi
 * /api/protected/personalInfo:
 *   post:
 *     summary: Get user personal information
 *     tags:
 *       - Profile
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *             required:
 *               - accessToken
 *     responses:
 *       200:
 *         description: Personal information returned successfully.
 */
protectedRouter.post(
    "/personalInfo",
    validateString("accessToken"),
    getPersonalInfo,
);

/**
 * @openapi
 * /api/protected/updatePersonalInfo:
 *   post:
 *     summary: Update user personal information
 *     tags:
 *       - Profile
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               isMale:
 *                 type: boolean
 *               age:
 *                 type: integer
 *                 minimum: 1
 *               weight:
 *                 type: number
 *                 minimum: 0
 *               weightGoal:
 *                 type: number
 *                 minimum: 0
 *               weightGainPerWeek:
 *                 type: number
 *                 minimum: 0
 *               height:
 *                 type: number
 *                 minimum: 0
 *               bodyFatPerc:
 *                 type: number
 *                 minimum: 0
 *               activityLevel:
 *                 type: string
 *               healthGoal:
 *                 type: string
 *               dietaryPreference:
 *                 type: string
 *             required:
 *               - accessToken
 *               - isMale
 *               - age
 *               - weight
 *               - weightGoal
 *               - weightGainPerWeek
 *               - height
 *               - bodyFatPerc
 *               - activityLevel
 *               - healthGoal
 *               - dietaryPreference
 *     responses:
 *       200:
 *         description: Personal information updated successfully.
 */
protectedRouter.post(
    "/updatePersonalInfo",
    validateString("accessToken"),
    validateBoolean("isMale"),
    validatePositiveInt("age"),
    validatePositiveFloat("weight"),
    validatePositiveFloat("weightGoal"),
    validatePositiveFloat("weightGainPerWeek"),
    validatePositiveFloat("height"),
    validatePositiveFloat("bodyFatPerc"),
    validateString("activityLevel"),
    validateString("healthGoal"),
    validateString("dietaryPreference"),
    updatePersonalInfo,
);

// Follow
/**
 * @openapi
 * /api/protected/followings:
 *   post:
 *     summary: Get list of users being followed
 *     tags:
 *       - Follow
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *             required:
 *               - accessToken
 *     responses:
 *       200:
 *         description: List of followings returned successfully.
 */
protectedRouter.post(
    "/followings",
    validateString("accessToken"),
    getUserFollowings,
);

/**
 * @openapi
 * /api/protected/follow:
 *   post:
 *     summary: Follow a user
 *     tags:
 *       - Follow
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               userIdToFollow:
 *                 type: integer
 *                 minimum: 1
 *             required:
 *               - accessToken
 *               - userIdToFollow
 *     responses:
 *       200:
 *         description: User followed successfully.
 */
protectedRouter.post(
    "/follow",
    validateString("accessToken"),
    validatePositiveInt("userIdToFollow"),
    followUser,
);

/**
 * @openapi
 * /api/protected/unfollow:
 *   post:
 *     summary: Unfollow a user
 *     tags:
 *       - Follow
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               userIdToRemove:
 *                 type: integer
 *                 minimum: 1
 *             required:
 *               - accessToken
 *               - userIdToRemove
 *     responses:
 *       200:
 *         description: User unfollowed successfully.
 */
protectedRouter.post(
    "/unfollow",
    validateString("accessToken"),
    validatePositiveInt("userIdToRemove"),
    removeUserFollowing,
);

/**
 * @openapi
 * /api/protected/isFollowing:
 *   post:
 *     summary: Check if currently following a user
 *     tags:
 *       - Follow
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               userId:
 *                 type: number
 *                 minimum: 0
 *             required:
 *               - accessToken
 *               - userId
 *     responses:
 *       200:
 *         description: Following status returned successfully.
 */
protectedRouter.post(
    "/isFollowing",
    validateString("accessToken"),
    validatePositiveFloat("userId"),
    isFollowing,
);

// Cart
/**
 * @openapi
 * /api/protected/cart:
 *   post:
 *     summary: Get user's shopping cart
 *     tags:
 *       - Cart
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *             required:
 *               - accessToken
 *     responses:
 *       200:
 *         description: Cart items returned successfully.
 */
protectedRouter.post("/cart", validateString("accessToken"), getUserCart);

/**
 * @openapi
 * /api/protected/addItemToCart:
 *   post:
 *     summary: Add item to cart
 *     tags:
 *       - Cart
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               itemId:
 *                 type: integer
 *                 minimum: 1
 *             required:
 *               - accessToken
 *               - itemId
 *     responses:
 *       200:
 *         description: Item added to cart successfully.
 */
protectedRouter.post(
    "/addItemToCart",
    validateString("accessToken"),
    validatePositiveInt("itemId"),
    addItemToCart,
);

/**
 * @openapi
 * /api/protected/updateItemQuantityFromCart:
 *   post:
 *     summary: Update item quantity in cart
 *     tags:
 *       - Cart
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               itemId:
 *                 type: integer
 *                 minimum: 1
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *             required:
 *               - accessToken
 *               - itemId
 *               - quantity
 *     responses:
 *       200:
 *         description: Cart item quantity updated successfully.
 */
protectedRouter.post(
    "/updateItemQuantityFromCart",
    validateString("accessToken"),
    validatePositiveInt("itemId"),
    validatePositiveInt("quantity"),
    updateItemQuantityFromCart,
);
// protectedRouter.post(
//     "/decreaseItemQuantityFromCart",
//     validateString("accessToken"),
//     validatePositiveInt("itemId"),
//     decreaseItemQuantityFromCart,
// );
/**
 * @openapi
 * /api/protected/deleteItemFromCart:
 *   post:
 *     summary: Remove item from cart
 *     tags:
 *       - Cart
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               itemId:
 *                 type: integer
 *                 minimum: 1
 *             required:
 *               - accessToken
 *               - itemId
 *     responses:
 *       200:
 *         description: Item removed from cart successfully.
 */
protectedRouter.post(
    "/deleteItemFromCart",
    validateString("accessToken"),
    validatePositiveInt("itemId"),
    deleteItemFromCart,
);

/**
 * @openapi
 * /api/protected/clearCart:
 *   post:
 *     summary: Clear all items from cart
 *     tags:
 *       - Cart
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *             required:
 *               - accessToken
 *     responses:
 *       200:
 *         description: Cart cleared successfully.
 */
protectedRouter.post("/clearCart", validateString("accessToken"), clearCart);

// Reviews
/**
 * @openapi
 * /api/protected/reviews:
 *   get:
 *     summary: Get reviews by a user
 *     tags:
 *       - Reviews
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         required: true
 *     responses:
 *       200:
 *         description: User reviews returned successfully.
 */
protectedRouter.get(
    "/reviews",
    validatePositiveInt("userId", query),
    getUserReviews,
);

/**
 * @openapi
 * /api/protected/createReview:
 *   post:
 *     summary: Create a new review
 *     tags:
 *       - Reviews
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               itemId:
 *                 type: integer
 *                 minimum: 1
 *               rating:
 *                 type: number
 *                 minimum: 0
 *               reviewTxt:
 *                 type: string
 *             required:
 *               - accessToken
 *               - itemId
 *               - rating
 *               - reviewTxt
 *     responses:
 *       200:
 *         description: Review created successfully.
 */
protectedRouter.post(
    "/createReview",
    validateString("accessToken"),
    validatePositiveInt("itemId"),
    validatePositiveFloat("rating"),
    validateString("reviewTxt"),
    createReview,
);

/**
 * @openapi
 * /api/protected/editReview:
 *   post:
 *     summary: Edit an existing review
 *     tags:
 *       - Reviews
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               reviewId:
 *                 type: integer
 *                 minimum: 1
 *               rating:
 *                 type: number
 *                 minimum: 0
 *               reviewTxt:
 *                 type: string
 *             required:
 *               - accessToken
 *               - reviewId
 *               - rating
 *               - reviewTxt
 *     responses:
 *       200:
 *         description: Review updated successfully.
 */
protectedRouter.post(
    "/editReview",
    validateString("accessToken"),
    validatePositiveInt("reviewId"),
    validatePositiveFloat("rating"),
    validateString("reviewTxt"),
    editReview,
);

/**
 * @openapi
 * /api/protected/deleteReview:
 *   post:
 *     summary: Delete a review
 *     tags:
 *       - Reviews
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               reviewId:
 *                 type: integer
 *                 minimum: 1
 *             required:
 *               - accessToken
 *               - reviewId
 *     responses:
 *       200:
 *         description: Review deleted successfully.
 */
protectedRouter.post(
    "/deleteReview",
    validateString("accessToken"),
    validatePositiveInt("reviewId"),
    deleteReview,
);
