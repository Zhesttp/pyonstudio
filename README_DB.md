# Pyon Studio DB

PostgreSQL 15 schema (`db/schema.sql`).

## Quick start
```
psql -U postgres -c "CREATE USER pyon WITH PASSWORD 'pyon123';"
psql -U postgres -f db/schema.sql
```
Database `pyon_db` will be created. Connection URL:
```
postgres://pyon:pyon123@localhost:5432/pyon_db
```
## Main entities
| Table | Purpose |
|-------|---------|
| admins | studio administrators |
| users  | clients |
| trainers | instructors |
| plans | subscription plans |
| user_subscriptions | plan purchases |
| classes | scheduled sessions |
| bookings | client ↔ class linkage |

Extended tables: roles/permissions, payments, attendance, uploads, audit_log, settings, translations, webhooks, waitlists.

## Workflows
### Sign-up & Booking
1. `users` row created (password hashed with bcrypt).
2. Admin assigns `plan` via `user_subscriptions`.
3. Client books a class → insert into `bookings` (status `booked`).
4. If class full, insert into `waitlist_entries`.
5. Trainer marks attendance → insert/update `attendance`.

### Admin actions audited
Trigger functions should `INSERT` into `audit_log` capturing `OLD`, `NEW` rows.

### Payments
After successful provider webhook, row in `payments` updated to `paid`, optional renewal of `user_subscriptions`.

## Partitioning (optional)
```
CREATE TABLE classes_2025 PARTITION OF classes FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```
Automate yearly.

## API pointers
* `/auth/*` – JWT issuing using `admins` / `users`.
* `/classes`   – list from `classes` join `trainers`.
* `/bookings`  – CRUD with checks on `plan` validity, capacity.
* `/attendance` – trainer updates.

## Security notes
* Store only bcrypt hashes.
* Use roles/permissions to guard endpoints.
* Enable `row_level_security` if multi-tenant.
