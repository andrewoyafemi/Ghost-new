import { OpenAI } from "openai";
import dotenv from "dotenv";
import logger from "./logger";

dotenv.config();

// Check if OpenAI API key is provided
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey === "your-openai-api-key") {
  logger.warn(
    "OpenAI API key is not configured. AI-based keyword generation will be disabled."
  );
}

// Check if OpenAI is enabled
const isEnabled = process.env.OPENAI_ENABLED === "true";

// OpenAI configuration
export const openaiConfig = {
  apiKey,
  model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "800"),
  enabled: isEnabled && !!apiKey && apiKey !== "your-openai-api-key",
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: openaiConfig.apiKey,
});

export default openai;
