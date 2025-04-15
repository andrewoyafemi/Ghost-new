/**
 * Prompt templates for AI post generation based on user plans
 */
export const promptTemplates = {
  // Basic plan (Lone Ranger) prompt
  basic: `Create a blog post for a business named {business_name} that targets {ideal_client}.
The business promises the following to its clients: {client_promises}.
Their clients expect: {client_expectations}.

The blog post should:
1. Be around 800-1000 words
2. Include the following keywords: {keywords}
3. Use a conversational, friendly tone
4. Include 2-3 subheadings
5. End with a clear call-to-action

Add proper HTML formatting with paragraph tags and h2/h3 tags for headings.

Context from previous posts:
{previous_post_context}

Format the post as clean HTML with proper paragraph tags (<p>) and heading tags.`,

  // Standard plan (Smart Marketer) prompt
  standard: `Create an in-depth, engaging blog post for a business named {business_name} that targets {ideal_client}.
The business promises the following to its clients: {client_promises}.
Their clients expect: {client_expectations}.

The blog post should:
1. Be around 1200-1500 words
2. Include the following keywords (naturally integrated): {keywords}
3. Use a professional yet approachable tone
4. Include 3-5 subheadings organized in a logical structure
5. Incorporate at least one bulleted or numbered list for easy scanning
6. Include places where images could be inserted (mark with [IMAGE: brief description])
7. End with a compelling call-to-action
8. Maintain continuity with these previous posts: {previous_post_context}

The content should position the business as knowledgeable in their field while being helpful to readers.
Add proper HTML formatting with paragraph tags, heading tags (h2, h3), and list elements.

Format the post as clean HTML with proper paragraph tags (<p>), heading tags, and list elements.`,

  // Premium plan (Authority Builder) prompt
  premium: `Create a comprehensive, authority-building blog post for {business_name}, a business that serves {ideal_client}.
The business promises: {client_promises}.
Their clients expect: {client_expectations}.

This post should:
1. Be approximately 1800-2200 words
2. Strategically integrate these keywords in an SEO-friendly way: {keywords}
3. Use a tone that blends expertise with accessibility
4. Include 5-7 well-structured sections with descriptive headings and subheadings
5. Incorporate research-backed information and data points (fabricate realistic statistics if needed)
6. Include at least 2 bulleted or numbered lists
7. Create places for 3-4 relevant images (mark with [IMAGE: detailed description])
8. Incorporate a compelling introduction with a hook
9. Include a summary section that reinforces key points
10. End with a strategic call-to-action that encourages engagement
11. Maintain narrative continuity with previous content: {previous_post_context}

The content should position the business as a thought leader in their industry, address common pain points, and provide actionable insights.
Content should include metaphors, stories, or examples that make complex concepts accessible.

Format the post as clean, well-structured HTML with proper semantic elements including paragraph tags, heading hierarchy, list elements, and emphasis where appropriate.`,
};

/**
 * Get formatted prompt template for image generation
 * @param content Post content
 * @returns Formatted image prompt
 */
export const getImagePrompt = (content: string): string => {
  // Extract first 300 characters to get the post topic
  const topicSummary = content.replace(/<[^>]*>/g, "").substring(0, 300);

  return `Create a high-quality, professional featured image for a blog post with the following content:
  
  ${topicSummary}
  
  The image should be:
  1. Professional and business-appropriate
  2. Related to the topic discussed
  3. Visually appealing with good composition
  4. Suitable as a featured image for a blog post
  
  Do not include any text in the image.`;
};

/**
 * Get formatted prompt for creating social media captions
 * @param title Post title
 * @param content Post content
 * @param platform Social media platform
 * @returns Formatted social media caption prompt
 */
export const getSocialMediaPrompt = (
  title: string,
  content: string,
  platform: string
): string => {
  // Extract a content summary
  const contentSummary = content.replace(/<[^>]*>/g, "").substring(0, 500);

  return `Create an engaging social media caption for ${platform} for the following blog post:
  
  Title: ${title}
  
  Content summary: ${contentSummary}
  
  The caption should:
  1. Be attention-grabbing and encourage clicks
  2. Include relevant hashtags (3-5)
  3. Be appropriate in length for ${platform}
  4. Include a clear call-to-action
  
  Return only the caption text with hashtags.`;
};
