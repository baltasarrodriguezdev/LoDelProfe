ALTER TABLE `bookings`
  ADD COLUMN `holdExpiresAt` DATETIME(3) NULL;

UPDATE `bookings`
SET `holdExpiresAt` = DATE_ADD(`createdAt`, INTERVAL 10 MINUTE)
WHERE `status` = 'PENDING';

CREATE INDEX `bookings_status_holdExpiresAt_idx`
  ON `bookings`(`status`, `holdExpiresAt`);
