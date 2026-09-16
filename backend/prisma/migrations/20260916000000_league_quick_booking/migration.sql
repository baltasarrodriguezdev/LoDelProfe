-- Vínculo opcional y único entre partido de liga y reserva de la cancha.
ALTER TABLE `league_matches` ADD COLUMN `bookingId` INTEGER NULL;
ALTER TABLE `league_matches` ADD UNIQUE INDEX `league_matches_bookingId_key` (`bookingId`);
ALTER TABLE `league_matches` ADD CONSTRAINT `league_matches_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Responsable de cada pareja para las cargas rápidas.
ALTER TABLE `league_pairs` ADD COLUMN `responsibleClientName` VARCHAR(120) NULL, ADD COLUMN `responsibleClientPhone` VARCHAR(30) NULL;