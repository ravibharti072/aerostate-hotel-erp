# AeroState Hotel ERP — Codebase Study

_Generated from a full read of the repository at `C:\Users\Ravi\aeriostate-hotel-erp`, plus AST/route/dependency audits and a frontend production build._

---

## 1. What this system is

A multi-tenant **hotel Property Management System (PMS) / ERP** with two levels of tenancy:

- **Super Admin** — onboards hotels, assigns modules, manages subscriptions and credentials across all hotels.
- **Hotel tenant** — runs Front Desk, Rooms, Restaurant/POS, Housekeeping, Maintenance, Inventory, Procurement, Accounts, Staff/HR, Reports, Alerts.

### Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.14.5, FastAPI 0.141.1, SQLAlchemy 2.0.52, Pydantic 2.13.4, Starlette 1.6.0 |
| Auth | JWT (`python-jose`, HS256) + `passlib` PBKDF2-SHA256, `HTTPBearer` |
| DB | SQLite (`hotel_erp.db`) — no migration tool (no Alembic) |
| Frontend | React 19.2, Vite 8 (Rolldown), react-router-dom 7.17, axios, lucide-react |
| Styling | Plain CSS + CSS Modules mix, no design-token system |

### Verified runtime state

- `backend/app/main.py` **imports cleanly**; the app exposes **196 paths / 307 operations**.
- Frontend **production build succeeds**: 1979 modules → `index.js` 1,901.86 kB (425.90 kB gzip), `index.css` 529.15 kB (67.25 kB gzip).
- **The working tree is mid-rewrite.** The last commit is `0f60273 super admin updated`; there are **4 commits total**.

### The rewrite: what is actually committed vs. on disk

This is the single most important fact about the repository's current state:

| Layer | Tracked at `HEAD` | On disk | Status |
|---|---|---|---|
| `app/services/` | **0 files** | 30 files (~14,200 lines) | **entirely new, untracked** |
| `app/repositories/` | **0 files** | 28 files (~5,600 lines) | **entirely new, untracked** |
| `app/routers/` | ~21 files (all logic inline) | 30 files, thinned down | heavily rewritten, uncommitted |
| `app/models.py` | 583 lines | 1,858 lines | +1,275 lines, uncommitted |
| `app/schemas.py` | ~1,200 lines | 2,462 lines | +4,558/−? , uncommitted |
| `frontend/src/modules/` | `departments/*` tree | restructured flat | 69 files deleted, 209 untracked |

Concretely: `bookings.py` was **571 lines at `HEAD` and is 182 lines now** — the logic moved into `booking_service.py` + `booking_repository.py`, both of which exist only on disk.

**So the in-progress work IS the architecture.** The router→service→repository layering described in §1 is not the committed system; it is an unfinished refactor sitting entirely in the working tree, unversioned. Roughly **8,497 insertions / 8,782 deletions** are uncommitted in the backend alone.

This has two consequences:
1. There is **no rollback point** for any of the new architecture. `git checkout .` would delete the entire service and repository layers.
2. `git status` is effectively useless as a signal — 209 untracked files means "everything is new" rather than "these files are suspicious".

**Before any further editing, this must be committed.** It is the highest-priority action in this report.

- Two divergent databases exist. The app resolves `sqlite:///./hotel_erp.db` **relative to the CWD**, so it depends on where you launch uvicorn:

| Path | Tables | Data |
|---|---|---|
| `backend/hotel_erp.db` | 66 | **real**: 10 users, 1 hotel, 19 bookings, 9 rooms, 16 guests, 8 staff, 19 invoices, 6 inventory items |
| `hotel_erp.db` (repo root) | 62 | near-empty: 0 users, 1 hotel, 1 booking, 1 room, 1 guest |
| `backend/hotel.db` | — | 0 bytes, stray |

### Architecture (intended)

```
routers/  (HTTP + validation)  →  services/  (business rules)  →  repositories/  (queries)  →  models
```

This layering is real and consistently followed in **most** modules — but `backend/app/repositories/` is **entirely untracked/new**, and two routers bypass it completely (see §4).

### Scale

