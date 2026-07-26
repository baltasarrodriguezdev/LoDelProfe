ALTER TABLE `users`
  ADD COLUMN `releasedAt` DATETIME(3) NULL;

UPDATE `users`
SET `phoneVerified` = true
WHERE `status` = 'VERIFIED';

ALTER TABLE `bookings`
  ADD COLUMN `amountPaid` DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE `business_hours`
  ADD COLUMN `breakStartTime` VARCHAR(5) NULL,
  ADD COLUMN `breakEndTime` VARCHAR(5) NULL;

UPDATE `business_hours`
SET `breakStartTime` = '13:00', `breakEndTime` = '15:00'
WHERE `dayOfWeek` = 4 AND `openTime` = '09:00' AND `closeTime` = '00:00';

UPDATE `bookings`
SET `amountPaid` = `priceTotal`
WHERE `paymentStatus` = 'PAID';

CREATE TABLE `venue_settings` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `cancellationCutoffMinutes` INTEGER NOT NULL DEFAULT 120,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `venue_settings` (`id`, `cancellationCutoffMinutes`, `updatedAt`)
VALUES (1, 120, CURRENT_TIMESTAMP(3));

CREATE TABLE `audit_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `actorId` INTEGER NULL,
  `action` VARCHAR(80) NOT NULL,
  `entityType` VARCHAR(50) NOT NULL,
  `entityId` VARCHAR(50) NULL,
  `details` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `audit_logs_createdAt_idx`(`createdAt`),
  INDEX `audit_logs_entityType_entityId_idx`(`entityType`, `entityId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
