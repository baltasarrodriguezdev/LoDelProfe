ALTER TABLE `users`
  MODIFY `phone` VARCHAR(191) NULL,
  ADD COLUMN `email` VARCHAR(255) NULL,
  ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `legacyAccount` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `bookingApprovedAt` DATETIME(3) NULL,
  ADD COLUMN `bookingApprovalMethod` VARCHAR(40) NULL;

CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);

-- Snapshot only the accounts present during deployment. New accounts default to false.
UPDATE `users`
SET `legacyAccount` = true,
    `bookingApprovedAt` = CASE WHEN `active` = true AND `isBlocked` = false AND `phone` IS NOT NULL THEN NOW(3) ELSE NULL END,
    `bookingApprovalMethod` = CASE WHEN `active` = true AND `isBlocked` = false AND `phone` IS NOT NULL THEN 'LEGACY_MIGRATION' ELSE NULL END;

CREATE TABLE `email_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `userId` INTEGER NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `purpose` ENUM('VERIFY', 'RESET_PASSWORD') NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `email_tokens_tokenHash_key` (`tokenHash`),
  INDEX `email_tokens_userId_purpose_expiresAt_idx` (`userId`, `purpose`, `expiresAt`),
  CONSTRAINT `email_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `booking_requests` (
  `id` VARCHAR(191) NOT NULL,
  `userId` INTEGER NOT NULL,
  `courtId` INTEGER NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `startTime` DATETIME(3) NOT NULL,
  `durationMinutes` INTEGER NOT NULL,
  `playersCount` INTEGER NOT NULL DEFAULT 4,
  `notes` TEXT NULL,
  `priceQuoted` DECIMAL(10,2) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `codeExpiresAt` DATETIME(3) NOT NULL,
  `status` ENUM('PENDING', 'CONFIRMED', 'NEEDS_NEW_SLOT', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  `bookingId` INTEGER NULL,
  `legacyBookingId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `booking_requests_bookingId_key` (`bookingId`),
  UNIQUE INDEX `booking_requests_legacyBookingId_key` (`legacyBookingId`),
  INDEX `booking_requests_userId_status_idx` (`userId`, `status`),
  INDEX `booking_requests_status_startTime_idx` (`status`, `startTime`),
  CONSTRAINT `booking_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `booking_requests_courtId_fkey` FOREIGN KEY (`courtId`) REFERENCES `courts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Only active web holds with a valid user code are converted. Other pending records
-- continue through the existing expiration and administrative workflows.
INSERT INTO `booking_requests` (`id`, `userId`, `courtId`, `phone`, `startTime`, `durationMinutes`, `playersCount`, `notes`, `priceQuoted`, `codeHash`, `codeExpiresAt`, `status`, `legacyBookingId`, `createdAt`, `updatedAt`)
SELECT UUID(), b.`userId`, b.`courtId`, u.`phone`, b.`startTime`, b.`durationMinutes`, b.`playersCount`, b.`notes`, b.`priceTotal`,
       SHA2(UPPER(u.`verificationCode`), 256), DATE_ADD(NOW(3), INTERVAL 24 HOUR), 'PENDING', b.`id`, b.`createdAt`, NOW(3)
FROM `bookings` b JOIN `users` u ON u.`id` = b.`userId`
WHERE b.`status` = 'PENDING' AND b.`origin` = 'WEB' AND b.`holdExpiresAt` > NOW(3)
  AND b.`startTime` > NOW(3) AND u.`verificationCode` IS NOT NULL AND u.`phone` IS NOT NULL;

UPDATE `bookings` b
JOIN `booking_requests` q ON q.`legacyBookingId` = b.`id`
SET b.`status` = 'CANCELLED', b.`cancelledAt` = NOW(3), b.`cancellationReason` = 'Solicitud migrada a nuevo flujo sin retención'
WHERE b.`status` = 'PENDING' AND b.`origin` = 'WEB';
