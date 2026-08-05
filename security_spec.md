# Security Specification

## Data Invariants
1. A Cliente must have a valid name and cannot be created without a tenant context.
2. An Emprestimo must belong to a Cliente that exists in the same tenant.
3. A Recebimento must reference an Emprestimo that exists in the same tenant.
4. Users can only access data within their own tenantId.
5. Admins/Master users can modify everything in their tenant.
6. Cobradores have restricted access (mostly create/read, limited update on status).

## Dirty Dozen Payloads (Rejection Targets)
1. **Tenant Escape**: Trying to read `/tenants/other-tenant/clientes/123`.
2. **Identity Spoofing**: Creating a Recebimento with a `valor` but setting `cobradorId` to someone else's UID without permission.
3. **Ghost Field**: Adding `isVerified: true` to a Cliente document.
4. **Negative Value**: Creating an Emprestimo with `valorPrincipal: -100`.
5. **Admin Escalation**: A Cobrador trying to update a `Config` document.
6. **Orphaned Record**: Creating a Recebimento for a non-existent Emprestimo ID.
7. **Bypass Validation**: Updating `status` to 'pago' without setting `valorPrincipal` to 0.
8. **Resource Exhaustion**: Inserting a 2MB string into `observacao`.
9. **Timestamp Manipulation**: Setting `criadoEm` to a future date instead of `request.time`.
10. **ID Poisoning**: Using `/tenants/mytenant/clientes/../../system/config` as an ID if possible in some drivers.
11. **Immutable Field Change**: Changing the `clienteId` of an existing Emprestimo.
12. **Anonymous Access**: Full read/write without being signed in.

## Test Runner (Draft)
The test runner will verify these cases. For now, I will proceed to generate the rules.
