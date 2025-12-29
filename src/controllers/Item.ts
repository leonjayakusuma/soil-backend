import { ReviewTable } from "../models/review.model";
import { UserTable } from "../models/user.model";
import jwt from "jsonwebtoken";
import { Item, Review } from "../shared/types";
import { tryCatchHandler, HttpError, Tokens } from ".";
import { ItemTable } from "../models/item.model";
import { TagTable } from "../models/tag.model";
import { ItemTagTable } from "../models/itemTag.model";
import sequelize from "../config/database";
import { IngredientTable } from "../models/ingredient.model";
import { RecipeTable } from "../models/recipe.model";
import { Recipe } from "../shared/types";
import { InstructionTable } from "../models/instruction.model";
import { RecipeIngredientTable } from "../models/recipeIngredient.model";
// import Sentiment from "sentiment";
// import { Filter } from "bad-words";

// Fix bad-words import - it's a default export that needs to be instantiated
// const BadWordsFilter = Filter as any;

const { JWT_SECRET } = process.env;

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

/**
 * THe objects returned by sequelize are different from the plain items we need to return and has some funky behaviour so I manually extract them into the format we need
 */

export const getAllRecipes = tryCatchHandler<Recipe[]>(
    async (_req) => {
        try {
            // First try to get recipes without associations to see if basic query works
            const recipesFromDb = await RecipeTable.findAll({
                include: [
                    {
                        model: IngredientTable,
                        as: "ingredients",
                        through: { attributes: [] },
                        required: false,
                    },
                    {
                        model: InstructionTable,
                        as: "instructions",
                        required: false,
                        separate: true, // Use separate query for better performance
                        order: [["stepNo", "ASC"]],
                    },
                ],
            });

            if (!recipesFromDb || recipesFromDb.length === 0) {
                return { msg: "No recipes found", data: [] };
            }

            const recipes: Recipe[] = await Promise.all(
                recipesFromDb.map(async (recipeFromDb) => {
                    // Safely access ingredients
                    let ingredients: string[] = [];
                    if (recipeFromDb.ingredients && Array.isArray(recipeFromDb.ingredients)) {
                        ingredients = recipeFromDb.ingredients.map((ingredient) => ingredient.name);
                    } else {
                        // Fallback: load ingredients separately if not included
                        const recipeIngredients = await RecipeIngredientTable.findAll({
                            where: { recipeId: recipeFromDb.id },
                        });
                        ingredients = recipeIngredients.map((ri) => ri.ingredientName);
                    }

                    // Safely access instructions
                    let instructions: string[] = [];
                    if (recipeFromDb.instructions && Array.isArray(recipeFromDb.instructions)) {
                        instructions = recipeFromDb.instructions.map((instruction) => instruction.instruction);
                    } else {
                        // Fallback: load instructions separately if not included
                        const recipeInstructions = await InstructionTable.findAll({
                            where: { recipeId: recipeFromDb.id },
                            order: [["stepNo", "ASC"]],
                        });
                        instructions = recipeInstructions.map((inst) => inst.instruction);
                    }

                    return {
                        id: recipeFromDb.id,
                        name: recipeFromDb.name,
                        link: recipeFromDb.link,
                        calories: recipeFromDb.calories,
                        carbs: recipeFromDb.carbs,
                        fat: recipeFromDb.fat,
                        protein: recipeFromDb.protein,
                        ingredients,
                        instructions,
                    };
                })
            );

            return { msg: "All recipes fetched successfully", data: recipes };
        } catch (error: any) {
            console.error("Error in getAllRecipes:", error);
            console.error("Error details:", error?.message, error?.stack);
            throw error;
        }
    },
    500,
    "Failed to fetch recipes",
);

export const getSpecialItems = tryCatchHandler<Item[]>(
    async (_req) => {
        const specialItemsFromDb = await ItemTable.findAll({
            where: { isSpecial: true },
            include: [
                {
                    model: TagTable,
                    attributes: ["name"],
                    through: { attributes: [] },
                },
            ],
        });

        const specials = await Promise.all(
            specialItemsFromDb.map((itemFromDb) => getFullItemData(itemFromDb)),
        );

        return {
            msg: "Special items fetched successfully",
            data: specials,
        };
    },
    500,
    "Failed to fetch special items",
);

