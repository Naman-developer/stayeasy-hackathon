# Final Testing Checklist (Phase 4)

## Setup
- [ ] `backend/.env` configured
- [ ] MongoDB running / Atlas connected
- [ ] `npm install` completed in `backend/`
- [ ] `npm run seed` executed
- [ ] Backend started on expected port
- [ ] Frontend opened via local server

## Auth & Role
- [ ] Signup works
- [ ] Login works (email/phone)
- [ ] Role-based redirect works for each role
- [ ] Logout clears session and redirects

## Property Marketplace
- [ ] Owner can add property
- [ ] New property defaults to `pending`
- [ ] Owner can edit/delete own listing
- [ ] Admin sees pending listing
- [ ] Admin approve/reject updates status
- [ ] Approved listing appears in public search only

## Search & Details
- [ ] Search filters city/type/price work
- [ ] Search debounce works
- [ ] Search suggestions appear and can be selected
- [ ] Property details page loads correctly

## Booking & Payment
- [ ] Booking can be created
- [ ] Mock payment completes
- [ ] Booking becomes `confirmed` and `paid`
- [ ] Payment success UI shown

## Notifications
- [ ] Notification bell appears on dashboard pages
- [ ] New notifications load
- [ ] Mark single notification read works
- [ ] Mark all read works

## Worker + Hostel + Parent + SOS
- [ ] Worker search and booking flow works
- [ ] Hostel attendance/mess/outpass actions work
- [ ] Parent view and outpass approval works
- [ ] Student SOS sends API request with location

## Admin Dashboard
- [ ] KPI cards load
- [ ] Revenue chart loads
- [ ] Pending approvals action buttons work
- [ ] Recent activity section loads

## UI/UX Polish
- [ ] Responsive layout on mobile and laptop
- [ ] Loading states visible where needed
- [ ] Empty states visible (no data scenarios)
- [ ] Toast messages show success/error feedback
