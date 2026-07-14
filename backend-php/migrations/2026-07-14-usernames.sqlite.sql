ALTER TABLE User ADD COLUMN username TEXT DEFAULT NULL;

UPDATE User
SET username = LOWER('user-' || substr(replace(id, '-', ''), 1, 8))
WHERE username IS NULL OR username = '';

CREATE UNIQUE INDEX IF NOT EXISTS UX_User_Username ON User(username) WHERE username IS NOT NULL;