| Area | Files | Lines |
|---|---|---|
| Backend models | 1 | 1,858 (65 model classes) |
| Backend schemas | 1 | 2,462 (257 classes) |
| Backend routers | 30 | ~8,000 |
| Backend services | 29 | ~9,500 (`inventory_service.py` alone = 2,053) |
| Backend repositories | 29 | ~5,600 |
| Frontend JS/JSX | 116 | **69,784** |
| Frontend CSS | 81 | 40,144 |

---

## 2. Domain model — 65 entities

**Core PMS:** `Hotel`, `Room`, `Guest`, `Booking`, `BookingGuest`, `Folio`, `FolioCharge`, `Invoice`, `Payment`, `InvoicePaymentAllocation`

**Restaurant/POS:** `MenuItem`, `RestaurantOrder`, `RestaurantOrderItem`, `RestaurantTable`

**Inventory (17 tables):** `InventoryCategory`, `InventoryUnit`, `InventoryStore`, `InventoryLocationStock`, `InventoryItem`, `InventoryReceipt(+Item)`, `InventoryIssue(+Item)`, `InventoryConsumption`, `InventoryReturn(+Item)`, `InventorySupplierReturn(+Item)`, `InventoryTransfer(+Item)`, `InventoryAdjustment`, `InventoryWastage`, `PhysicalStockCount(+Item)`, `InventoryStockLedger`, `StockTransaction`

**Maintenance:** `MaintenanceAsset`, `MaintenanceRequest`, `MaintenanceWorkOrder`, `MaintenancePartUsage`, `PreventiveMaintenancePlan`, `MaintenanceTechnicianRoster`

**Department workflow:** `DepartmentTask`, `DepartmentTicket`, `DepartmentAuditLog`

**Housekeeping:** `HousekeepingTask`, `HousekeepingInspection`, `HousekeepingTaskHistory`

**Staff/HR:** `Staff`, `StaffAttendance`, `BiometricLog`, `StaffSalaryStructure`, `StaffSalary`, `SalaryAdvance`, `StaffLeave`

**Other:** `LaundryOrder`, `MinibarCharge`, `ExtraCharge`, `ExtraServiceCatalog`, `Vendor`, `PurchaseOrder(+Item)`, `Expense`, `User`, `SystemAnnouncement`

Notable design choices: `Hotel.modules` (JSON) is the per-tenant feature flag driving the sidebar; `User.allowed_modules` (JSON) is per-user override; `Booking.assigned_room_ids` (JSON) supports multi-room bookings on a single row.

---

## 3. Feature inventory (by module)

| Module | Backend endpoints | Frontend pages | Notes |
|---|---|---|---|
| Auth / Users | 11 | Login, SuperAdminLogin | `/auth/login` **exists**; JWT 60-min expiry |
| Hotels / System | 15 | Onboard, Directory, Subscriptions, AssignModule | Super-admin only (mostly) |
| Rooms | 7 | RoomsPage, AddRoom, RoomStatus, Dashboard | |
| Front Desk | 16 | CheckInOut (3,919 lines!), Bookings, Guests, Invoices, Payments, ExtraCharges, Calendar dashboard | Largest UI surface |
| Restaurant | 17 | MenuItems, Orders, Kitchen, Tables, Billing, RoomService, Reports, Dashboard | Full POS |
| Housekeeping | 17 | Dashboard, CheckoutCleaning, Inspection, AssignedWork, Minibar, Laundry, Reports | |
| Maintenance | 13 + 7 work orders + 7 preventive + 6 assets | Dashboard, Admin, Tasks, MyTasks, Requests, WorkOrders, Preventive, Assets | |
| Inventory | 55 | Directory, StockInOut, Adjustments, LowStock, Reports | Most complete backend |
| Procurement | 11 | ProcurementPage | Vendors + POs |
| Accounts | 6 | Portal, SalaryPayout, SalaryAdvances, Expenses | |
| Staff / HR | 22 | Directory, Attendance, Biometric, Leaves, Payroll, Salary, PortalAccess | **Unauthenticated backend** |
| Reports | 11 | ReportsPage | Finance, P&L, Revenue, Expense, Cashier shift, Daily closing, Audit trail |
| Dashboard | 4 | Role-routed Dashboards | |
| Tasks / Tickets | 22 | (embedded in dept dashboards) | New, untracked |
| Alerts / Announcements | 3 | AlertsList, AlertDetail, GlobalAnnouncement | |
| **Total** | **~307 operations** | **~100 pages** | |

