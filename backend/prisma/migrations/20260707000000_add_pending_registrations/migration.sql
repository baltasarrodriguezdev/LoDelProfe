CREATE TABLE `pending_registrations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `firstName` VARCHAR(191) NOT NULL,
  `lastName` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `pending_registrations_phone_key`(`phone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
