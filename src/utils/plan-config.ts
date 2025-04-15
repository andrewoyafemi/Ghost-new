/**
 * Plan Configuration
 * This file defines all features and limits for each subscription plan.
 */

export enum PlanType {
  LONE_RANGER = "basic",
  SMART_MARKETER = "standard",
  AUTHORITY_BUILDER = "premium",
}

// Legacy plan names for backward compatibility
export enum LegacyPlanType {
  BASIC = "basic",
  STANDARD = "standard",
  PREMIUM = "premium",
}

// Map legacy plan types to new plan types
export const planTypeMapping = {
  [LegacyPlanType.BASIC]: PlanType.LONE_RANGER,
  [LegacyPlanType.STANDARD]: PlanType.SMART_MARKETER,
  [LegacyPlanType.PREMIUM]: PlanType.AUTHORITY_BUILDER,
};

// Price IDs from Stripe
export const PLAN_PRICE_IDS = {
  [PlanType.LONE_RANGER]: process.env.STRIPE_PRICE_BASIC || "",
  [PlanType.SMART_MARKETER]: process.env.STRIPE_PRICE_STANDARD || "",
  [PlanType.AUTHORITY_BUILDER]: process.env.STRIPE_PRICE_PREMIUM || "",
};

// Plan Names for display
export const PLAN_NAMES = {
  [PlanType.LONE_RANGER]: "The Lone Ranger",
  [PlanType.SMART_MARKETER]: "The Smart Marketer",
  [PlanType.AUTHORITY_BUILDER]: "The Authority Builder",
};

// Feature flags and limits for each plan
export interface PlanFeatures {
  // Post limits
  monthlyPostLimit: number;

  // SEO Features
  seoOptimization: {
    basic: boolean; // Basic SEO structure (headings, subheadings)
    advanced: boolean; // Advanced SEO metadata and structuring
    internalLinking: boolean; // Internal linking recommendations
  };

  // Keyword features
  keywords: {
    basic: boolean; // Basic keyword suggestions
    advanced: boolean; // Advanced keyword recommendations with search intent analysis
    brandSpecific: boolean; // Ability to add brand-specific keywords
    optimizationInsights: boolean; // Keyword optimization insights
    personalizedStrategy: boolean; // Personalized keyword strategy
  };

  // Content features
  content: {
    autoPublish: boolean; // Auto-publish to website
    toneCustomization: boolean; // Content tone customization
    topicSuggestions: boolean; // AI-powered topic suggestions
    strategicAnalysis: boolean; // AI-powered content strategy analysis
    competitiveGapAnalysis: boolean; // Competitive content gap analysis
    wordCountLimit: number; // Maximum word count per post
  };

  // Social media features
  socialMedia: {
    captions: boolean; // AI-generated social media captions
  };

  // Email features
  email: {
    newsletterDrafts: boolean; // Automated email newsletter drafts
    leadMagnetContent: boolean; // Smart lead magnet content
  };

  // Analytics
  analytics: {
    basic: boolean; // Basic content analytics
    advanced: boolean; // Advanced content analytics
  };

  // Support
  support: {
    email: boolean; // Email support
    priority: boolean; // Priority support
    dedicated: boolean; // Dedicated content consultant
  };

  // Prompts library
  promptLibrary: {
    count: number; // Number of prompts in library
  };

  // Additional benefits
  additionalBenefits: {
    futureProductsAccess: boolean; // Free access to future products
    messagingWorkshops: boolean; // Access to exclusive messaging workshops
  };
}

