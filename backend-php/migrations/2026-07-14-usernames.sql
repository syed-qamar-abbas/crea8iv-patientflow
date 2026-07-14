ALTER TABLE `User`
  ADD COLUMN `username` VARCHAR(80) DEFAULT NULL AFTER `name`;

UPDATE `User`
SET `username` = LOWER(CONCAT('user-', LEFT(REPLACE(`id`, '-', ''), 8)))
WHERE `username` IS NULL OR `username` = '';

CREATE TEMPORARY TABLE IF NOT EXISTS `UserUsernameDuplicateFix` AS
SELECT u.`id`, LOWER(CONCAT('user-', LEFT(MD5(u.`id`), 12))) AS `replacementUsername`
FROM `User` u
JOIN (
  SELECT `username`, MIN(`id`) AS `keepId`
  FROM `User`
  WHERE `username` IS NOT NULL AND `username` <> ''
  GROUP BY `username`
  HAVING COUNT(*) > 1
) d ON d.`username` = u.`username` AND d.`keepId` <> u.`id`;

UPDATE `User` u
JOIN `UserUsernameDuplicateFix` f ON f.`id` = u.`id`
SET u.`username` = f.`replacementUsername`;

DROP TEMPORARY TABLE IF EXISTS `UserUsernameDuplicateFix`;

CREATE UNIQUE INDEX `UK_User_Username` ON `User` (`username`);
