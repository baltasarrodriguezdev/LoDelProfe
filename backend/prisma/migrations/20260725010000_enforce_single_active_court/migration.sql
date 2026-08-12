UPDATE `courts`
SET `active` = false
WHERE `active` = true
  AND `id` <> (
    SELECT `canonicalId`
    FROM (SELECT MIN(`id`) AS `canonicalId` FROM `courts` WHERE `active` = true) AS `active_court`
  );