// Define features for each plan
export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  [PlanType.LONE_RANGER]: {
    monthlyPostLimit: 10,
    seoOptimization: {
      basic: true,
      advanced: false,
      internalLinking: false,
    },
    keywords: {
      basic: true,
      advanced: false,
      brandSpecific: false,
      optimizationInsights: false,
      personalizedStrategy: false,
    },
    content: {
      autoPublish: true,
      toneCustomization: false,
      topicSuggestions: false,
      strategicAnalysis: false,
      competitiveGapAnalysis: false,
      wordCountLimit: 750,
    },
    socialMedia: {
      captions: false,
    },
    email: {
      newsletterDrafts: false,
      leadMagnetContent: false,
    },
    analytics: {
      basic: false,
      advanced: false,
    },
    support: {
      email: true,
      priority: false,
      dedicated: false,
    },
    promptLibrary: {
      count: 30,
    },
    additionalBenefits: {
      futureProductsAccess: false,
      messagingWorkshops: false,
    },
  },

  [PlanType.SMART_MARKETER]: {
    monthlyPostLimit: 20,
    seoOptimization: {
      basic: true,
      advanced: true,
      internalLinking: true,
    },
    keywords: {
      basic: true,
      advanced: true,
      brandSpecific: true,
      optimizationInsights: true,
      personalizedStrategy: false,
    },
    content: {
      autoPublish: true,
      toneCustomization: true,
      topicSuggestions: true,
      strategicAnalysis: false,
      competitiveGapAnalysis: false,
      wordCountLimit: 1000,
    },
    socialMedia: {
      captions: true,
    },
    email: {
      newsletterDrafts: false,
      leadMagnetContent: false,
    },
    analytics: {
      basic: true,
      advanced: false,
    },
    support: {
      email: true,
      priority: true,
      dedicated: false,
    },
    promptLibrary: {
      count: 50,
    },
    additionalBenefits: {
      futureProductsAccess: false,
      messagingWorkshops: false,
    },
  },

  [PlanType.AUTHORITY_BUILDER]: {
    monthlyPostLimit: 30,
    seoOptimization: {
      basic: true,
      advanced: true,
      internalLinking: true,
    },
    keywords: {
      basic: true,
      advanced: true,
      brandSpecific: true,
      optimizationInsights: true,
      personalizedStrategy: true,
    },
    content: {
      autoPublish: true,
      toneCustomization: true,
      topicSuggestions: true,
      strategicAnalysis: true,
      competitiveGapAnalysis: true,
      wordCountLimit: 2000,
    },
    socialMedia: {
      captions: true,
    },
    email: {
      newsletterDrafts: true,
      leadMagnetContent: true,
    },
    analytics: {
      basic: true,
      advanced: true,
    },
    support: {
      email: true,
      priority: true,
      dedicated: true,
    },
    promptLibrary: {
      count: 80,
    },
    additionalBenefits: {
      futureProductsAccess: true,
      messagingWorkshops: true,
    },
  },
};

/**
 * Helper function to check if a feature is available for a given plan
 * @param plan The user's subscription plan
 * @param featurePath The path to the feature in the PLAN_FEATURES object
 * @returns boolean indicating if the feature is available
 */
export function hasFeature(plan: string, featurePath: string): boolean {
  // Convert legacy plan names if needed
  let planType = plan as PlanType;
  if (Object.values(LegacyPlanType).includes(plan as LegacyPlanType)) {
    planType = planTypeMapping[plan as LegacyPlanType];
  }

  // If plan not found, default to LONE_RANGER (most restricted)
  if (!Object.values(PlanType).includes(planType)) {
    planType = PlanType.LONE_RANGER;
  }

  // Split the feature path and navigate through the object
  const pathParts = featurePath.split(".");
  let currentObj: any = PLAN_FEATURES[planType];

  for (const part of pathParts) {
    if (currentObj === undefined || currentObj === null) {
      return false;
    }
    currentObj = currentObj[part];
  }

  return !!currentObj;
}

/**
 * Helper function to get the limit for a specific plan feature
 * @param plan The user's subscription plan
 * @param featurePath The path to the feature limit in the PLAN_FEATURES object
 * @returns The limit value or 0 if not found
 */
export function getPlanLimit(plan: string, featurePath: string): number {
  // Convert legacy plan names if needed
  let planType = plan as PlanType;
  if (Object.values(LegacyPlanType).includes(plan as LegacyPlanType)) {
    planType = planTypeMapping[plan as LegacyPlanType];
  }

  // If plan not found, default to LONE_RANGER (most restricted)
  if (!Object.values(PlanType).includes(planType)) {
    planType = PlanType.LONE_RANGER;
  }

  // Split the feature path and navigate through the object
  const pathParts = featurePath.split(".");
  let currentObj: any = PLAN_FEATURES[planType];

  for (const part of pathParts) {
    if (currentObj === undefined || currentObj === null) {
      return 0;
    }
    currentObj = currentObj[part];
  }

  return typeof currentObj === "number" ? currentObj : 0;
}
