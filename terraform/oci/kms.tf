resource "oci_kms_vault" "main" {
  count          = var.create_kms_resources ? 1 : 0
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-vault"
  vault_type     = "DEFAULT"

  freeform_tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
    Purpose   = "recoveros-document-encryption"
  }
}

resource "oci_kms_key" "documents" {
  count                    = var.create_kms_resources ? 1 : 0
  compartment_id           = var.compartment_id
  display_name             = "${var.project_name}-documents-key"
  management_endpoint      = oci_kms_vault.main[0].management_endpoint
  protection_mode          = "SOFTWARE"
  is_auto_rotation_enabled = true

  key_shape {
    algorithm = "AES"
    length    = 32
  }

  freeform_tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
    Purpose   = "object-storage-sse-kms"
  }
}

locals {
  documents_kms_key_id = var.existing_kms_key_id != "" ? var.existing_kms_key_id : try(oci_kms_key.documents[0].id, "")
}

check "documents_kms_key_configured" {
  assert {
    condition     = local.documents_kms_key_id != ""
    error_message = "Set existing_kms_key_id or keep create_kms_resources=true before provisioning encrypted document storage."
  }
}