---

## 4. Critical findings

### 🔴 A. Authorization is enforced on the **frontend** and only partially on the backend

`frontend/src/config/rbacConfig.js` (543 lines) maps `{department × role_level}` → `allowedModules` / `allowedPaths` / `allowedNavChildren`. `HotelLayout.jsx:78-111` gates every route with `canAccessRoute()`. This is genuinely well-built — but it is **client-side only**. The API has no equivalent matrix.

Consequences:
- Any authenticated user can call any endpoint that only requires `get_current_user`, regardless of department or role level.
- Nine of ten routers use `get_current_user` (authentication) where they should use role/department guards (authorization).
- `require_department_access()` and `require_roles()` — the two factories written for exactly this — are **defined and never used anywhere**.

### 🔴 B. 20 endpoints have **no authentication at all**

| Method | Path | File |
|---|---|---|
| GET | `/announcements/` | `announcements.py:21` |
| GET | `/announcements/active` | `announcements.py:28` |
| POST | `/biometric/pull-device-sync` | `biometric.py:24` |
| POST | `/biometric/punch` | `biometric.py:37` |
| POST | `/biometric/sync-batch` | `biometric.py:45` |
| GET/PUT/DELETE | `/extra-charges/{charge_id}` | `extra_charges.py:85,93,102` |
| GET/POST | `/staff-salary-structures` | `payroll.py:20,30` |
| GET | `/staff-payroll` | `payroll.py:41` |
| POST | `/staff-payroll/process` | `payroll.py:52` |
| PUT | `/staff-payroll/{record_id}` | `payroll.py:63` |
| POST | `/staff-payroll/{record_id}/adjustments` | `payroll.py:75` |
| POST | `/setup/create-super-admin` | `system.py:47` |
| GET | `/system/hotels/{id}/go-live` | `system.py:71` |
| GET | `/modules` | `system.py:98` |
| GET | `/system/health` | `system.py:109` |
| POST | `/auth/login` | `users.py:33` — *intentionally public* |

Severity:
- **`payroll.py` is the only router with zero guards on all 6 endpoints** — salary structures, payroll runs and adjustments are fully open.
- **`POST /biometric/pull-device-sync`** accepts caller-supplied `device_ip`/`device_port` and makes the **server open a TCP connection** to it → SSRF-shaped.
- **`POST /setup/create-super-admin`** is a self-service super-admin bootstrap, mitigated only by a "already exists" check (`system_service.py:35-37`). It is safe on the populated DB, but it is a bootstrap hole on an empty one.

These are **pre-existing**, not regressions — `payroll.py` and `extra_charges.py` had no `get_current_user` at `HEAD` either.

### 🔴 C. A guard bypass on room status

`/rooms/{room_id}/status` is served by **two different routers with different services and different methods**:

- `PUT` → `housekeeping.py:136` → `HousekeepingService.update_room_status`, guarded only by `get_current_user`
- `PATCH` → `rooms.py:67` → `RoomService.update_room_status`, guarded by `require_hotel_admin_or_manager`

So any authenticated user (e.g. `front-desk`, `housekeeping`) can change room status via `PUT` and **bypass the `require_hotel_admin_or_manager` guard** the `PATCH` enforces. This is the highest-value authorization defect in the codebase.

### 🟠 D. Dead code from silent route shadowing

Registration order in `main.py:221-249` decides the winner:

| Shadowed (dead) | Winner | Impact |
|---|---|---|
| `hotels.py:51` `PUT /hotels/{id}` | `system.py:82` | Callers get `SystemService` semantics and a `{"message":...}` dict instead of `HotelResponse` |
| `assets.py:29` `GET /maintenance-assets/` | `maintenance.py:898` | Returns a hand-built 6-key dict instead of the declared full schema |
| `staff.py:43` `GET /staff/unassigned-users` | `users.py:104` | Duplicate; also raised the FastAPI duplicate-operation-ID warning |

### 🟠 E. Three orphaned/landmine artifacts

