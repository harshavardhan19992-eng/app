# PawGroom India — Product Requirements

## Original problem statement
Build a website and app for booking grooming services at home in India, with good design, admin & customer logins, records & invoices history, location and prices for grooming (types of grooming).

## User choices (locked)
- Focus: **Pet grooming** (dogs + cats)
- Customer auth: **Emergent-managed Google OAuth**
- Admin auth: **Email + password (JWT)**
- Payment: **Cash on service** and **direct UPI** (GPay/PhonePe/Paytm via UPI ID + txn reference). Razorpay deferred.
- Pricing: **City-based** across 8 Indian metros
- Invoices: **Downloadable PDF**

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`), MongoDB (motor), Emergent OAuth via httpx call to `demobackend.emergentagent.com`, PyJWT for admin, bcrypt for admin password, ReportLab for PDF invoices.
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + Sonner. Design system: Cormorant Garamond (display) + Outfit (body), colors #1E3F2D primary / #D96C4A accent / #FDFBF7 bg.

## Personas
- **Pet parent (customer)** — signs in with Google, books at-home grooming, downloads invoices.
- **PawGroom admin** — signs in with email/password, manages bookings, services and revenue.

## Core requirements (static)
1. Landing marketing page with services, cities, how-it-works, testimonial, CTAs.
2. Customer Google login → dashboard with upcoming and past bookings + PDF invoices.
3. Booking wizard: city + pet → services (city-tuned prices) → date + time + address → payment (cash / UPI).
4. Admin portal: dashboard stats, bookings management with status transitions, services CRUD, active toggle.
5. Backend endpoints prefixed with `/api`, session cookie for customer, Bearer JWT for admin.

## Implemented (2026-07-01)
- Backend: 20+ endpoints, seeded admin + 8 services, 8 cities catalog, PDF invoice with GST 18%.
- Frontend: 8 pages (Landing, CustomerLogin, AuthCallback, CustomerDashboard, BookNow, AdminLogin, AdminShell, AdminDashboard, AdminBookings, AdminServices) + Navbar/Footer + AuthContext.
- Booking flow with 4-step wizard, city multiplier, GST, UPI payment.
- PDF invoice downloadable from customer dashboard.
- 31/31 backend tests passing.

## Prioritised backlog
- **P1**: Razorpay integration (order+capture flow) once keys are provided.
- **P1**: Booking detail page + reschedule/cancel by customer.
- **P2**: Email/WhatsApp notifications on booking + status change (Resend/Twilio).
- **P2**: Groomer accounts and assignment inside admin.
- **P2**: Reviews & ratings after completion.
- **P2**: Loyalty/promo codes.
- **P3**: FastAPI lifespan migration, TTL index on user_sessions, admin login rate limiting.

## Next tasks
1. Ship Razorpay integration when keys arrive.
2. Add booking cancel/reschedule + confirmation email.
3. Add reviews & referrals for word-of-mouth growth.