export async function getFullItemData(itemFromDb: ItemTable): Promise<Item> {
    try {
        const reviewsData: {
            reviewCount?: number;
            reviewRating?: number;
        }[] = (await ReviewTable.findAll({
            where: { itemId: itemFromDb.id, isDeleted: false },
            attributes: [
                [sequelize.fn("COUNT", sequelize.col("itemId")), "reviewCount"],
                [sequelize.fn("AVG", sequelize.col("rating")), "reviewRating"],
            ],
            group: ["itemId"],
            raw: true,
        })) as {
            reviewCount?: number;
            reviewRating?: number;
        }[];

        const reviewCount = reviewsData[0]?.reviewCount || 0;
        const reviewRating = reviewsData[0]?.reviewRating || 0;

        // Get plain object from Sequelize model to ensure all fields are accessible
        const itemData = itemFromDb.toJSON ? itemFromDb.toJSON() : itemFromDb;
        const itemDataWithTags = itemData as any; // Type assertion to access tags property

        // Extract tags - check both the model instance and JSON representation
        let tags: string[] = [];
        
        // First try to get tags from the model instance (if include worked)
        if (itemFromDb.tags && Array.isArray(itemFromDb.tags) && itemFromDb.tags.length > 0) {
            tags = itemFromDb.tags.map((tag: any) => {
                // Handle both TagTable instances and plain objects
                return tag.name || tag.getDataValue?.('name') || tag;
            });
        } 
        // If not found, try from the JSON representation
        else if (itemDataWithTags.tags && Array.isArray(itemDataWithTags.tags) && itemDataWithTags.tags.length > 0) {
            tags = itemDataWithTags.tags.map((tag: any) => {
                // Handle both TagTable instances and plain objects
                return tag.name || tag;
            });
        }
        // Fallback: manually load tags if they weren't included
        else {
            try {
                const itemTags = await ItemTagTable.findAll({
                    where: { itemId: itemFromDb.id },
                    attributes: ['tagName'],
                    raw: true,
                });
                
                tags = itemTags
                    .map((itemTag: any) => itemTag.tagName)
                    .filter((name: string | undefined) => name !== undefined && name !== null);
            } catch (tagError) {
                console.error(`Error loading tags for item ${itemFromDb.id}:`, tagError);
                tags = [];
            }
        }
        
        // Handle price - ensure we get it correctly from Sequelize
        // Try direct property access first, then getDataValue as fallback
        let price: number | null | undefined = itemFromDb.price;
        
        // If price is undefined, try accessing via getDataValue (Sequelize method)
        if (price === undefined) {
            price = itemFromDb.getDataValue('price') as number | null | undefined;
        }
        
        // Handle string conversion if needed (shouldn't happen but be safe)
        if (typeof price === 'string') {
            const parsed = parseFloat(price);
            price = isNaN(parsed) ? null : parsed;
        }

        // Only default to 0 if price is null or undefined, not if it's actually 0
        const finalPrice = (price === null || price === undefined || (typeof price === 'number' && isNaN(price))) ? 0 : Number(price);
        
        // Use getDataValue as fallback for any missing fields
        return {
            id: itemData.id ?? itemFromDb.getDataValue('id'),
            title: itemData.title ?? itemFromDb.getDataValue('title') ?? '',
            desc: itemData.description ?? itemFromDb.getDataValue('description') ?? '',
            price: finalPrice,
            discount: itemData.discount ?? itemFromDb.getDataValue('discount') ?? 0,
            tags,
            reviewCount,
            reviewRating: Math.round(reviewRating * 100) / 100,
            isSpecial: itemData.isSpecial ?? itemFromDb.getDataValue('isSpecial') ?? false,
            imgUrl: itemData.imgUrl ?? itemFromDb.getDataValue('imgUrl') ?? undefined,
        };
    } catch (error) {
        console.error("Error in getFullItemData for item:", itemFromDb.id, error);
        throw error;
    }
}

export const getItem = tryCatchHandler<Item>(
    async (req) => {
        const itemId = req.query.itemId as unknown as number; // Middleware already takes care of it being present and the correct type

        // Use sequelize to fetch item from database
        const itemFromDb = await ItemTable.findByPk(itemId, {
            include: [
                {
                    model: TagTable,
                    attributes: ["name"],
                    through: { attributes: [] },
                },
            ],
        });

        if (!itemFromDb) {
            throw new Error();
        }

        const item = await getFullItemData(itemFromDb);

        return { msg: "Item fetched successfully", data: item };
    },
    404,
    "Item not found",
);

