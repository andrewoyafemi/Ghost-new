import { Response } from "express";
import { KeywordService } from "../services/keyword.service";
import { AuthRequest } from "../types/auth.types";
import { Keyword } from "../models";
import { SuccessResponse, ErrorResponse } from "../utils/responses";
import logger from "../config/logger";
import {
  ValidationError,
  NotFoundError,
} from "../middlewares/error.middleware";

/**
 * Generate keywords from content
 * POST /api/v1/keywords/generate
 */
export const generateKeywords = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const { content, focusWords, maxKeywords, useAI = true } = req.body;

    // Generate keywords using the service
    const generatedKeywords = await KeywordService.generateKeywords({
      content,
      focusWords,
      maxKeywords,
      userId,
      useAI,
    });

    // Save keywords to database
    const savedKeywords = await KeywordService.saveKeywords(
      generatedKeywords,
      userId
    );

    // Return the generated keywords
    return res.status(200).json(
      SuccessResponse(
        {
          keywords: savedKeywords.map((k) => ({
            id: k.id,
            word: k.word,
            relevance: k.relevance,
            usage_count: k.usage_count,
          })),
          total: savedKeywords.length,
          method: useAI ? "ai_enhanced" : "traditional_nlp",
        },
        "Keywords generated successfully"
      )
    );
  } catch (error: any) {
    logger.error("Error generating keywords:", error);
    return res
      .status(500)
      .json(ErrorResponse(error.message || "Failed to generate keywords"));
  }
};

/**
 * Get keywords for a user
 * GET /api/v1/keywords
 */
export const getKeywords = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || "relevance";
    const sortOrder = (req.query.sortOrder as string) || "desc";

    // Get keywords with pagination
    const result = await KeywordService.getKeywords(
      userId,
      page,
      limit,
      search,
      sortBy,
      sortOrder as "asc" | "desc" // Type assertion for sortOrder
    );

    return res.status(200).json(
      SuccessResponse(
        {
          keywords: result.keywords,
          pagination: {
            total: result.total,
            totalPages: result.totalPages,
            currentPage: page,
            limit,
          },
        },
        "Keywords retrieved successfully"
      )
    );
  } catch (error: any) {
    logger.error("Error fetching keywords:", error);
    return res
      .status(500)
      .json(ErrorResponse(error.message || "Failed to fetch keywords"));
  }
};

/**
 * Get a single keyword by ID
 * GET /api/v1/keywords/:id
 */
export const getKeywordById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const keywordId = parseInt(req.params.id);
    if (isNaN(keywordId)) {
      return res.status(400).json(ErrorResponse("Invalid keyword ID"));
    }

    // Find keyword by ID and ensure it belongs to the user
    const keyword = await Keyword.findOne({
      where: {
        id: keywordId,
        user_id: userId,
      },
    });

    if (!keyword) {
      return res.status(404).json(ErrorResponse("Keyword not found"));
    }

    return res
      .status(200)
      .json(SuccessResponse(keyword, "Keyword retrieved successfully"));
  } catch (error: any) {
    logger.error("Error fetching keyword:", error);
    return res
      .status(500)
      .json(ErrorResponse(error.message || "Failed to fetch keyword"));
  }
};

/**
 * Update a keyword
 * PUT /api/v1/keywords/:id
 */
export const updateKeyword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const keywordId = parseInt(req.params.id);
    if (isNaN(keywordId)) {
      return res.status(400).json(ErrorResponse("Invalid keyword ID"));
    }

    // Find keyword by ID and ensure it belongs to the user
    const keyword = await Keyword.findOne({
      where: {
        id: keywordId,
        user_id: userId,
      },
    });

    if (!keyword) {
      return res.status(404).json(ErrorResponse("Keyword not found"));
    }

    // Update the keyword
    const { word, relevance } = req.body;
    const updateData: any = {};

    if (word !== undefined) updateData.word = word;
    if (relevance !== undefined) updateData.relevance = relevance;

    await keyword.update(updateData);

    return res
      .status(200)
      .json(SuccessResponse(keyword, "Keyword updated successfully"));
  } catch (error: any) {
    logger.error("Error updating keyword:", error);
    return res
      .status(500)
      .json(ErrorResponse(error.message || "Failed to update keyword"));
  }
};

/**
 * Delete a keyword
 * DELETE /api/v1/keywords/:id
 */
export const deleteKeyword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const keywordId = parseInt(req.params.id);
    if (isNaN(keywordId)) {
      return res.status(400).json(ErrorResponse("Invalid keyword ID"));
    }

    // Find keyword by ID and ensure it belongs to the user
    const keyword = await Keyword.findOne({
      where: {
        id: keywordId,
        user_id: userId,
      },
    });

    if (!keyword) {
      return res.status(404).json(ErrorResponse("Keyword not found"));
    }

    // Delete the keyword
    await keyword.destroy();

    return res
      .status(200)
      .json(SuccessResponse(null, "Keyword deleted successfully"));
  } catch (error: any) {
    logger.error("Error deleting keyword:", error);
    return res
      .status(500)
      .json(ErrorResponse(error.message || "Failed to delete keyword"));
  }
};

