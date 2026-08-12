ALTER TABLE `users`
  ADD COLUMN `verificationCode` VARCHAR(20) NULL,
  ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `phoneVerifiedById` INTEGER NULL,
  ADD COLUMN `phoneVerificationMethod` ENUM('WHATSAPP_MANUAL', 'PHONE_CALL', 'IN_PERSON') NULL,
  ADD COLUMN `securityVersion` INTEGER NOT NULL DEFAULT 0;

UPDATE `users`
SET `verificationCode` = CONCAT('VAL-', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8)))
WHERE `phoneVerified` = false;

UPDATE `users`
SET `phoneVerifiedAt` = COALESCE(`updatedAt`, `createdAt`)
WHERE `phoneVerified` = true;

CREATE UNIQUE INDEX `users_verificationCode_key` ON `users`(`verificationCode`);

CREATE TABLE `password_reset_requests` (
  `id` VARCHAR(30) NOT NULL,
  `userId` INTEGER NOT NULL,
  `status` ENUM('PENDING', 'AUTHORIZED', 'USED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  `tokenHash` CHAR(64) NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `authorizedAt` DATETIME(3) NULL,
  `authorizedById` INTEGER NULL,
  `expiresAt` DATETIME(3) NULL,
  `usedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  UNIQUE INDEX `password_reset_requests_tokenHash_key`(`tokenHash`),
  INDEX `password_reset_requests_status_requestedAt_idx`(`status`, `requestedAt`),
  INDEX `password_reset_requests_userId_status_idx`(`userId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `password_reset_requests`
  ADD CONSTRAINT `password_reset_requests_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
