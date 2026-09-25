-- Audit records are append-only and immutable (CONTRACT-001 "Audit record").
CREATE FUNCTION audit_records_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_records is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_records_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_records
  FOR EACH ROW EXECUTE FUNCTION audit_records_immutable();
--> statement-breakpoint
CREATE TRIGGER audit_records_no_truncate
  BEFORE TRUNCATE ON audit_records
  FOR EACH STATEMENT EXECUTE FUNCTION audit_records_immutable();
