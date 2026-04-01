# StayEasy Portal Features (Brief Guide)

## 1. Platform Overview
StayEasy is a multi-role platform for:
- accommodation discovery and booking,
- hostel operations and student safety,
- helper/worker marketplace,
- parent monitoring,
- admin governance.

All major pages use role-based authentication and role-based dashboard routing.

---

## 2. Role-to-Portal Mapping
After login, users are redirected by role:
- `student` -> Student Dashboard
- `tenant` -> Tenant Dashboard
- `owner` / `flat_owner` / `pg_owner` -> Owner Dashboard
- `hostel_owner` -> Hostel Dashboard
- `parent` -> Parent Dashboard
- `worker` -> Worker Dashboard
- `admin` -> Admin Dashboard

---

## 3. Shared Features Across Portals
- JWT login session with role verification.
- Sidebar with quick access and role-specific portal link.
- Top header with user identity and role badge.
- Notifications bell (`Alerts`) with mark-read actions.
- Toast messages for user feedback.
- Floating AI chatbot (bottom-right) for guidance, search help, and complaint context.

---

## 4. Public / Common Pages

### Front Page (`index.html`)
- Hero, category search, featured listings.
- Quick location/type/budget filters.
- Role-aware navbar (shows user + portal when logged in).

### Search Listings (`search-results.html`)
- Public approved-property listing search.
- Filters: city, locality, type, min/max price, preferences.
- City suggestion dropdown.
- AI recommendation panel (requires login for personalized output).

### Property Details (`property-details.html`)
- Gallery, amenities, owner info, description, reviews.
- Direct `Book Now` flow.

### Booking & Payment (`booking.html`)
- Booking creation (dates + amount).
- Payment options:
  - UPI QR + UTR confirmation,
  - Card,
  - Net banking,
  - Wallet.
- Supports Razorpay (if configured) or mock fallback flow.

### Helpers Marketplace (`worker.html`)
- Search workers by city and service type.
- Book selected worker with date/time/amount.

### Auth Pages (`login.html`, `signup.html`)
- Signup with role-specific fields.
- Login by email/phone/student ID.
- Auto redirect to role dashboard.

---

## 5. Student Portal
Purpose: student safety + hostel life + booking visibility.

Main capabilities:
- Student ID display (`STUxxxx` style code when available).
- KPI cards:
  - attendance logs,
  - pending outpass,
  - property bookings,
  - open complaints.
- SOS emergency trigger with location capture.
- AI property recommendations.
- Mess schedule view.
- Outpass request submission + status tracking.
- Attendance log history.
- Property booking history.
- Complaint creation + complaint status/response tracking.

---

## 6. Tenant Portal
Purpose: complete tenant journey in one dashboard.

Main capabilities:
- KPI cards:
  - property bookings,
  - active stays,
  - helper bookings,
  - open complaints,
  - total spending.
- Quick actions for listing and helper flows.
- Property booking table with view/cancel actions.
- Helper booking table with cancel actions.
- Complaint module:
  - raise complaint,
  - optional property linkage,
  - track status and admin/owner responses.
- AI recommendation module with filters (city/type/budget/preferences).

---

## 7. Owner Portal
Purpose: listing lifecycle + booking revenue monitoring.

Main capabilities:
- KPI cards:
  - total listings,
  - approved/pending listings,
  - paid earnings,
  - booking count.
- Add/edit/delete listings.
- Upload listing images (URLs + local image upload support).
- Track owner bookings and payment status.
- Listing moderation visibility (pending/approved/rejected).
- AI rent suggestion tool (city/locality/type/occupancy/amenities based).
- Tenant trust score section for risk-aware decisions.

---

## 8. Hostel Portal
Purpose: hostel operations and student records.

Main capabilities:
- KPI cards:
  - total students,
  - present/absent counts,
  - pending outpass.
- View own hostel/PG listings.
- Add student to hostel using student code/ID.
- Mark attendance (present/absent/late + notes).
- Manage mess schedule and weekly menu.
- View student roster with room/fee status.
- Approve/reject outpass requests.

---

## 9. Parent Portal
Purpose: child monitoring and outpass approval.

Main capabilities:
- Lookup child via student ID/code/email/phone.
- Child profile summary (hostel/property/room details).
- Attendance records table.
- Mess schedule visibility.
- Outpass request table with parent approve/reject actions.
- KPI cards:
  - attendance record count,
  - pending outpass,
  - approved outpass.

---

## 10. Worker Portal
Purpose: worker profile and job operations.

Main capabilities:
- Worker profile setup/update:
  - service type,
  - city,
  - charges,
  - availability.
- KPI cards:
  - total jobs,
  - completed jobs,
  - confirmed jobs,
  - total earnings.
- Booking management table:
  - view assigned jobs,
  - complete job,
  - cancel job.
- Profile status indicators:
  - verification,
  - rating,
  - availability.

---

## 11. Admin Portal
Purpose: platform governance, moderation, analytics.

Main capabilities:
- KPI dashboard:
  - users, properties, bookings, revenue,
  - workers, hostel owners, hostel students, escalated complaints.
- Clickable KPI cards with deep detail tables and breakdowns.
- Monthly revenue chart.
- Pending property moderation:
  - approve/reject.
- Recent bookings snapshot.
- Escalated complaints table.
- All user complaints section:
  - status filter (all/open/in-progress/escalated/resolved),
  - complaint status counters,
  - complaint list across all user roles,
  - resolve action with admin response note.
- Recent activity feed.

---

## 12. Security + Access Notes
- Dashboards enforce allowed roles via `data-allowed-roles`.
- If role mismatch occurs, user is redirected to correct portal.
- Sidebar now shows only the logged-in user's portal link (role-isolated navigation).
- Public search only returns admin-approved properties.


