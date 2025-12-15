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
} from "@/controllers/User";
import { createReview, deleteReview, editReview } from "../controllers/Item";
import {
    validatePositiveInt,
    validateEmail,
    validateString,
    validatePositiveFloat,
    validateBoolean,
} from "../validators";
import { query } from "express-validator";

export const protectedRouter = express.Router();

// User
protectedRouter.post("/deleteUser", validateString("accessToken"), deleteUser);
protectedRouter.post("/logout", validateString("accessToken"), logOutUser);
protectedRouter.post(
    "/changePassword",
    validateString("accessToken"),
    validateString("oldPassword"),
    validateString("newPassword"),
    changePassword,
);
protectedRouter.post(
    "/checkOldPswd",
    validateString("accessToken"),
    validateString("oldPassword"),
    checkOldPswd,
);
protectedRouter.post(
    "/updateBasicUserInfo",
    validateString("accessToken"),
    validateString("name"),
    validateEmail("email"),
    updateBasicUserInfo,
);

// Profile
protectedRouter.post(
    "/profileInfo",
    validateString("accessToken"),
    getProfileInfo,
);
protectedRouter.post(
    "/personalInfo",
    validateString("accessToken"),
    getPersonalInfo,
);
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
protectedRouter.post(
    "/followings",
    validateString("accessToken"),
    getUserFollowings,
);
protectedRouter.post(
    "/follow",
    validateString("accessToken"),
    validatePositiveInt("userIdToFollow"),
    followUser,
);
protectedRouter.post(
    "/unfollow",
    validateString("accessToken"),
    validatePositiveInt("userIdToRemove"),
    removeUserFollowing,
);
protectedRouter.post(
    "/isFollowing",
    validateString("accessToken"),
    validatePositiveFloat("userId"),
    isFollowing,
);

// Cart
protectedRouter.post("/cart", validateString("accessToken"), getUserCart);
protectedRouter.post(
    "/addItemToCart",
    validateString("accessToken"),
    validatePositiveInt("itemId"),
    addItemToCart,
);
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
protectedRouter.post(
    "/deleteItemFromCart",
    validateString("accessToken"),
    validatePositiveInt("itemId"),
    deleteItemFromCart,
);
protectedRouter.post("/clearCart", validateString("accessToken"), clearCart);

// Reviews
protectedRouter.get(
    "/reviews",
    validatePositiveInt("userId", query),
    getUserReviews,
);
protectedRouter.post(
    "/createReview",
    validateString("accessToken"),
    validatePositiveInt("itemId"),
    validatePositiveFloat("rating"),
    validateString("reviewTxt"),
    createReview,
);
protectedRouter.post(
    "/editReview",
    validateString("accessToken"),
    validatePositiveInt("reviewId"),
    validatePositiveFloat("rating"),
    validateString("reviewTxt"),
    editReview,
);
protectedRouter.post(
    "/deleteReview",
    validateString("accessToken"),
    validatePositiveInt("reviewId"),
    deleteReview,
);
