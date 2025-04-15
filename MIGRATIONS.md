# Database Migrations Guide

This project uses Sequelize migrations to manage database schema changes. This document outlines how to work with migrations in this project.

## Basic Commands

- Create a new migration: `npm run migrate:generate -- --name your-migration-name`
- Run pending migrations: `npm run migrate`
- Undo the most recent migration: `npm run migrate:undo`
- Check migration status: `npm run migrate:status`

## Migration Directory Structure

Migrations are stored in:

- `src/database/migrations/` - Contains all migration files

## Best Practices

1. **Always use migrations for schema changes**

   - Never modify the database schema directly in production
   - All schema changes should be tracked in version control through migrations

2. **Write both "up" and "down" methods**

   - `up`: Applies the migration (creates tables, adds columns, etc.)
   - `down`: Reverts the migration (drops tables, removes columns, etc.)

3. **Test migrations before deployment**

   - Run migrations on a staging environment before production
   - Verify both `up` and `down` methods work correctly

4. **Include in deployment process**
   - Migrations should be part of your deployment pipeline
   - Run migrations automatically during deployment

## Example Migration

```javascript
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("users", "phone_number", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("users", "phone_number");
  },
};
```

## Handling Production Issues

If a migration fails in production:

1. Check the error logs to understand why it failed
2. Fix the migration file or create a new one that addresses the issue
3. Test the fix thoroughly in development/staging
4. Re-run the migration in production

## Working with Existing Tables

When working with existing tables that have data:

1. Always make column additions nullable or provide a default value
2. Consider data migration needs (e.g., populating new columns with values)
3. Be cautious with dropping columns or tables that may contain important data
