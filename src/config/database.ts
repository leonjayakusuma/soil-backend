// Explicitly require pg to ensure it's available for Sequelize
import 'pg';
import { Sequelize } from 'sequelize-typescript';
import config from './config.js';
import { UserTable } from "../models/user.model";
import { CartItemTable } from "../models/cartItem.model";
import { ItemTable } from "../models/item.model";
import { TagTable } from "../models/tag.model";
import { PersonalInfoTable } from "../models/personalInfo.model";
import { ActivityLevelTable } from "../models/activityLevel.model";
import { HealthGoalTable } from "../models/healthGoal.model";
import { DietaryPreferenceTable } from "../models/dietaryPreference.model";
import { RecipeTable } from "../models/recipe.model";
import { InstructionTable } from "../models/instruction.model";
import { IngredientTable } from "../models/ingredient.model";
import { RecipeIngredientTable } from "../models/recipeIngredient.model";
import { RefreshTokenTable } from "../models/refreshToken.model";
import { ItemTagTable } from "../models/itemTag.model";
import { ReviewTable } from "../models/review.model";
import { FollowTable } from "../models/follow.model";


// Create Sequelize instance with Supabase connection
const sequelize = new Sequelize(config.database_url, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: config.nodeEnv === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  models: [UserTable,
    CartItemTable,
    ItemTable,
    TagTable,
    ItemTagTable,
    PersonalInfoTable,
    ActivityLevelTable,
    HealthGoalTable,
    DietaryPreferenceTable,
    RecipeTable,
    InstructionTable,
    IngredientTable,
    RecipeIngredientTable,
    RefreshTokenTable,
    ReviewTable,
    FollowTable,], // Import models directly
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Skip sync in production/serverless (expensive operation)
    // Tables should already exist in production
    const shouldSync = process.env.SYNC_DB === 'true' || config.nodeEnv === 'development';
    if (shouldSync) {
      await sequelize.sync({ alter: false });
      console.log('✅ Database models synced');
    }
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

export default sequelize;

