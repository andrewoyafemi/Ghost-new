import User from "./user.model";
import Session from "./session.model";
import BusinessProfile from "./business-profile.model";
import Post from "./post.model";
import Keyword from "./keyword.model";
import PostKeyword from "./post-keyword.model";
import UserPreference from "./user-preference.model";
import Subscription from "./subscription.model";
import BillingTransaction from "./billing-transaction.model";
import TemporaryRegistration from "./temporary-registration.model";
import SocialMediaCaption from "./social-media-caption.model";
import JobHistory from "./job-history.model";

// Check if any models failed to load properly
const models = {
  User,
  Session,
  BusinessProfile,
  Post,
  Keyword,
  PostKeyword,
  UserPreference,
  Subscription,
  BillingTransaction,
  TemporaryRegistration,
  SocialMediaCaption,
  JobHistory,
};

// Verbose validation that all models are properly loaded
Object.entries(models).forEach(([name, model]) => {
  if (!model) {
    console.error(
      `ERROR: Model ${name} failed to load properly - it is undefined`
    );
  } else {
    console.log(`Model ${name} loaded successfully`);
    // Check if model has an init method (a sign it's properly defined)
    if (!model.init) {
      console.error(
        `ERROR: Model ${name} doesn't have an init method - it may not be properly initialized`
      );
    }
  }
});

// Define associations (with try-catch blocks to catch any errors)
try {
  // User associations
  if (User && Session) {
    User.hasMany(Session, {
      foreignKey: "user_id",
      as: "sessions",
      onDelete: "CASCADE",
    });
    Session.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
    });
  }

  if (User && BusinessProfile) {
    User.hasOne(BusinessProfile, {
      foreignKey: "user_id",
      as: "businessProfile",
      onDelete: "CASCADE",
    });
    BusinessProfile.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
    });
  }

  if (User && Post) {
    User.hasMany(Post, {
      foreignKey: "user_id",
      as: "posts",
      onDelete: "CASCADE",
    });
    Post.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
    });
  }

  if (User && Keyword) {
    User.hasMany(Keyword, {
      foreignKey: "user_id",
      as: "keywords",
      onDelete: "CASCADE",
    });
    Keyword.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
    });
  }

  // Add new associations for settings management
  if (User && UserPreference) {
    User.hasOne(UserPreference, {
      foreignKey: "user_id",
      as: "preferences",
      onDelete: "CASCADE",
    });
    UserPreference.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
    });
  }

  if (User && Subscription) {
    User.hasOne(Subscription, {
      foreignKey: "user_id",
      as: "subscription",
      onDelete: "CASCADE",
    });
    Subscription.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
    });
  }

  // This is where the error was occurring - line 90
  if (User && BillingTransaction) {
    console.log("Setting up User-BillingTransaction association");
    console.log("BillingTransaction model type:", typeof BillingTransaction);
    console.log(
      "BillingTransaction attributes:",
      Object.keys(BillingTransaction.rawAttributes || {})
    );

    User.hasMany(BillingTransaction, {
      foreignKey: "user_id",
      as: "billingTransactions",
      onDelete: "CASCADE",
    });
    BillingTransaction.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
    });
  } else {
    console.error(
      "ERROR: Cannot set up User-BillingTransaction association - models not properly loaded"
    );
  }

  // Post associations
  if (Post && PostKeyword) {
    Post.hasMany(PostKeyword, {
      foreignKey: "post_id",
      as: "postKeywords",
      onDelete: "CASCADE",
    });
    PostKeyword.belongsTo(Post, {
      foreignKey: "post_id",
      as: "post",
    });
  }

  // PostKeyword to Keyword direct association
  if (PostKeyword && Keyword) {
    PostKeyword.belongsTo(Keyword, {
      foreignKey: "keyword_id",
      as: "keyword",
    });
    Keyword.hasMany(PostKeyword, {
      foreignKey: "keyword_id",
      as: "postKeywords",
    });
  }

  // Post - Keyword many-to-many relationship
  if (Post && Keyword && PostKeyword) {
    Post.belongsToMany(Keyword, {
      through: PostKeyword,
      foreignKey: "post_id",
      otherKey: "keyword_id",
      as: "keywords",
    });
    Keyword.belongsToMany(Post, {
      through: PostKeyword,
      foreignKey: "keyword_id",
      otherKey: "post_id",
      as: "posts",
    });
  }

  // Social Media Caption associations
  if (User && SocialMediaCaption) {
    User.hasMany(SocialMediaCaption, {
      foreignKey: "user_id",
      as: "socialMediaCaptions",
      onDelete: "CASCADE",
    });
    SocialMediaCaption.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
    });
  }

  if (Post && SocialMediaCaption) {
    Post.hasMany(SocialMediaCaption, {
      foreignKey: "post_id",
      as: "socialMediaCaptions",
      onDelete: "CASCADE",
    });
    SocialMediaCaption.belongsTo(Post, {
      foreignKey: "post_id",
      as: "post",
    });
  }
} catch (error) {
  console.error("ERROR setting up associations:", error);
}

// Export models individually
export {
  User,
  Session,
  BusinessProfile,
  Post,
  Keyword,
  PostKeyword,
  UserPreference,
  Subscription,
  BillingTransaction,
  TemporaryRegistration,
  SocialMediaCaption,
  JobHistory,
};

// Export models as default object
export default {
  User,
  Session,
  BusinessProfile,
  Post,
  Keyword,
  PostKeyword,
  UserPreference,
  Subscription,
  BillingTransaction,
  TemporaryRegistration,
  SocialMediaCaption,
  JobHistory,
};
