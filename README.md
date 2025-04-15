# GhostRyt Server

GhostRyt Server is the backend API for the GhostRyt content management system, providing authentication, post management, keyword generation, and user settings management.

## Features

- **Authentication**: Secure JWT-based authentication with refresh tokens
- **Profile Management**: User profile and business profile management
- **Settings Management**: Comprehensive settings management for user preferences
- **Post Management**: Create, read, update, and delete posts with keyword integration
- **Keywords Management**: Generate and manage keywords for content optimization
  - AI-powered keyword generation using OpenAI
  - Traditional NLP keyword extraction as fallback
  - Keyword suggestions based on content and user history
  - Trending keywords across the platform
  - Frequently used keywords per user

## Settings Management Features

The Settings Management System provides a comprehensive way for users to configure their GhostRyt experience:

### 1. Profile Settings

- User profile information (username, email, password)
- Business profile details (business name, ideal client, etc.)
- WordPress integration configuration

**API Endpoints:**

- `GET /api/v1/settings/profile`: Get profile settings
- `PUT /api/v1/settings/profile`: Update profile settings
- `PUT /api/v1/settings/profile/password`: Update password

### 2. Post Settings

- Default keywords for new posts
- Scheduling preferences (enable/disable, timezone, max days, etc.)
- Content tone preferences
- Notification preferences (email, desktop, scheduling)

**API Endpoints:**

- `GET /api/v1/settings/posts`: Get post settings
- `PUT /api/v1/settings/posts`: Update post settings

### 3. Billing & Plan Settings

- Current plan information
- Subscription management (upgrade, downgrade, cancel)
- Billing history
- Payment method management

**API Endpoints:**

- `GET /api/v1/settings/plan`: Get current plan information
- `PUT /api/v1/settings/plan`: Update subscription plan
- `GET /api/v1/settings/billing/history`: Get billing history
- `PUT /api/v1/settings/billing/payment-method`: Update payment method
- `POST /api/v1/settings/billing/cancel`: Cancel subscription

## Getting Started

### Prerequisites

- Node.js (v16+)
- MySQL (v8+)
- npm or yarn
- OpenAI API Key (for AI-powered keyword generation)

### Installation

1. Clone the repository

```
git clone https://github.com/your-username/ghostryt-server.git
cd ghostryt-server
```

2. Install dependencies

```
npm install
```

3. Create a `.env` file with the following variables:

```
NODE_ENV=development
PORT=3000
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ghostryt

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=200
OPENAI_ENABLED=true
```

4. Start the development server

```
npm run dev
```

## API Documentation

API documentation is available at `/api/docs` when the server is running.

### Keyword Generation API

#### Generate Keywords

```
POST /api/v1/keywords/generate
```

**Request Body:**

```json
{
  "content": "Your article content here...",
  "focusWords": ["optional", "focus", "words"],
  "maxKeywords": 10,
  "useAI": true
}
```

- `content`: The text content to analyze for keywords
- `focusWords`: (Optional) Words to prioritize in keyword generation
- `maxKeywords`: (Optional) Maximum number of keywords to generate (default: 10)
- `useAI`: (Optional) Whether to use AI for keyword generation (default: true)

**Response:**

```json
{
  "success": true,
  "message": "Keywords generated successfully",
  "data": {
    "keywords": [
      { "id": 1, "word": "example", "relevance": 0.85 },
      { "id": 2, "word": "keyword", "relevance": 0.75 }
    ],
    "method": "ai"
  }
}
```

The `method` field indicates whether the keywords were generated using AI ("ai") or traditional NLP ("nlp").

#### Get Keyword Suggestions

```
POST /api/v1/keywords/suggestions
```

**Request Body:**

```json
{
  "content": "Your article content here...",
  "maxSuggestions": 10
}
```

#### Get Trending Keywords

```
GET /api/v1/keywords/trending?limit=20
```

#### Get Frequently Used Keywords

```
GET /api/v1/keywords/frequent?limit=10
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Fix Post Keywords Constraint Issue

We've created a migration to fix the duplicate post keywords issue that was causing errors during post generation.

To run the migration:

```bash
# Navigate to the server directory
cd ghostryt-server

# Run the migration
npx sequelize-cli db:migrate

# Or if you've defined a script in package.json
npm run migrate
```

This migration will:

1. Remove the problematic constraint on the `post_keywords` table that was causing the error
2. Add the correct unique constraint for both `post_id` and `keyword_id` columns

After running this migration, the "Duplicate entry for key 'post_keywords_post_id_keyword'" error should be resolved, and the background job for post generation should work properly.