1. **`dependencies.py:208-242`** — `require_department_access`'s inner `dependency()` references `dept_lower`, `user_dept` and `allowed_modules`, **none of which are defined or in scope** (confirmed by AST analysis). The `super-admin`/`hotel-admin` short-circuit at `:209` returns before those lines, so it would only 500 for a non-admin — but since **no router calls it**, the bug is currently latent, not live. Verified `require_role_level` itself is correct.
2. **`maintenance.py`** — 9 handlers, all raw SQLAlchemy, **zero service imports**; `maintenance_service.py` is orphaned. It also hand-rolls the department-head check (`current_user.role_level != "department_head"` at `:691`, `:804`) instead of using the existing factory.
3. **`housekeeping.py`** — 13 of 16 handlers query the DB directly instead of via `HousekeepingService`.

### 🟠 F. No migration system — schema is patched at import time

`main.py:9-150` runs six `_ensure_*_columns()` functions on every boot that issue raw `ALTER TABLE ... ADD COLUMN` against SQLite, each wrapped in `try/except` that **silently swallows failures** (`main.py:33-34, 52-53, 132-133, 147-148`). A failed migration is invisible.

Two additional one-off scripts exist:
- `backend/sync_inventory_columns.py` — introspects `InventoryItem` and adds any missing columns via raw SQL.
- `fix_hk_dashboard.py` (repo root, 17 KB) — **textually rewrites `HousekeepingDashboard.jsx`** with literal string `.replace()` calls and a regex to delete a `<td>` column block. A frontend edit performed by a throwaway Python script.

This is why the root DB (62 tables) and backend DB (66 tables) have drifted apart, and why the backend DB contains **both** `extra_service_catalog` and `extra_services_catalog`.

### 🟡 G. Money is `float` everywhere

Every monetary column is `Float` — `Invoice.grand_total`, `Payment.amount`, `FolioCharge.tax_amount`, `StaffSalary.net_pay`, `InventoryItem.average_cost`, etc. GST is recomputed in `booking_service.py:140-142`:

```python
gst_rate = 5.0 if nightly_unit_rate <= 7500 else 18.0
taxable_amt = round(total_rate / (1.0 + (gst_rate / 100.0)), 2)
tax_amt = round(total_rate - taxable_amt, 2)
```

Rounding drift will accumulate across folio → invoice → payment allocation. There is no `Decimal` or integer-minor-unit representation anywhere.

### 🟡 H. Frontend: 70k lines, no service layer, no state manager

- **116 JS/JSX files, 69,784 lines.** Largest: `CheckInOutPage.jsx` **3,919 lines**, `BookingsPage.jsx` 2,881, `HousekeepingDashboard.jsx` 2,242, `InvoicesPage.jsx` 2,181, `MaintenanceAdminPage.jsx` 1,995, `AddRoomPage.jsx` 1,928, `ExtraChargesPage.jsx` 1,928, `GuestsPage.jsx` 1,804.
- Every API call is inline `api.get(...)`/`api.post(...)` inside components — **no hooks layer, no query library, no central endpoint map**. Zero direct `fetch()` (good) but also zero caching/deduplication.
- **Only global state is `AuthContext`.** Everything else is `useState`/`useEffect` prop-drilling.
- `api.js` has a request interceptor for the JWT but **no response interceptor** — so a `401` mid-session never triggers logout or re-auth; the user just sees a broken page.
- API base URL: `.env.local` → `http://localhost:8000` (dev works); `.env.production` is **empty**, so production silently falls back to the hardcoded `https://api.aerostatelab.com` in `api.js:4`.
- **36 `alert()` calls** for user feedback; no toast system. 0 TODO/FIXME markers (so debt is undocumented, not absent).
- `vite.config.js` defines `@`, `@components`, `@modules`, `@api`, `@context` aliases — used 166 times, but `eslint.config.js` is not configured to resolve them, and mixing alias and relative imports is inconsistent.

### 🟡 I. Unbounded queries

**`inventory.py` is the only router with pagination** (14 endpoints, `page`/`page_size`, `le=200`). Every other list endpoint returns an unbounded `List[...]` — including `inventory.py`'s own `/items`, `/stores`, `/suppliers`, `/categories`, `/units`, `/stock-transactions`. Limit conventions are inconsistent three ways: `Query(50, ge=1, le=200)`, `Query(100)` unbounded, `Query(10)` unbounded.

### 🟡 J. Contract inconsistencies

