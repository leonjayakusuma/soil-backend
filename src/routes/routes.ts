import express from "express";
import {
    createUser,
    logInUser,
    getNewAccessToken,
    getForgotPswdCode,
    forgotPswd,
    getUserPageInfo,
    emailAndNameExists,
} from "../controllers/User";
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
} from "../config/validators";
import { query } from "express-validator";

export const router = express.Router();

// User
/**
 * @openapi
 * /api/userPageInfo:
 *   get:
 *     summary: Get user page info
 *     tags:
 *       - User
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: User page information returned successfully.
 */
router.get(
    "/userPageInfo",
    validatePositiveInt("userId", query),
    getUserPageInfo,
);

/**
 * @openapi
 * /api/signup:
 *   post:
 *     summary: Sign up a new user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully.
 */
router.post(
    "/signup",
    validateEmail("email"),
    validateString("name"),
    validateString("password"),
    createUser,
);

/**
 * @openapi
 * /api/emailAndNameExists:
 *   post:
 *     summary: Check if email and name already exist
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *             required:
 *               - email
 *               - name
 *     responses:
 *       200:
 *         description: Existence check result.
 */
router.post(
    "/emailAndNameExists",
    validateEmail("email"),
    validateString("name"),
    emailAndNameExists,
);

/**
 * @openapi
 * /api/login:
 *   post:
 *     summary: Log in a user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Login successful.
 */
router.post(
    "/login",
    validateEmail("email"),
    validateString("password"),
    logInUser,
);

/**
 * @openapi
 * /api/getNewAccessToken:
 *   post:
 *     summary: Get a new access token using refresh token
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: New access token issued.
 */
router.post(
    "/getNewAccessToken",
    validateString("accessToken"),
    validateString("refreshToken"),
    getNewAccessToken,
);

/**
 * @openapi
 * /api/getForgotPswdCode:
 *   post:
 *     summary: Request password reset code
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Reset code sent if email exists.
 */
router.post("/getForgotPswdCode", validateEmail("email"), getForgotPswdCode);

/**
 * @openapi
 * /api/forgotPswd:
 *   post:
 *     summary: Reset password using reset code
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Password reset successful.
 */
router.post("/forgotPswd", validateString("code"), forgotPswd);

// Item
/**
 * @openapi
 * /api/recipes:
 *   get:
 *     summary: Get all recipes
 *     tags:
 *       - Item
 *     responses:
 *       200:
 *         description: List of recipes.
 */
router.get("/recipes", getAllRecipes);

/**
 * @openapi
 * /api/specials:
 *   get:
 *     summary: Get special items
 *     tags:
 *       - Item
 *     responses:
 *       200:
 *         description: List of special items.
 */
router.get("/specials", getSpecialItems);

/**
 * @openapi
 * /api/allItems:
 *   get:
 *     summary: Get all items
 *     tags:
 *       - Item
 *     responses:
 *       200:
 *         description: List of all items.
 */
router.get("/allItems", getAllItems);

/**
 * @openapi
 * /api/item:
 *   get:
 *     summary: Get a single item by ID
 *     tags:
 *       - Item
 *     parameters:
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Item returned successfully.
 */
router.get("/item", validatePositiveInt("itemId", query), getItem);

/**
 * @openapi
 * /api/itemReviews:
 *   post:
 *     summary: Get reviews for an item
 *     tags:
 *       - Item
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: integer
 *                 minimum: 1
 *             required:
 *               - itemId
 *     responses:
 *       200:
 *         description: List of item reviews.
 */
router.post("/itemReviews", validatePositiveInt("itemId"), getItemReviews);
