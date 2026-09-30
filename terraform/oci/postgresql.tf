resource "oci_psql_db_system" "main" {
  compartment_id              = var.compartment_id
  display_name                = "${var.project_name}-postgres"
  db_version                  = var.postgres_version
  shape                       = var.postgres_shape
  instance_count              = 1
  instance_ocpu_count         = var.postgres_ocpus
  instance_memory_size_in_gbs = var.postgres_memory_gbs

  credentials {
    username = var.postgres_admin_username

    password_details {
      password_type = "PLAIN_TEXT"
      password      = var.postgres_admin_password
    }
  }

  network_details {
    subnet_id = oci_core_subnet.database.id
  }

  storage_details {
    system_type           = "OCI_OPTIMIZED_STORAGE"
    is_regionally_durable = false
  }

  management_policy {
    backup_policy {
      kind           = "DAILY"
      backup_start   = "02:00"
      retention_days = 30
    }

  }

  freeform_tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
  }
}
