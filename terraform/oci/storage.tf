data "oci_objectstorage_namespace" "current" {
  compartment_id = var.compartment_id
}

resource "oci_objectstorage_bucket" "documents" {
  compartment_id = var.compartment_id
  namespace      = data.oci_objectstorage_namespace.current.namespace
  name           = var.object_storage_bucket_name
  access_type    = "NoPublicAccess"
  versioning     = "Enabled"
  storage_tier   = "Standard"
  kms_key_id     = var.kms_key_id

  freeform_tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
    DataClass = "encrypted-documents"
  }
}