export const getAllItems = tryCatchHandler<Item[]>(
    async (_req) => {
        try {
            // Fetch all items with tags in a single query
            const itemsFromDb = await ItemTable.findAll({
                include: [
                    {
                        model: TagTable,
                        attributes: ["name"],
                        through: { attributes: [] },
                    },
                ],
            });

            if (!itemsFromDb || itemsFromDb.length === 0) {
                return { msg: "No items found", data: [] };
            }

            // Fetch all review aggregations in a single query (much faster than N+1 queries)
            const itemIds = itemsFromDb.map(item => item.id);
            const reviewsData = (await ReviewTable.findAll({
                where: { 
                    itemId: itemIds,
                    isDeleted: false 
                },
                attributes: [
                    'itemId',
                    [sequelize.fn("COUNT", sequelize.col("itemId")), "reviewCount"],
                    [sequelize.fn("AVG", sequelize.col("rating")), "reviewRating"],
                ],
                group: ["itemId"],
                raw: true,
            })) as unknown as Array<{
                itemId: number;
                reviewCount: string | number;
                reviewRating: string | number | null;
            }>;

            // Create a map for O(1) lookup of review data
            const reviewMap = new Map<number, { reviewCount: number; reviewRating: number }>();
            reviewsData.forEach(review => {
                reviewMap.set(review.itemId, {
                    reviewCount: Number(review.reviewCount) || 0,
                    reviewRating: review.reviewRating ? Math.round(Number(review.reviewRating) * 100) / 100 : 0,
                });
            });

            // Process items in parallel without additional database queries
            const items = itemsFromDb.map((itemFromDb) => {
                const itemData = itemFromDb.toJSON ? itemFromDb.toJSON() : itemFromDb;
                const itemDataWithTags = itemData as any;

                // Extract tags
                let tags: string[] = [];
                if (itemFromDb.tags && Array.isArray(itemFromDb.tags) && itemFromDb.tags.length > 0) {
                    tags = itemFromDb.tags.map((tag: any) => tag.name || tag.getDataValue?.('name') || tag);
                } else if (itemDataWithTags.tags && Array.isArray(itemDataWithTags.tags) && itemDataWithTags.tags.length > 0) {
                    tags = itemDataWithTags.tags.map((tag: any) => tag.name || tag);
                }

                // Get review data from map
                const reviewData = reviewMap.get(itemFromDb.id) || { reviewCount: 0, reviewRating: 0 };

                // Handle price
                let price: number | null | undefined = itemFromDb.price;
                if (price === undefined) {
                    price = itemFromDb.getDataValue('price') as number | null | undefined;
                }
                if (typeof price === 'string') {
                    const parsed = parseFloat(price);
                    price = isNaN(parsed) ? null : parsed;
                }
                const finalPrice = (price === null || price === undefined || (typeof price === 'number' && isNaN(price))) ? 0 : Number(price);

                return {
                    id: itemData.id ?? itemFromDb.getDataValue('id'),
                    title: itemData.title ?? itemFromDb.getDataValue('title') ?? '',
                    desc: itemData.description ?? itemFromDb.getDataValue('description') ?? '',
                    price: finalPrice,
                    discount: itemData.discount ?? itemFromDb.getDataValue('discount') ?? 0,
                    tags,
                    reviewCount: reviewData.reviewCount,
                    reviewRating: reviewData.reviewRating,
                    isSpecial: itemData.isSpecial ?? itemFromDb.getDataValue('isSpecial') ?? false,
                    imgUrl: itemData.imgUrl ?? itemFromDb.getDataValue('imgUrl') ?? undefined,
                };
            });

            return { msg: "All items fetched successfully", data: items };
        } catch (error) {
            console.error("Error in getAllItems:", error);
            throw error;
        }
    },
    500,
    "Failed to fetch items",
);

export const getItemReviews = tryCatchHandler<Review[]>(async (req) => {
    const { itemId }: { itemId: number } = req.body; // Assume id won't be invalid because the client will have a id check initially. But even if a invalid id is passed, reviews will just be empty.

    const reviewsFromDb = await ReviewTable.findAll({
        where: {
            itemId,
        },
        include: [
            {
                model: UserTable,
                attributes: ["name"],
                required: false, // LEFT JOIN instead of INNER JOIN - don't filter out reviews with missing users
            },
        ],
    });

    // Some legacy rows may reference a userId that no longer exists.
    // In that case, `review.user` will be undefined; we use a fallback
    // instead of filtering them out or throwing a TypeError.
    const reviews = reviewsFromDb.map((review) => ({
        id: review.id,
        userId: review.userId,
        userName: review.user?.name || "Unknown User", // fallback for missing users
        itemId: review.itemId,
        rating: review.rating,
        reviewTxt: review.isDeleted ? "" : review.reviewTxt,
        dateCreated: review.dateCreated
            ? review.dateCreated.toISOString()
            : "",
        isDeleted: review.isDeleted,
        isFlagged: review.isFlagged,
    }));

    return { msg: "Reviews fetched successfully", data: reviews };
});