- **Trailing slashes:** three conventions coexist — collection as `"/"`, as `""`, and both. `GET /tasks/` and `GET /guests` both 307-redirect.
- **Response shapes:** declared `response_model` vs bare `Dict[str, Any]` vs hand-built ad-hoc dicts. `DELETE` handlers annotate `-> Dict[str, str]` but return whatever the service returns.
- **Datetime encoding:** `maintenance.py` returns raw `datetime` in one endpoint and `.isoformat()` in another; `housekeeping.py` invents `_to_utc_iso()` appending a literal `"Z"` to naive `utcnow()` values.
- **Payload placement:** `accounts.py:38` and `payments.py:68` take write parameters as `Query` args while the rest of the codebase uses Pydantic bodies.
- **Validation bypass:** `housekeeping.py:394` and `maintenance.py:587` accept raw `Dict[str, Any]` with `data.get(...)` / `setattr` updates — the only two endpoints with no request validation.
- **Architecture drift:** two parallel payroll vocabularies (`/staff-payroll` + `/staff-salary-structures` in `payroll_service` vs `/staff-salaries` in `staff_service`); `restaurant.py:214` duplicates `bookings.py:100`.

### 🟡 K. Auth error semantics

`bearer_scheme = HTTPBearer()` (`dependencies.py:18`, no `auto_error=False`) returns **403 when the `Authorization` header is entirely missing**, while `get_current_user` raises **401 for a bad token** and **403 for an inactive user**. Clients cannot distinguish "not logged in" from "wrong role" — which is precisely what a good response interceptor would need.

### 🟠 M. Business-logic layer: 30 services, ~14,200 lines

The service layer is where the real domain logic lives, and it is substantive — but unevenly factored.

**God services.** `inventory_service.py` is **2,346 lines with 54 public methods** covering physical counts, adjustments, wastage, department returns, supplier returns, transfers, issues, consumption, GRN receiving, a stock-movement engine, and master data (stores/suppliers/categories/units/items). `booking_service.py` is 1,175 lines and mixes availability search, stay-cycle math, folio provisioning, GST, room-status transitions, housekeeping-task creation, and invoice generation.

**Two services have no repository at all:** `task_service.py` (889 lines) and `ticket_service.py` (380 lines) query `models.*` directly — the only services that break the pattern.

**Authorization is duplicated per service, not shared.** Every service re-implements its own `_assert_owns_hotel` / `_assert_can_manage` / `_assert_can_delete` (254 call sites across 14 services — e.g. `guest_service.py:31`, `booking_service.py:70`, `inventory_service.py:60`). There is no base class or mixin. Tenant isolation therefore works, but only because every service remembers to call it.

**Money/rounding is inconsistent across modules** — the same GST concept is implemented at least four different ways:

| Location | Rate | Base |
|---|---|---|
| `booking_service.py:140-142` | **5% if unit ≤ 7500, else 18%** | tax-**inclusive** (extracted) |
| `invoice_service.py:351-352` | **12% if unit ≤ 7500, else 18%** | tax-inclusive |
| `booking_service.py:194,210` (extras) | hardcoded **18%** | — |
| `procurement_service.py:271-276` | caller `tax_percent` | tax-**exclusive** (added) |
| `restaurant_service.py:329-335, 515-521` | menu `tax_percent`, default 5.0 | tax-inclusive |

So the same room can be taxed at 5% by the folio engine and 12% by the invoice engine. `create_invoice` (`invoice_service.py:669-677`) even uses the **opposite** total model (`+ tax`) from `generate_invoice_for_booking` (`:609-637`, inclusive) — two invoice paths that compute totals differently.

**Silent financial leakage:**
- `expense_service.py` accepts `payment_status="partial"`, but `report_service.py:277-282` only classifies `paid`/`pending`/`cancelled` — **partial expenses vanish from report totals**.
- `payroll_service.py:136` credits a hardcoded **4.0 off-days per month** when simulating leave/LOP.
- `minibar_service.py` and `laundry_service.py` compute `total_amount = quantity × price` with **no tax and no inventory depletion** — minibar consumption never reduces stock.