/**
 * Bulk keyword operations
 * POST /api/v1/keywords/bulk
 */
export const bulkKeywordOperation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const { operation, keywordIds, data } = req.body;

    // Validate operation and keyword IDs
    if (
      !operation ||
      !keywordIds ||
      !Array.isArray(keywordIds) ||
      keywordIds.length === 0
    ) {
      throw new ValidationError("Invalid operation or keyword IDs");
    }

    // Find all keywords that belong to the user
    const keywords = await Keyword.findAll({
      where: {
        id: keywordIds,
        user_id: userId,
      },
    });

    if (keywords.length === 0) {
      throw new NotFoundError("No keywords found with the provided IDs");
    }

    let result;

    // Perform the appropriate operation
    switch (operation) {
      case "delete":
        // Delete all found keywords
        await Keyword.destroy({
          where: {
            id: keywordIds,
            user_id: userId,
          },
        });
        result = { deleted: keywords.length };
        break;

      case "update":
        if (!data) {
          throw new ValidationError(
            "Data object is required for update operation"
          );
        }

        // Update all found keywords
        const updateData: any = {};
        if (data.relevance !== undefined) updateData.relevance = data.relevance;

        await Keyword.update(updateData, {
          where: {
            id: keywordIds,
            user_id: userId,
          },
        });
        result = { updated: keywords.length };
        break;

      // Additional operations could be added here
      default:
        throw new ValidationError(`Unsupported operation: ${operation}`);
    }

    return res
      .status(200)
      .json(
        SuccessResponse(
          result,
          `Bulk operation '${operation}' completed successfully`
        )
      );
  } catch (error: any) {
    logger.error("Error performing bulk operation:", error);

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return res.status(error.statusCode).json(ErrorResponse(error.message));
    }

    return res
      .status(500)
      .json(ErrorResponse(error.message || "Failed to perform bulk operation"));
  }
};

/**
 * Get keyword suggestions based on content
 * POST /api/v1/keywords/suggestions
 */
export const getKeywordSuggestions = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const { content, limit = 20 } = req.body;

    if (!content || content.trim().length < 10) {
      return res
        .status(400)
        .json(ErrorResponse("Content must be at least 10 characters long"));
    }

    // Get keyword suggestions from the service
    const suggestions = await KeywordService.getSuggestions(
      content,
      userId,
      limit
    );

    return res.status(200).json(
      SuccessResponse(
        {
          suggestions: suggestions.map((s) => ({
            id: s.id,
            word: s.word,
            relevance: s.relevance,
            usage_count: s.usage_count,
          })),
          total: suggestions.length,
        },
        "Keyword suggestions generated successfully"
      )
    );
  } catch (error: any) {
    logger.error("Error generating keyword suggestions:", error);
    return res
      .status(500)
      .json(
        ErrorResponse(error.message || "Failed to generate keyword suggestions")
      );
  }
};

/**
 * Get trending keywords across the platform
 * GET /api/v1/keywords/trending
 */
export const getTrendingKeywords = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const limit = parseInt(req.query.limit as string) || 20;

    // Get trending keywords from the service
    const trendingKeywords = await KeywordService.getTrendingKeywords(
      userId,
      limit
    );

    return res.status(200).json(
      SuccessResponse(
        {
          keywords: trendingKeywords.map((k) => ({
            word: k.word,
            usage_count: k.usage_count,
          })),
          total: trendingKeywords.length,
        },
        "Trending keywords retrieved successfully"
      )
    );
  } catch (error: any) {
    logger.error("Error fetching trending keywords:", error);
    return res
      .status(500)
      .json(
        ErrorResponse(error.message || "Failed to fetch trending keywords")
      );
  }
};

/**
 * Get frequently used keywords for a user
 * GET /api/v1/keywords/frequent
 */
export const getFrequentKeywords = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const limit = parseInt(req.query.limit as string) || 10;

    // Get frequently used keywords from the service
    const frequentKeywords = await KeywordService.getFrequentlyUsedKeywords(
      userId,
      limit
    );

    return res.status(200).json(
      SuccessResponse(
        {
          keywords: frequentKeywords.map((k) => ({
            id: k.id,
            word: k.word,
            relevance: k.relevance,
            usage_count: k.usage_count,
          })),
          total: frequentKeywords.length,
        },
        "Frequently used keywords retrieved successfully"
      )
    );
  } catch (error: any) {
    logger.error("Error fetching frequently used keywords:", error);
    return res
      .status(500)
      .json(
        ErrorResponse(
          error.message || "Failed to fetch frequently used keywords"
        )
      );
  }
};
