UPDATE business_hours
SET openTime = '09:00',
    closeTime = '00:00',
    active = TRUE
WHERE dayOfWeek IN (0, 6);