**Global side effects:** `extra_charge_service.py:33,42` runs `models.Base.metadata.create_all(bind=engine)` on catalog read/write, and `:15-25` resolves the hotel via a fallback chain ending in a **hardcoded hotel id `1`**. `announcement_service.py:35` deactivates *all* existing announcements globally (not per-hotel) before inserting.

**Hardcoded integrations:** `biometric_service.py:27-28` defaults to device IP `192.168.137.50` port `5005`; the `pyzk` dependency is optional and raises a 500 if absent. A `zk`/`pyzk` device library is **not in `requirements.txt`**.

**Transaction discipline is weak:** money-writing paths (`invoice_service`, `payment_service`, `staff_service`, `booking_service`) do not use explicit transactions or rollback — only 2 of 30 services call `rollback()` (`biometric_service`, `payroll_service`). A mid-operation failure can leave partial writes.

### 🔴 N. Three concrete cross-tenant / missing-authorization holes

1. **`ticket_service.py:170`** — `get_ticket_by_id` calls `_resolve_hotel_id(ticket.hotel_id, current_user)`, but that helper returns `current_user.hotel_id` unconditionally and **never compares it to the ticket's hotel**. Any authenticated user can read any ticket in any hotel by id. (`task_service.py:219` does the comparison correctly — so the bug is a copy-paste omission, not a design choice.)
2. **`extra_charge_service.py:150-192`** — `get_extra_charge` / `update_extra_charge` / `delete_extra_charge` have **no role check and no hotel check** (create does, at `:98-103`). Combined with the fact that the three corresponding router endpoints are also unauthenticated, charges can be read/changed/deleted entirely anonymously.
3. **`hotel_service.py:53-62`** — `update_hotel_modules` performs **no authorization check at all**. It is currently shielded only because `hotels.py:71` happens to wrap it in `require_super_admin`; the service itself is unguarded, so any future caller inherits the hole.

Additionally, module gating is done by **substring matching** on `allowed_modules` in seven near-identical helpers (`inventory_service.py:41-50`, `procurement_service.py:37-46`, `work_order_service.py:42-51`, `maintenance_service.py:67-76`, `preventive_maintenance_service.py:40-49`, `asset_service.py:34-43`, `housekeeping_service.py:69-78`) — any user whose module list contains `"all"` passes every gate. `task_service.py:37` similarly uses `department in user_dept or user_dept in department`, so a department name that is a substring of another (e.g. `"bar"` in `"bar-store"`) grants cross-department access.

### 🔴 O. Stock balances are mutated outside the ledger

`InventoryService.execute_stock_movement` is the one correct path: it mutates balances **and always writes an `InventoryStockLedger` row** (`inventory_service.py:1638-1716`). Three other paths bypass it:

| Path | File | Consequence |
|---|---|---|
| Work-order parts issue | `work_order_repository.py:149` | No ledger row, no `InventoryLocationStock` update, no `average_cost` recost → store-level and item-level stock diverge permanently |
| PO receiving | `procurement_repository.py:207-227` | Same, plus **weighted-average recosting is skipped entirely** (the GRN path does it properly at `inventory_service.py:1631-1644`) |
| `transfer_stock` | `inventory_service.py:961-1006` | Mutates location stock directly; writes ledger rows but deliberately does not touch `item.current_stock` |

Two repository methods that adjust balances with no ledger (`inventory_repository.py:1300-1320`, `:1613-1624`) are **dead code — no caller exists**. Meanwhile minibar (`minibar_service.py:117-133`), restaurant (`restaurant_service.py:375`) and laundry (`laundry_service.py:126-143`) **never deplete stock at all**. Readers such as `report_service.py:548` (low stock) and the availability checks in `inventory_service.py:288,444,752,920,1114,1271` all trust `current_stock`, so the divergence propagates.

### 🟠 P. Non-atomic workflows — rollback in only 2 of 30 services

`db.commit()` is called inside **both** services and repositories, so a single logical operation commits many times:

- `restaurant_service.create_restaurant_order` → `create_order_with_items` commit + `upsert_folio_charge_for_order` commit
- `preventive_maintenance_service.generate_due_work_orders` → **3 commits per plan** (`:256`, `:274`, `:279`)
- `inventory_service.receive_goods` → one commit **per GRN line** (`:1427-1497`); likewise `issue_stock` (`:1139-1168`), `transfer_stock` (`:1009`), `finalize_physical_count` (`:170-180`)

