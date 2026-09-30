# RecoverOS OCI Terraform

This stack provisions the OCI foundation for RecoverOS:

- VCN with a public application subnet and private PostgreSQL subnet.
- OCI Managed PostgreSQL (`oci_psql_db_system`) with a daily backup policy. Point-in-time recovery must be enabled separately if supported by the selected OCI service/region and provider version.
- Dedicated OCI Vault and AES-256 KMS key, plus a private versioned Object Storage bucket encrypted with that key.
- Optional Compute instance for a Docker host (`enable_compute = false` by default).

The configuration does **not** create IAM users or API keys. It creates the document-encryption Vault/key by default; set `create_kms_resources = false` and provide `existing_kms_key_id` only when an approved key already exists.

## Prerequisites

1. Terraform >= 1.6.
2. OCI API signing key configured on the runner, or execution through OCI Resource Manager.
3. Permission to create VCN, subnets, PostgreSQL, and Object Storage resources in the target compartment.
4. Permission to create an OCI Vault and KMS key, or an approved existing key OCID.
5. A remote Terraform state policy. Prefer OCI Resource Manager for state, locking, and audit history; do not commit `.tfstate` files.

## CLI workflow

```bash
cd terraform/oci
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars using a secret manager or protected CI variables.
terraform init
terraform fmt -check
terraform validate
terraform plan -out recoveros.plan
terraform apply recoveros.plan
```

For production, pass the PostgreSQL password and OCI private key through protected environment variables or Resource Manager stack variables rather than writing them into the repository. `terraform.tfvars` is ignored by Git.

## Application integration

After apply, configure the RecoverOS runtime with:

- `DATABASE_URL` using the private PostgreSQL endpoint and administrator/user credentials.
- `OBJECT_STORAGE_DRIVER=s3`.
- OCI Object Storage S3 compatibility endpoint, namespace, bucket, access key, and secret key, or use an OCI instance/resource principal adapter.
- `OBJECT_STORAGE_SSE_KMS_KEY_ID` mapped to the Vault key OCID where the application adapter supports it.
- `RECOVEROS_MASTER_KEK_HEX` from a separate secret manager; this is the application envelope-encryption key and is distinct from the bucket's OCI KMS key.

The database subnet has no public IP and only accepts TCP/5432 from the application subnet. Review `admin_cidrs` and `app_ingress_cidrs` before applying; never leave SSH open to `0.0.0.0/0`.

## Important production notes

- Run `terraform plan` in CI and require review before `apply`.
- Enable OCI Cloud Guard, audit logging, budgets, and notifications in the tenancy.
- Use a separate compartment and Terraform execution identity for production.
- Do not run `terraform destroy` against production without an approved recovery plan.
