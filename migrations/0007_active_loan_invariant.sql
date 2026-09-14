CREATE UNIQUE INDEX idx_loans_one_active_per_record
ON loans(record_id)
WHERE return_date = '';
