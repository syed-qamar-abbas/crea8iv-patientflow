ALTER TABLE `User`
  ADD COLUMN `username` VARCHAR(80) DEFAULT NULL AFTER `name`;

UPDATE `User`
SET `username` = LOWER(CONCAT('user-', LEFT(REPLACE(`id`, '-', ''), 8)))
WHERE `username` IS NULL OR `username` = '';

CREATE UNIQUE INDEX `UK_User_Username` ON `User` (`username`);
