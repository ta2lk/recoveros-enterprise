resource "oci_logging_log_group" "recoveros" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-logs"
  description    = "Central log group for RecoverOS application and operational events."

  freeform_tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
  }
}

resource "oci_logging_log" "application" {
  display_name       = "${var.project_name}-application"
  log_group_id       = oci_logging_log_group.recoveros.id
  log_type           = "CUSTOM"
  is_enabled         = true
  retention_duration = var.log_retention_days
}