Only `biometric_service` and `payroll_service` ever call `rollback()`. There is no `begin_nested`, no unit-of-work per API call. Combined with `payment_service.py:555-564` — which mutates `booking.total_amount`/`nights_count`/`checkout_date` **before** the `require_full_payment_before_checkout` guard raises — a failed checkout leaves the session dirty.

### 🟠 Q. Silent failures hide money

`booking_service.py:481-482, 624-625, 871-872` swallow exceptions with `print` when creating an advance-payment voucher — but `advance_paid` has already been zeroed at `:461`/`:591`. **Money collected becomes invisible to the folio.** The same bare-`except: print` pattern appears in `task_service.py:70-71`, `staff_service.py:690-691`, `room_service.py:181-182`, `payroll_service.py:67,280`.

Related: `invoice_service.py:458` and `booking_service.py:125` compute `effective_paid = max(net_payments, invoice_paid, booking_advance)` — taking the **max of three independently-maintained aggregates** masks under-collection whenever one is stale.

### 🟠 R. Additional correctness bugs worth fixing

- **`user_service.py:148-156`** — `staff` is bound only inside `if user.staff_id:`, then dereferenced at `:156` → `UnboundLocalError` on login for a user with no `staff_id` and no `full_name`. (The correct guard already exists 40 lines below at `:200`.)
- **`work_order_service.py:250-252`** — `parent_request.actual_cost += total_cost` fires on *every* transition into `completed|verified|closed`, **triple-counting** the cost across the lifecycle.
- **`report_service.py:402-404`** — `getattr(inv,"cgst",0.0) or (tax/2)` treats a genuine `cgst == 0.0` (an IGST invoice) as falsy, inventing CGST/SGST and double-counting tax at `:446`.
- **`inventory_service.py:106-108`** (and the same pattern at `:267, 423, 576, 728, 898, 1092, 1250, 1402`) — `self.repo.get_store_by_id(...).hotel_id` raises `AttributeError` instead of a 404 when the store id is invalid.
- **`inventory_service.py:1814-1819`** — `"adjust"` maps unconditionally to `ADJUSTMENT_OUT`, so the legacy `create_stock_transaction` can only ever *decrease* stock; it also double-books (ledger row + a separate `StockTransaction`).
- **`housekeeping_service.py:487-492`** — missing `None` guard on `get_room_in_hotel` → `AttributeError` (the sibling `inspect_task` guards it at `:378`).
- **`restaurant_service.py:487-488`** — mass `setattr` of every supplied field, then `total_amount = subtotal + tax − discount` at `:564`; since `subtotal`/`tax_amount` can come straight from the payload with no item lines, **a caller can manipulate the bill**. The same mass-assignment pattern exists at `task_service.py:240-241`, `ticket_service.py:179-205`, `extra_charge_service.py:175-176`.
- **Two contradictory salary formulas:** `staff_service.py:479` (`net = basic + allowances − deductions`) vs `payroll_service.py:232-250` (`net = gross − (epf + esi + LOP)`). Both write different tables and both auto-create a "Salaries" `Expense` (also `staff_service.py:498-510, 617-637`, deduped by exact title string — and PayrollService uses `"Paid"` while StaffService uses `"paid"`).
- **`accounts_service.py:118-127`** — marks linked advances `"recovered"` without ever deducting them from `net_salary` and without creating an `Expense`, unlike every other salary path.
- **`room_service.py:157-179`** — a **GET** writes computed statuses onto ORM `Room` instances and never commits; any later flush in the same session persists them.
- **`biometric_service.py:41-63`** — `disable_device()` is called but `enable_device()` only on the success path, so a mid-read exception leaves the physical reader disabled.
- **`task_service.py:513-514`** — `completed_today` and `completed_total` are both computed as `sum(status == "completed")` for admins.
- **`preventive_maintenance_service.py:267`** — dead ternary: `"assigned" if plan.assigned_staff_id else "assigned"`.
- **`task_service.py:95-101`** — task-number clash check omits `hotel_id`; the count-based sequence reuses numbers after deletion, and the timestamp fallback breaks the suffix-parse used by `task_service.py:338` and `ticket_service.py:262` (`split("-")[-1]`).
- **Invoice numbering** uses epoch seconds with **no uniqueness check** in four places (`booking_service.py:1148`, `invoice_service.py:582, 686`, `payment_service.py:579`).

