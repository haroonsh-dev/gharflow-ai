-- Preserve the three decimal places accepted by bill and meter-reading inputs.
ALTER TABLE bills ALTER COLUMN previous_reading TYPE numeric(14,3), ALTER COLUMN current_reading TYPE numeric(14,3), ALTER COLUMN billed_units TYPE numeric(14,3);
ALTER TABLE meter_readings ALTER COLUMN reading_value TYPE numeric(14,3);
