CREATE TABLE `league_seasons` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(80) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `seasonYear` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
  `currentStage` ENUM('GROUP_STAGE', 'ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL') NOT NULL DEFAULT 'GROUP_STAGE',
  `courtId` INTEGER NULL,
  `timezone` VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Cordoba',
  `bestOfSets` INTEGER NOT NULL DEFAULT 3,
  `fullThirdSet` BOOLEAN NOT NULL DEFAULT true,
  `allPairsAdvance` BOOLEAN NOT NULL DEFAULT true,
  `registrationFee` DECIMAL(12,2) NULL,
  `firstPrize` VARCHAR(255) NULL,
  `secondPrize` VARCHAR(255) NULL,
  `ballAvailabilityNote` VARCHAR(255) NULL,
  `scheduleNote` TEXT NULL,
  `activeFrom` DATE NULL,
  `activeUntil` DATE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `league_seasons_slug_key` (`slug`),
  INDEX `league_seasons_status_seasonYear_idx` (`status`, `seasonYear`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `league_zones` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `leagueId` INTEGER NOT NULL,
  `code` VARCHAR(8) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `regularDay` VARCHAR(30) NULL,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `league_zones_leagueId_code_key` (`leagueId`, `code`),
  INDEX `league_zones_leagueId_displayOrder_idx` (`leagueId`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `league_players` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `leagueId` INTEGER NOT NULL,
  `displayName` VARCHAR(120) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `league_players_leagueId_displayName_idx` (`leagueId`, `displayName`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `league_pairs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `leagueId` INTEGER NOT NULL,
  `zoneId` INTEGER NOT NULL,
  `seedNumber` INTEGER NOT NULL,
  `displayName` VARCHAR(255) NOT NULL,
  `firstPlayerId` INTEGER NOT NULL,
  `secondPlayerId` INTEGER NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `league_pairs_leagueId_displayName_key` (`leagueId`, `displayName`),
  UNIQUE INDEX `league_pairs_zoneId_seedNumber_key` (`zoneId`, `seedNumber`),
  INDEX `league_pairs_leagueId_zoneId_idx` (`leagueId`, `zoneId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `league_rule_settings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `leagueId` INTEGER NOT NULL,
  `straightSetsWinPoints` INTEGER NOT NULL DEFAULT 3,
  `threeSetsWinPoints` INTEGER NOT NULL DEFAULT 2,
  `threeSetsLossPoints` INTEGER NOT NULL DEFAULT 1,
  `straightSetsLossPoints` INTEGER NULL,
  `gamesPositiveDefinition` TEXT NULL,
  `multiPairTieRule` TEXT NULL,
  `walkoverRule` TEXT NULL,
  `retirementRule` TEXT NULL,
  `incompleteMatchRule` TEXT NULL,
  `reschedulingRule` TEXT NULL,
  `sixAllTiebreakRule` TEXT NULL,
  `updatedById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `league_rule_settings_leagueId_key` (`leagueId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `league_matches` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `leagueId` INTEGER NOT NULL,
  `zoneId` INTEGER NULL,
  `stage` ENUM('GROUP_STAGE', 'ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL') NOT NULL,
  `matchday` INTEGER NULL,
  `code` VARCHAR(30) NOT NULL,
  `scheduledDate` DATE NULL,
  `scheduledTime` VARCHAR(5) NULL,
  `status` ENUM('SCHEDULED', 'LIVE', 'FINISHED', 'RESCHEDULED', 'SUSPENDED', 'PENDING') NOT NULL DEFAULT 'SCHEDULED',
  `homePairId` INTEGER NULL,
  `awayPairId` INTEGER NULL,
  `homePlaceholder` VARCHAR(120) NULL,
  `awayPlaceholder` VARCHAR(120) NULL,
  `official` BOOLEAN NOT NULL DEFAULT false,
  `officialAt` DATETIME(3) NULL,
  `rescheduleNote` TEXT NULL,
  `nextMatchId` INTEGER NULL,
  `nextSlot` ENUM('HOME', 'AWAY') NULL,
  `updatedById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `league_matches_leagueId_code_key` (`leagueId`, `code`),
  INDEX `league_matches_leagueId_stage_scheduledDate_idx` (`leagueId`, `stage`, `scheduledDate`),
  INDEX `league_matches_zoneId_matchday_idx` (`zoneId`, `matchday`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `league_match_sets` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `matchId` INTEGER NOT NULL,
  `setNumber` INTEGER NOT NULL,
  `homeGames` INTEGER NOT NULL,
  `awayGames` INTEGER NOT NULL,
  UNIQUE INDEX `league_match_sets_matchId_setNumber_key` (`matchId`, `setNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `league_seasons` ADD CONSTRAINT `league_seasons_courtId_fkey` FOREIGN KEY (`courtId`) REFERENCES `courts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `league_zones` ADD CONSTRAINT `league_zones_leagueId_fkey` FOREIGN KEY (`leagueId`) REFERENCES `league_seasons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `league_players` ADD CONSTRAINT `league_players_leagueId_fkey` FOREIGN KEY (`leagueId`) REFERENCES `league_seasons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `league_pairs` ADD CONSTRAINT `league_pairs_leagueId_fkey` FOREIGN KEY (`leagueId`) REFERENCES `league_seasons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `league_pairs` ADD CONSTRAINT `league_pairs_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `league_zones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `league_pairs` ADD CONSTRAINT `league_pairs_firstPlayerId_fkey` FOREIGN KEY (`firstPlayerId`) REFERENCES `league_players`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `league_pairs` ADD CONSTRAINT `league_pairs_secondPlayerId_fkey` FOREIGN KEY (`secondPlayerId`) REFERENCES `league_players`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `league_rule_settings` ADD CONSTRAINT `league_rule_settings_leagueId_fkey` FOREIGN KEY (`leagueId`) REFERENCES `league_seasons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `league_matches` ADD CONSTRAINT `league_matches_leagueId_fkey` FOREIGN KEY (`leagueId`) REFERENCES `league_seasons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `league_matches` ADD CONSTRAINT `league_matches_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `league_zones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `league_matches` ADD CONSTRAINT `league_matches_homePairId_fkey` FOREIGN KEY (`homePairId`) REFERENCES `league_pairs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `league_matches` ADD CONSTRAINT `league_matches_awayPairId_fkey` FOREIGN KEY (`awayPairId`) REFERENCES `league_pairs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `league_matches` ADD CONSTRAINT `league_matches_nextMatchId_fkey` FOREIGN KEY (`nextMatchId`) REFERENCES `league_matches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `league_match_sets` ADD CONSTRAINT `league_match_sets_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `league_matches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
