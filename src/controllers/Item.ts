import { ReviewTable } from "@/database/models/review.model";
import { UserTable } from "@/database/models/user.model";
import jwt from "jsonwebtoken";
import { pubsub } from "@/app";
import { Item, Review } from "@shared/types";
import { tryCatchHandler, HttpError, Tokens } from ".";
import { ItemTable } from "@/database/models/item.model";
import { TagTable } from "@/database/models/tag.model";
import { sequelize } from "@/database";
import { IngredientTable } from "@/database/models/ingredient.model";
import { RecipeTable } from "@/database/models/recipe.model";
import { Recipe } from "@shared/types";
import { InstructionTable } from "@/database/models/instruction.model";
import Sentiment from "sentiment";
import Filter from "bad-words";
import { reviewsUpdated, updateRecentReviews } from "@/resolvers";

const { JWT_SECRET } = process.env;

if (!JWT_SECRET) {
    console.error(
        "One or more environment variables are not set. Please refer sample.env for the required format.",
    );
    process.exit(1);
}

/**
 * THe objects returned by sequelize are different from the plain items we need to return and has some funky behaviour so I manually extract them into the format we need
 */

export const getAllRecipes = tryCatchHandler<Recipe[]>(async () => {
    const recipesFromDb = await RecipeTable.findAll({
        include: [
            {
                model: IngredientTable,
                as: "ingredients",
                through: { attributes: [] }, // Exclude the join table attributes
            },
            {
                model: InstructionTable,
                as: "instructions",
                order: [["stepNo", "ASC"]],
            },
        ],
    });

    const recipes: Recipe[] = recipesFromDb.map((recipeFromDb) => ({
        id: recipeFromDb.id,
        name: recipeFromDb.name,
        link: recipeFromDb.link,
        calories: recipeFromDb.calories,
        carbs: recipeFromDb.carbs,
        fat: recipeFromDb.fat,
        protein: recipeFromDb.protein,
        ingredients: recipeFromDb.ingredients.map(
            (ingredient) => ingredient.name,
        ),
        // @ts-ignore
        instructions: recipeFromDb.instructions.map(
            // @ts-ignore
            (instruction) => instruction.instruction,
        ),
    }));

    return { msg: "All recipes fetched successfully", data: recipes };
});

export const getSpecialItems = tryCatchHandler<Item[]>(async () => {
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
});

export async function getFullItemData(itemFromDb: ItemTable): Promise<Item> {
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

    const tags = itemFromDb.tags.map((tag) => tag.name);

    return {
        id: itemFromDb.id,
        title: itemFromDb.title,
        desc: itemFromDb.description,
        // @ts-ignore
        price: parseFloat(itemFromDb.price, 10), // Don't know why this is a string in the first place
        discount: itemFromDb.discount,
        tags,
        reviewCount,
        reviewRating: Math.round(reviewRating * 100) / 100,
        isSpecial: itemFromDb.isSpecial,
        imgUrl: itemFromDb.imgUrl,
    };
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

export const getAllItems = tryCatchHandler<Item[]>(async () => {
    const itemsFromDb = await ItemTable.findAll({
        include: [
            {
                model: TagTable,
                attributes: ["name"],
                through: { attributes: [] },
            },
        ],
    });

    const items = await Promise.all(
        itemsFromDb.map((itemFromDb) => getFullItemData(itemFromDb)),
    );

    return { msg: "All items fetched successfully", data: items };
});

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
            },
        ],
    });

    const reviews = reviewsFromDb.map((review) => ({
        id: review.id,
        userId: review.userId,
        userName: review.user.name,
        itemId: review.itemId,
        rating: review.rating,
        reviewTxt: review.isDeleted ? "" : review.reviewTxt,
        dateCreated: review.dateCreated.toISOString(),
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

        const sentiment = new Sentiment();
        const filter = new Filter();

        const isAppropriate =
            sentiment.analyze(reviewTxt ?? "").score >= 0 &&
            !filter.isProfane(reviewTxt ?? "");

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
            isFlagged: !isAppropriate,
            itemId,
            userId,
        });

        await reviewsUpdated();

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

        const sentiment = new Sentiment();
        const filter = new Filter();

        const isAppropriate =
            sentiment.analyze(reviewTxt ?? "").score >= 0 &&
            !filter.isProfane(reviewTxt ?? "");

        await review.update({
            rating: ratingRounded,
            reviewTxt: reviewTxt === "" ? undefined : reviewTxt,
            isFlagged: !isAppropriate,
            dateCreated: new Date(),
        });
        await reviewsUpdated();
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
        await reviewsUpdated();
        return { msg: "Review deleted successfully" };
    },
    401,
    "Invalid access token",
);
