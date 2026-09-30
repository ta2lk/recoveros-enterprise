variable "tenancy_ocid" {
  description = "OCI tenancy OCID. Supply through tfvars or Resource Manager variables."
  type        = string
  sensitive   = true
}

variable "user_ocid" {
  description = "OCI API user OCID."
  type        = string
  sensitive   = true
}

variable "fingerprint" {
  description = "Fingerprint for the OCI API signing key."
  type        = string
  sensitive   = true
}

variable "private_key_path" {
  description = "Path to the OCI API signing private key on the Terraform runner."
  type        = string
  sensitive   = true
}

variable "region" {
  description = "OCI region for all resources."
  type        = string
  default     = "eu-frankfurt-1"
}

variable "compartment_id" {
  description = "Compartment OCID where RecoverOS resources will be created."
  type        = string
}

variable "project_name" {
  description = "Prefix used in OCI display names."
  type        = string
  default     = "recoveros"
}

variable "vcn_cidr" {
  description = "RFC1918 CIDR for the RecoverOS VCN."
  type        = string
  default     = "10.42.0.0/16"
}

variable "app_subnet_cidr" {
  description = "Public subnet CIDR for the application host."
  type        = string
  default     = "10.42.10.0/24"
}

variable "db_subnet_cidr" {
  description = "Private subnet CIDR for PostgreSQL."
  type        = string
  default     = "10.42.20.0/24"
}

variable "admin_cidrs" {
  description = "CIDRs allowed to SSH to the optional application host. Do not use 0.0.0.0/0."
  type        = list(string)
  default     = []
}

variable "app_ingress_cidrs" {
  description = "CIDRs allowed to reach the application port. Prefer a load balancer or WAF CIDR."
  type        = list(string)
  default     = []
}

variable "postgres_version" {
  description = "OCI Managed PostgreSQL major version."
  type        = string
  default     = "16"
}

variable "postgres_shape" {
  description = "OCI PostgreSQL shape. Confirm availability in the selected region."
  type        = string
  default     = "VM.Standard.E4.Flex"
}

variable "postgres_admin_username" {
  description = "Initial PostgreSQL administrator username."
  type        = string
  default     = "recoveros_admin"
}

variable "postgres_admin_password" {
  description = "Initial PostgreSQL administrator password. Store in a secret manager."
  type        = string
  sensitive   = true
}

variable "postgres_ocpus" {
  description = "OCPUs per PostgreSQL instance."
  type        = number
  default     = 2
}

variable "postgres_memory_gbs" {
  description = "Memory in GB per PostgreSQL instance."
  type        = number
  default     = 8
}

variable "log_retention_days" {
  description = "OCI Logging retention period for the application log."
  type        = number
  default     = 30
}

variable "object_storage_bucket_name" {
  description = "Private OCI Object Storage bucket for encrypted RecoverOS documents."
  type        = string
  default     = "recoveros-documents"
}

variable "create_kms_resources" {
  description = "Create a dedicated OCI Vault and AES-256 KMS key for RecoverOS documents."
  type        = bool
  default     = true
}

variable "existing_kms_key_id" {
  description = "Optional existing OCI Vault key OCID. When set, it is used instead of the managed key."
  type        = string
  default     = ""
}

variable "enable_compute" {
  description = "Create an optional Docker application host. Keep false when deploying through OKE or another runtime."
  type        = bool
  default     = false
}

variable "availability_domain" {
  description = "Availability domain for the optional Compute instance."
  type        = string
  default     = ""
}

variable "compute_image_ocid" {
  description = "OCI Linux image OCID for the optional Compute host."
  type        = string
  default     = ""
}

variable "compute_shape" {
  description = "Compute shape for the optional Docker host."
  type        = string
  default     = "VM.Standard.E4.Flex"
}

variable "compute_ocpus" {
  description = "OCPUs for the optional Compute host."
  type        = number
  default     = 2
}

variable "compute_memory_gbs" {
  description = "Memory in GB for the optional Compute host."
  type        = number
  default     = 8
}

variable "compute_boot_volume_gbs" {
  description = "Boot volume size for the optional Compute host."
  type        = number
  default     = 50
}

variable "ssh_public_key" {
  description = "SSH public key for the optional Compute host."
  type        = string
  default     = ""
  sensitive   = true
}
