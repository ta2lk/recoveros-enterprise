resource "oci_core_vcn" "main" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-vcn"
  cidr_blocks    = [var.vcn_cidr]
  dns_label      = "recoveros"
  freeform_tags  = { Project = var.project_name, ManagedBy = "terraform" }
}

resource "oci_core_internet_gateway" "main" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-igw"
  vcn_id         = oci_core_vcn.main.id
  enabled        = true
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-public-routes"
  vcn_id         = oci_core_vcn.main.id

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.main.id
  }
}

resource "oci_core_security_list" "app" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-app-security"
  vcn_id         = oci_core_vcn.main.id

  egress_security_rules {
    destination      = "0.0.0.0/0"
    destination_type = "CIDR_BLOCK"
    protocol         = "all"
  }

  dynamic "ingress_security_rules" {
    for_each = var.admin_cidrs
    content {
      protocol    = "6"
      source      = ingress_security_rules.value
      source_type = "CIDR_BLOCK"
      tcp_options {
        min = 22
        max = 22
      }
    }
  }

  dynamic "ingress_security_rules" {
    for_each = var.app_ingress_cidrs
    content {
      protocol    = "6"
      source      = ingress_security_rules.value
      source_type = "CIDR_BLOCK"
      tcp_options {
        min = 3000
        max = 3000
      }
    }
  }
}

resource "oci_core_security_list" "database" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-database-security"
  vcn_id         = oci_core_vcn.main.id

  egress_security_rules {
    destination      = "0.0.0.0/0"
    destination_type = "CIDR_BLOCK"
    protocol         = "all"
  }

  ingress_security_rules {
    protocol    = "6"
    source      = var.app_subnet_cidr
    source_type = "CIDR_BLOCK"
    tcp_options {
      min = 5432
      max = 5432
    }
  }
}

resource "oci_core_subnet" "app" {
  compartment_id             = var.compartment_id
  display_name               = "${var.project_name}-app-public"
  vcn_id                     = oci_core_vcn.main.id
  cidr_block                 = var.app_subnet_cidr
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.app.id]
  prohibit_public_ip_on_vnic = false
  dns_label                  = "app"
}

resource "oci_core_subnet" "database" {
  compartment_id             = var.compartment_id
  display_name               = "${var.project_name}-db-private"
  vcn_id                     = oci_core_vcn.main.id
  cidr_block                 = var.db_subnet_cidr
  security_list_ids          = [oci_core_security_list.database.id]
  prohibit_public_ip_on_vnic = true
  dns_label                  = "db"
}
