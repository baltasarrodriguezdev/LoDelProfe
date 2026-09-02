UPDATE `league_rule_settings`
SET `straightSetsLossPoints` = 0
WHERE `straightSetsLossPoints` IS NULL;

ALTER TABLE `league_rule_settings`
  MODIFY `straightSetsLossPoints` INTEGER NOT NULL DEFAULT 0;