export const createReview = tryCatchHandler<{
    id: number;
    userId: number;
    name: string;
}>(
    async (req) => {
        const { accessToken, itemId, rating, reviewTxt }: Review & Tokens =
            req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        // Ensure reviewTxt has 100 words or less and has a max of 1000 characters
        if ((reviewTxt?.length ?? 0) > 1000) {
            throw new HttpError("Review text too long", 400);
        }
        if (((reviewTxt ?? "").match(/\b\w+\b/g) || []).length > 100) {
            throw new HttpError("Review text has too many words", 400);
        }

        // Make the rating so that it's 2dp and increments with 0.25
        const ratingRounded = Math.round(rating * 4) / 4;

        // const sentiment = new Sentiment();
        // const filter = new BadWordsFilter();

        // const isAppropriate =
        //     sentiment.analyze(reviewTxt ?? "").score >= 0 &&
        //     !filter.isProfane(reviewTxt ?? "");

        const user = await UserTable.findByPk(userId, {
            attributes: ["name", "isBlocked"],
        });

        if (!user) {
            throw new HttpError("User not found", 404);
        }

        if (user.isBlocked) {
            throw new HttpError(
                "Can't create review as this user has been blocked by an admin",
                403,
            );
        }

        const review = await ReviewTable.create({
            rating: ratingRounded,
            reviewTxt: reviewTxt === "" ? undefined : reviewTxt,
            isFlagged: false,
            itemId,
            userId,
        });

        // await reviewsUpdated(); // TODO: Implement if needed for GraphQL subscriptions

        return {
            msg: "Review created successfully",
            data: { id: review.id, userId: userId, name: user.name },
        };
    },
    401,
    "Invalid access token",
);

export const editReview = tryCatchHandler(
    async (req) => {
        const {
            accessToken,
            reviewId,
            rating,
            reviewTxt,
        }: Review & Tokens & { reviewId: number } = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        // Ensure reviewTxt has 100 words or less and has a max of 1000 characters
        if ((reviewTxt?.length ?? 0) > 1000) {
            throw new HttpError("Review text too long", 400);
        }
        if (((reviewTxt ?? "").match(/\b\w+\b/g) || []).length > 100) {
            throw new HttpError("Review text has too many words", 400);
        }

        const review = await ReviewTable.findOne({
            where: {
                id: reviewId,
                userId,
            },
        });

        if (!review) {
            throw new HttpError("Review not found", 404);
        }

        if (review.userId !== userId) {
            throw new HttpError("Unauthorized", 401);
        }

        const user = await UserTable.findByPk(userId, {
            attributes: ["isBlocked"],
        });

        if (!user) {
            throw new HttpError("Unexpected error: User not found", 404);
        }

        if (user.isBlocked) {
            throw new HttpError(
                "Can't edit review as this user has been blocked by an admin",
                403,
            );
        }

        // Make the rating so that it's 2dp and increments with 0.25
        const ratingRounded = Math.round(rating * 4) / 4;

        // const sentiment = new Sentiment();
        // const filter = new BadWordsFilter();

        // const isAppropriate =
        //     sentiment.analyze(reviewTxt ?? "").score >= 0 &&
        //     !filter.isProfane(reviewTxt ?? "");

        await review.update({
            rating: ratingRounded,
            reviewTxt: reviewTxt === "" ? undefined : reviewTxt,
            isFlagged: false,
            dateCreated: new Date(),
        });
        // await reviewsUpdated(); // TODO: Implement if needed for GraphQL subscriptions
        return { msg: "Review updated successfully" };
    },
    401,
    "Invalid access token",
);

export const deleteReview = tryCatchHandler(
    async (req) => {
        const {
            accessToken,
            reviewId,
        }: { accessToken: string; reviewId: number } = req.body;

        // get userId through jwt
        const { userId } = jwt.verify(
            accessToken,
            JWT_SECRET as jwt.Secret,
        ) as {
            userId: number;
        }; // try catch handler will handle the error and return 401

        const review = await ReviewTable.findOne({
            where: {
                id: reviewId,
                userId,
            },
        });

        if (!review) {
            throw new HttpError("Review not found", 404);
        }

        if (review.userId !== userId) {
            throw new HttpError("Unauthorized", 401);
        }

        if (review.isDeleted) {
            throw new HttpError(
                "Can't delete review as this review has been deleted by an admin",
                403,
            );
        }

        await review.destroy();
        // await reviewsUpdated(); // TODO: Implement if needed for GraphQL subscriptions
        return { msg: "Review deleted successfully" };
    },
    401,
    "Invalid access token",
);
