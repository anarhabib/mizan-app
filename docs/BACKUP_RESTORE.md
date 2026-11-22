# Local backup and restore

The milestone recovery objective permits at most 24 hours of data loss. Before pilot use, take a backup at least daily and after consequential changes, retain a copy away from the development machine, and repeat an isolated restore drill. Record the backup time, source commit, database version, archive hash, restored record checks, and recovery duration. Current execution evidence belongs in `PROJECT_STATE.md`.

The customer-facing brand is Misqal. Existing `mizan` schema names, local backup paths, and container identifiers below are legacy operational identifiers and remain unchanged.

## What to preserve

A complete recovery set contains the PostgreSQL archive, product photo object files, and separately protected configuration needed to recreate the matching Supabase services. The database holds the `mizan` business schema, Supabase Auth identities in `auth`, and Storage metadata in `storage`. Photo bytes live in Storage's object backend. Store secrets separately from source control and from acceptance reports.

`mizan."User".id` identifies the Supabase Auth user by UUID. A business-schema restore can validate inventory and financial records in ordinary PostgreSQL. Restoring access to the application also requires matching Auth identities and compatible Supabase services. Preserve existing UUIDs when recovering Auth users so organization memberships, sales actors, and movement actors remain linked.

## Create the database archive

Stop the web and API processes with Ctrl+C to prevent application writes while collecting the database and photo backups. Leave Supabase running for `pg_dump`. Choose the local database container from `docker ps`; the configured project normally names it `supabase_db_mizan-app`.

The following PowerShell commands use PostgreSQL's custom archive format. `docker cp` transfers the binary archive without passing it through PowerShell text redirection.

```powershell
$mizanDatabaseContainer = 'supabase_db_mizan-app'
$mizanBackupDirectory = Join-Path $env:LOCALAPPDATA 'Mizan/backups'
New-Item -ItemType Directory -Force -Path $mizanBackupDirectory | Out-Null
$mizanBackupStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$mizanArchiveName = "mizan-$mizanBackupStamp.dump"
$mizanArchivePath = Join-Path $mizanBackupDirectory $mizanArchiveName
docker exec $mizanDatabaseContainer pg_dump -U postgres -d postgres --format=custom --no-owner --no-acl --file=/tmp/mizan-backup.dump
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed' }
docker cp "${mizanDatabaseContainer}:/tmp/mizan-backup.dump" $mizanArchivePath
if ($LASTEXITCODE -ne 0) { throw 'Archive transfer failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath $mizanArchivePath
git rev-parse HEAD
docker exec $mizanDatabaseContainer postgres --version
```

The archive includes all accessible schemas in one consistent database snapshot. Keep it private because it includes Auth data and business records. A successful archive command alone does not establish recoverability. Continue with the isolated restore and record comparison.

## Preserve product photo files

Inspect the Storage container's mounts to locate the object backend before copying it.

```powershell
docker inspect supabase_storage_mizan-app --format '{{json .Mounts}}'
```

The tested local file backend mounts its object volume at `/mnt`. Confirm the actual destination in the inspection output, then copy that directory while application writes remain stopped.

```powershell
$mizanStorageBackup = Join-Path $mizanBackupDirectory "storage-$mizanBackupStamp"
docker cp 'supabase_storage_mizan-app:/mnt' $mizanStorageBackup
if ($LASTEXITCODE -ne 0) { throw 'Storage file backup failed' }
```

If the inspected mount differs, use the actual backend path. Keep the database archive and object snapshot together. After recovery into a compatible Supabase stack, confirm each recorded `Product.photoObjectKey` resolves through the private `product-photos` bucket and a signed URL returns the expected bytes and content type. Record photo recovery separately if the dataset contains no confirmed photo.

## Restore business records into an isolated database

Use a fresh PostgreSQL 17 container with a distinct name. This drill does not need a host port. Set `$mizanArchivePath` to the existing backup file if using a new PowerShell session.

```powershell
$mizanRestoreContainer = 'mizan-restore-drill'
docker run --name $mizanRestoreContainer -e POSTGRES_PASSWORD=mizan-restore-local -d postgres:17-alpine
if ($LASTEXITCODE -ne 0) { throw 'Restore container creation failed' }
$mizanRestoreReady = $false
for ($mizanAttempt = 0; $mizanAttempt -lt 60; $mizanAttempt++) {
  docker exec $mizanRestoreContainer pg_isready -U postgres | Out-Null
  if ($LASTEXITCODE -eq 0) { $mizanRestoreReady = $true; break }
  Start-Sleep -Seconds 1
}
if (!$mizanRestoreReady) { throw 'Restore database did not become ready' }
docker cp $mizanArchivePath "${mizanRestoreContainer}:/tmp/mizan-backup.dump"
if ($LASTEXITCODE -ne 0) { throw 'Archive transfer failed' }
docker exec $mizanRestoreContainer createdb -U postgres mizan_restore
if ($LASTEXITCODE -ne 0) { throw 'Restore database creation failed' }

docker exec $mizanRestoreContainer psql -U postgres -d mizan_restore -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA mizan'
if ($LASTEXITCODE -ne 0) { throw 'Restore schema creation failed' }
docker exec $mizanRestoreContainer pg_restore -U postgres -d mizan_restore --schema=mizan --no-owner --no-acl --exit-on-error /tmp/mizan-backup.dump
if ($LASTEXITCODE -ne 0) { throw 'Business schema restore failed' }
```