### 🟡 S. No SLA, no depreciation

Despite `MaintenanceAsset` carrying purchase data and `DepartmentTask` carrying priorities and due dates, there is **no depreciation/amortisation logic anywhere** and **no SLA/timer/escalation engine** in any service — the closest analogues are status timestamp stamps and `preventive_maintenance_service.calculate_next_due_date`. A stale comment at `task_service.py:480-484` advertises priority ordering that the query does not implement.

### 🟢 L. What is genuinely good

- The **router → service → repository** split is real and respected across most modules.
- **Multi-tenant scoping is correctly enforced in the service layer** — e.g. `GuestService._assert_owns_hotel` (`guest_service.py:31-33`) is called on every `get`/`update`/`delete`, so lean repositories like `get_by_id(guest_id)` without a `hotel_id` filter are safe *by convention*. The risk is that the convention is enforced only by discipline.
- `booking_service.py` implements a real **folio engine** (auto-provisioning a `Folio` on check-in, syncing accommodation + extra charges as `FolioCharge` rows, reversing rather than deleting) and a proper **invoice payment allocation** model.
- Inventory has a genuine **stock ledger** (`InventoryStockLedger`) with `balance_after` and `movement_type`.
- The RBAC config and `AccessDeniedView` are well-designed — they just need a server-side twin.
- **Zero TODO/FIXME/HACK comments and no direct `fetch()`** — the code is tidier than its size suggests.

---

## 5. Recommended work order

**Phase 0 — establish a baseline (do this first)**
1. Decide which database is authoritative and delete the other two; `backend/hotel_erp.db` holds the real data.
2. Commit or stash the in-progress rewrite so we have a clean rollback point. ~13k lines of uncommitted change is the single biggest risk to any further editing.
3. Add Alembic and replace the six `_ensure_*_columns()` import-time hacks; stop swallowing migration errors.
4. Add pytest + a smoke test that boots the app and asserts the endpoint count, so route regressions are caught.

**Phase 1 — security (small, high value)**
5. Add `Depends(get_current_user)` to the 20 unauthenticated endpoints; give `payroll.py` and `accounts.py` role guards.
6. Fix the `PUT`/`PATCH /rooms/{id}/status` guard bypass — pick one router and one service.
7. Fix or delete `require_department_access`; wire `require_role_level` into `maintenance.py`'s hand-rolled checks.
8. Gate `/setup/create-super-admin` behind a one-time bootstrap flag or environment secret.
9. Constrain `/biometric/pull-device-sync` to an allowlist of device addresses.
10. Add a response interceptor in `api.js` that logs out on 401.

**Phase 2 — correctness**
11. Move money to `Decimal`/integer minor units; extract one shared GST computation.
12. Resolve the three shadowed routes and the duplicate `/staff/unassigned-users`.
13. Add pagination consistently; standardise trailing slashes, response models and datetime encoding.
14. Validate the two raw-`Dict` endpoints properly.

**Phase 3 — frontend health**
15. Break up the >1,500-line pages; extract a `hooks/` layer for data fetching and a `services/` endpoint map.
16. Replace the 36 `alert()` calls with one notification system.
17. Fix `.env.production`; add error boundaries and loading states.

---

## 6. Open questions

1. **Which DB is authoritative** — `backend/hotel_erp.db` (real data) or the root `hotel_erp.db`? Should the other be deleted?
2. **Is the in-progress rewrite meant to be finished**, or should it be reverted to `HEAD` first?
3. **Is `maintenance.py`'s raw-SQL approach deliberate** (performance/legacy) or unfinished migration to the service layer?
4. **Is the app single-hotel in practice?** Only 1 hotel row exists, but 65 entities all carry `hotel_id` and super-admin onboarding exists — so multi-tenant is the design intent. This determines how hard to push on server-side tenant enforcement.
5. **What is the deployment target?** The hardcoded `https://api.aerostatelab.com` fallback suggests one shared production host — relevant to the CORS `allow_origins=["*"]` + `allow_credentials=True` combination in `main.py:193-199`, which browsers reject and which is unsafe.
