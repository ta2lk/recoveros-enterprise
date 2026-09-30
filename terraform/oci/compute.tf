resource "oci_core_instance" "app" {
  count               = var.enable_compute ? 1 : 0
  availability_domain = var.availability_domain
  compartment_id      = var.compartment_id
  display_name        = "${var.project_name}-app"
  shape               = var.compute_shape

  shape_config {
    ocpus         = var.compute_ocpus
    memory_in_gbs = var.compute_memory_gbs
  }

  source_details {
    source_type             = "image"
    source_id               = var.compute_image_ocid
    boot_volume_size_in_gbs = var.compute_boot_volume_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.app.id
    assign_public_ip = true
    hostname_label   = "recoveros"
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
  }

  freeform_tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
  }

  lifecycle {
    precondition {
      condition     = !var.enable_compute || (var.availability_domain != "" && var.compute_image_ocid != "" && var.ssh_public_key != "")
      error_message = "availability_domain, compute_image_ocid, and ssh_public_key are required when enable_compute is true."
    }
  }
}
