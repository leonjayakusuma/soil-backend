import express from "express";
import {
    createUser,
    logInUser,
    getNewAccessToken,
    getForgotPswdCode,
    forgotPswd,
    getUserPageInfo,
    emailAndNameExists,
} from "@/controllers/User";
import {
    getSpecialItems,
    getItemReviews,
    getItem,
    getAllItems,
    getAllRecipes,
} from "../controllers/Item";
import {
    validateEmail,
    validatePositiveInt,
    validateString,
} from "@/validators";
import { query } from "express-validator";

export const router = express.Router();

// User
router.get(
    "/userPageInfo",
    validatePositiveInt("userId", query),
    getUserPageInfo,
);
router.post(
    "/signup",
    validateEmail("email"),
    validateString("name"),
    validateString("password"),
    createUser,
);
router.post(
    "/emailAndNameExists",
    validateEmail("email"),
    validateString("name"),
    emailAndNameExists,
);
router.post(
    "/login",
    validateEmail("email"),
    validateString("password"),
    logInUser,
);
router.post(
    "/getNewAccessToken",
    validateString("accessToken"),
    validateString("refreshToken"),
    getNewAccessToken,
);
router.post("/getForgotPswdCode", validateEmail("email"), getForgotPswdCode);
router.post("/forgotPswd", validateString("code"), forgotPswd);

// Item
router.get("/recipes", getAllRecipes);
router.get("/specials", getSpecialItems);
router.get("/allItems", getAllItems);
router.get("/item", validatePositiveInt("itemId", query), getItem);
router.post("/itemReviews", validatePositiveInt("itemId"), getItemReviews);
