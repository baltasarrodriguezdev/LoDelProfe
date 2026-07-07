UPDATE prices
SET price = CASE durationMinutes
  WHEN 60 THEN 16000.00
  WHEN 90 THEN 20000.00
  WHEN 120 THEN 24000.00
  ELSE price
END
WHERE durationMinutes IN (60, 90, 120);
