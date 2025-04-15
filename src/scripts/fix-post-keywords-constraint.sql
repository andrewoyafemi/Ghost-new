-- SQL Script to fix post_keywords constraint issue
-- Run this in phpMyAdmin or any MySQL client

-- Step 1: Show indexes to identify the constraint
SHOW INDEXES FROM post_keywords;

-- Step 2: Drop the problematic constraint 
-- Note: The actual constraint name may vary, update if needed based on step 1 results
ALTER TABLE post_keywords DROP INDEX post_id;

-- Step 3: Add the correct constraint
ALTER TABLE post_keywords ADD CONSTRAINT post_keywords_post_id_keyword_unique UNIQUE (post_id, keyword_id);

-- Step 4: Verify the change
SHOW INDEXES FROM post_keywords;

-- Step 5: Check if there are any duplicate entries that would violate this constraint
SELECT post_id, keyword_id, COUNT(*) as count 
FROM post_keywords 
GROUP BY post_id, keyword_id 
HAVING COUNT(*) > 1;

-- If step 5 returns results, you'll need to delete duplicates:
-- SELECT * FROM post_keywords WHERE post_id = X AND keyword_id = Y ORDER BY id;
-- DELETE FROM post_keywords WHERE id NOT IN (
--   SELECT min_id FROM (
--     SELECT MIN(id) as min_id FROM post_keywords 
--     GROUP BY post_id, keyword_id
--   ) as temp
-- ); 