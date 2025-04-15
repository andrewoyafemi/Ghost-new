import ngrok from "ngrok";
import dotenv from "dotenv";
import logger from "../config/logger";

dotenv.config();

/**
 * Helper function to start ngrok tunnel in development mode
 * @param port The local port to expose
 * @returns A promise that resolves to the public URL or null in production
 */
export const startNgrokTunnel = async (
  port: number
): Promise<string | null> => {
  // Only start ngrok in development mode
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.DISABLE_NGROK === "true"
  ) {
    return null;
  }

  try {
    // Check if auth token is provided in environment
    if (process.env.NGROK_AUTH_TOKEN) {
      await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);
    } else {
      logger.warn(
        "No NGROK_AUTH_TOKEN provided. Limited functionality may be available."
      );
    }

    // Start ngrok tunnel
    const url = await ngrok.connect({
      addr: port,
      // Optional: You can configure subdomain if you have a paid account
      // subdomain: process.env.NGROK_SUBDOMAIN,
    });

    logger.info(`✨ Ngrok tunnel started at: ${url}`);

    // Display webhook URLs more prominently
    logger.info(
      "======================================================================="
    );
    logger.info(`🌐 Your Stripe webhook URL for development:`);
    logger.info(`${url}${process.env.API_PREFIX}/stripe/webhook`);
    logger.info(`Events to enable in Stripe dashboard:`);
    logger.info(`- checkout.session.completed`);
    logger.info(`- invoice.payment_succeeded`);
    logger.info(`- invoice.payment_failed`);
    logger.info(`- customer.subscription.updated`);
    logger.info(`- customer.subscription.deleted`);
    logger.info(
      "======================================================================="
    );
    logger.info(
      "Test with Stripe CLI: stripe listen --forward-to " +
        url +
        "/api/v1/stripe/webhook"
    );
    logger.info(
      "======================================================================="
    );

    return url;
  } catch (error) {
    logger.error("Error starting ngrok tunnel:", error);
    return null;
  }
};

/**
 * Helper function to stop ngrok tunnel
 */
export const stopNgrokTunnel = async (): Promise<void> => {
  try {
    await ngrok.kill();
    logger.info("Ngrok tunnel stopped");
  } catch (error) {
    logger.error("Error stopping ngrok tunnel:", error);
  }
};

// Optional: Handle process termination to clean up ngrok tunnel
process.on("SIGINT", async () => {
  await stopNgrokTunnel();
  process.exit(0);
});

export default { startNgrokTunnel, stopNgrokTunnel };
