CREATE TABLE `push_subscriptions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `endpoint` TEXT NOT NULL,
  `endpointHash` CHAR(64) NOT NULL,
  `p256dh` VARCHAR(255) NOT NULL,
  `auth` VARCHAR(255) NOT NULL,
  `userAgent` VARCHAR(512) NULL,
  `failureCount` INTEGER NOT NULL DEFAULT 0,
  `lastSuccessAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `push_subscriptions_endpointHash_key`(`endpointHash`),
  INDEX `push_subscriptions_userId_idx`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `push_subscriptions_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