The `mizan` schema is self-contained and restores into ordinary PostgreSQL. Keep the full archive for recovery of Auth and Storage in a compatible Supabase environment. A whole-stack recovery must use matching service versions and configuration, restore the managed schemas using Supabase's supported procedure, restore the Storage backend, and exercise sign-in and signed photo access. Treat that as a separate recovery drill if only business records were restored here.

## Verify restored records

Run the same SQL against the source before resuming writes and against `mizan_restore`. Compare exact decimal strings and UUIDs. Include at least one completed ordinary sale and one trade-in with a payout so the checks exercise settlement and historical snapshots.

Save this query to a temporary SQL file outside source control, then copy it into both containers with `docker cp`. Execute it with `psql -U postgres -d <database> -v ON_ERROR_STOP=1 -f /tmp/mizan-verify.sql`. Use `postgres` for the source database and `mizan_restore` for the drill database.

```sql
SELECT 'Organization' AS entity, count(*) FROM mizan."Organization"
UNION ALL SELECT 'Store', count(*) FROM mizan."Store"
UNION ALL SELECT 'User', count(*) FROM mizan."User"
UNION ALL SELECT 'OrganizationMembership', count(*) FROM mizan."OrganizationMembership"
UNION ALL SELECT 'StoreAssignment', count(*) FROM mizan."StoreAssignment"
UNION ALL SELECT 'Product', count(*) FROM mizan."Product"
UNION ALL SELECT 'Sale', count(*) FROM mizan."Sale"
UNION ALL SELECT 'TradeIn', count(*) FROM mizan."TradeIn"
UNION ALL SELECT 'ReceivedOldGold', count(*) FROM mizan."ReceivedOldGold"
UNION ALL SELECT 'InventoryMovement', count(*) FROM mizan."InventoryMovement"
ORDER BY entity;

SELECT "id", "name", "defaultCurrency", "salespersonCanViewAcquisitionCost"
FROM mizan."Organization" ORDER BY "id";

SELECT "id", "organizationId", "storeId", "code", "purity", "weight",
       "acquisitionCost", "acquisitionCurrency", "status", "photoObjectKey"
FROM mizan."Product" ORDER BY "organizationId", "storeId", "id";

SELECT "id", "productId", "actorId", "idempotencyKey", "currency",
       "saleAmount", "defaultSaleAmount", "defaultAcceptedTradeInTotal",
       "settlement", "defaultSettlement", "paymentCurrency", "paymentAmount",
       "paymentExchangeRate", "convertedPayment", "changeAmount", "createdAt"
FROM mizan."Sale" ORDER BY "organizationId", "storeId", "id";

SELECT "id", "saleId", "rateId", "purity", "weight", "appliedRate",
       "calculatedValue", "acceptedValue", "overridden"
FROM mizan."TradeIn" ORDER BY "organizationId", "storeId", "id";

SELECT "tradeInId", "receivedAt" FROM mizan."ReceivedOldGold"
ORDER BY "organizationId", "storeId", "tradeInId";

SELECT "id", "actorId", "kind", "productId", "saleId", "tradeInId", "createdAt"
FROM mizan."InventoryMovement" ORDER BY "organizationId", "storeId", "id";

-- Expected result is zero after restoring the unique sale and stock relationships.
SELECT count(*) AS inconsistent_sold_products
FROM mizan."Sale" s
JOIN mizan."Product" p ON (p."organizationId", p."storeId", p."id") =
                         (s."organizationId", s."storeId", s."productId")
WHERE p."status" <> 'SOLD';
```

Also verify Auth linkage on the source and again after a full Supabase recovery. Every application user should resolve to its original Auth identity.

```sql
SELECT count(*) AS missing_auth_identities
FROM mizan."User" u LEFT JOIN auth.users a ON a.id = u.id
WHERE a.id IS NULL;
```

For a stronger comparison, export every restored table's rows in a deterministic order and compare hashes against the same source snapshot. Keep exports private. Record any empty representative table as an unverified business case, create the missing workflow through the application, and repeat the backup drill before declaring acceptance.

After comparison, stop the drill container with `docker stop mizan-restore-drill`. Retain the archive and verification evidence according to the recovery schedule. Reusing a drill container requires inspecting its state and selecting a fresh database name for each restore. Resume the application only after the database and object snapshots are complete.
