output "vcn_id" {
  description = "RecoverOS VCN OCID."
  value       = oci_core_vcn.main.id
}

output "app_subnet_id" {
  description = "Public application subnet OCID."
  value       = oci_core_subnet.app.id
}

output "database_subnet_id" {
  description = "Private database subnet OCID."
  value       = oci_core_subnet.database.id
}

output "postgres_db_system_id" {
  description = "OCI Managed PostgreSQL system OCID."
  value       = oci_psql_db_system.main.id
}

output "postgres_instance_ids" {
  description = "OCI PostgreSQL instance OCIDs. Resolve the private endpoint from the OCI console/API after provisioning."
  value       = [for instance in oci_psql_db_system.main.instances : instance.id]
}

output "object_storage_bucket_name" {
  description = "Private encrypted document bucket name."
  value       = oci_objectstorage_bucket.documents.name
}

output "object_storage_namespace" {
  description = "OCI Object Storage namespace."
  value       = data.oci_objectstorage_namespace.current.namespace
}

output "app_public_ip" {
  description = "Optional Compute public IP when enable_compute is true."
  value       = try(oci_core_instance.app[0].public_ip, null)
}
