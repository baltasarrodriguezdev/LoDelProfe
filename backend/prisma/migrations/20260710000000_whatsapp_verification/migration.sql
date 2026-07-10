ALTER TABLE `users`
  ADD COLUMN `phoneVerified` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isBlocked` BOOLEAN NOT NULL DEFAULT false;

UPDATE `users` SET `phoneVerified` = true WHERE `role` IN ('ADMIN', 'SUPERADMIN');

UPDATE `bookings` SET `status` = 'CONFIRMED' WHERE `status` = 'RESERVED';

ALTER TABLE `bookings`
  MODIFY `status` ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'PLAYED', 'CANCELLED', 'NO_SHOW', 'BLOCKED') NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `cancellationReason` TEXT NULL;

DROP TABLE IF EXISTS `pending_registrations`;
