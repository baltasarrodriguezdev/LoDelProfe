ALTER TABLE `users`
  ADD COLUMN `email` VARCHAR(254) NULL,
  ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `accessMigratedAt` DATETIME(3) NULL,
  ADD UNIQUE INDEX `users_email_key` (`email`);

CREATE TABLE `account_tokens` (
  `id` VARCHAR(30) NOT NULL,
  `userId` INTEGER NOT NULL,
  `purpose` ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `targetEmail` VARCHAR(254) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `invalidatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `account_tokens_tokenHash_key` (`tokenHash`),
  INDEX `account_tokens_userId_purpose_createdAt_idx` (`userId`, `purpose`, `createdAt`),
  INDEX `account_tokens_purpose_expiresAt_idx` (`purpose`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `account_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_links` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `phoneE164` VARCHAR(20) NOT NULL,
  `provider` VARCHAR(40) NOT NULL,
  `verifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `whatsapp_links_userId_key` (`userId`),
  UNIQUE INDEX `whatsapp_links_phoneE164_key` (`phoneE164`),
  INDEX `whatsapp_links_phoneE164_revokedAt_idx` (`phoneE164`, `revokedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `whatsapp_links_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_link_challenges` (
  `id` VARCHAR(30) NOT NULL,
  `userId` INTEGER NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `claimedPhoneE164` VARCHAR(20) NULL,
  `provider` VARCHAR(40) NULL,
  `providerEventId` VARCHAR(191) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `claimedAt` DATETIME(3) NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `whatsapp_link_challenges_tokenHash_key` (`tokenHash`),
  UNIQUE INDEX `whatsapp_link_challenges_providerEventId_key` (`providerEventId`),
  INDEX `whatsapp_link_challenges_userId_expiresAt_idx` (`userId`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `whatsapp_link_challenges_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
