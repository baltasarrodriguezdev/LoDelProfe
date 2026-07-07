UPDATE business_hours
SET openTime = CASE WHEN dayOfWeek = 4 THEN '09:00' ELSE '15:00' END,
    closeTime = '00:00',
    active = CASE WHEN dayOfWeek BETWEEN 1 AND 5 THEN TRUE ELSE FALSE END;
