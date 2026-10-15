ALTER TABLE `bookings`
  MODIFY `createdBy` INTEGER NULL;

CREATE TABLE `bot_booking_requests` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `keyHash` CHAR(64) NOT NULL,
  `requestHash` CHAR(64) NOT NULL,
  `bookingId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `bot_booking_requests_keyHash_key`(`keyHash`),
  UNIQUE INDEX `bot_booking_requests_bookingId_key`(`bookingId`),
  INDEX `bot_booking_requests_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `bot_booking_requests_bookingId_fkey`
    FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_phone_locks` (
  `phoneHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`phoneHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
