"""PawGroom backend integration tests.

Covers:
- Public: /, /cities, /services, /slots, /payment-info
- Admin auth + services CRUD + bookings + stats
- Customer auth (seeded session), bookings, invoice PDF, edge cases
"""
import os
import uuid
import io
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

# Load backend .env for MONGO_URL/DB_NAME to seed customer sessions
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback for CI: read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"email": "admin@pawgroom.in", "password": "Admin@123"})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def seeded_user():
    """Seed a customer user + valid session directly in Mongo."""
    user_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
    token = f"sess_TEST_{uuid.uuid4().hex}"
    db.users.insert_one({
        "user_id": user_id,
        "email": f"TEST_{user_id}@ex.com",
        "name": "Test User",
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield {"user_id": user_id, "token": token, "email": f"TEST_{user_id}@ex.com"}
    # cleanup
    db.user_sessions.delete_many({"user_id": user_id})
    db.users.delete_many({"user_id": user_id})
    db.bookings.delete_many({"user_id": user_id})


@pytest.fixture(scope="session")
def user_headers(seeded_user):
    return {"Authorization": f"Bearer {seeded_user['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def second_user():
    user_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
    token = f"sess_TEST_{uuid.uuid4().hex}"
    db.users.insert_one({
        "user_id": user_id, "email": f"TEST_{user_id}@ex.com", "name": "Other",
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield {"user_id": user_id, "token": token}
    db.user_sessions.delete_many({"user_id": user_id})
    db.users.delete_many({"user_id": user_id})


# ---------- Public catalog ----------
class TestPublic:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("service") == "PawGroom API"

    def test_cities(self, s):
        r = s.get(f"{API}/cities")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 8
        slugs = {c["slug"] for c in data}
        assert {"mumbai", "delhi", "bangalore", "hyderabad", "chennai", "pune", "kolkata", "ahmedabad"} <= slugs

    def test_services_all(self, s):
        r = s.get(f"{API}/services")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 8  # at least seeded 8
        pet_types = {d["pet_type"] for d in data}
        assert "dog" in pet_types and "cat" in pet_types

    def test_services_city_multiplier(self, s):
        r_base = s.get(f"{API}/services", params={"pet_type": "dog"})
        r_mum = s.get(f"{API}/services", params={"city": "mumbai", "pet_type": "dog"})
        assert r_base.status_code == 200 and r_mum.status_code == 200
        base = {d["service_id"]: d for d in r_base.json()}
        for svc in r_mum.json():
            assert svc["pet_type"] == "dog"
            assert svc["city_multiplier"] == 1.20
            expected = round(base[svc["service_id"]]["base_price"] * 1.20)
            assert svc["price"] == expected

    def test_slots(self, s):
        r = s.get(f"{API}/slots")
        assert r.status_code == 200
        slots = r.json()
        assert slots == [f"{h:02d}:00" for h in range(10, 20)]

    def test_payment_info(self, s):
        r = s.get(f"{API}/payment-info")
        assert r.status_code == 200
        data = r.json()
        assert data["upi_id"] == "pawgroom@upi"
        assert data["payee_name"]


# ---------- Admin auth ----------
class TestAdminAuth:
    def test_login_success(self, s):
        r = s.post(f"{API}/admin/login", json={"email": "admin@pawgroom.in", "password": "Admin@123"})
        assert r.status_code == 200
        assert "token" in r.json()
        assert r.json()["email"] == "admin@pawgroom.in"

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/admin/login", json={"email": "admin@pawgroom.in", "password": "wrong"})
        assert r.status_code == 401

    def test_admin_me(self, s, admin_headers):
        r = s.get(f"{API}/admin/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_admin_me_no_token(self, s):
        r = s.get(f"{API}/admin/me")
        assert r.status_code == 401


# ---------- Admin services CRUD ----------
class TestAdminServices:
    def test_create_update_delete_service(self, s, admin_headers):
        # CREATE
        payload = {
            "name": "TEST_Service",
            "pet_type": "dog",
            "description": "test",
            "duration_minutes": 45,
            "base_price": 555,
            "image_url": None,
        }
        r = s.post(f"{API}/admin/services", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == "TEST_Service"
        assert created["active"] is True
        svc_id = created["service_id"]

        # UPDATE
        r = s.patch(f"{API}/admin/services/{svc_id}", json={"base_price": 666}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["base_price"] == 666

        # Verify visible in public list
        r = s.get(f"{API}/services")
        ids = {d["service_id"] for d in r.json()}
        assert svc_id in ids

        # DELETE (soft)
        r = s.delete(f"{API}/admin/services/{svc_id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True

        # After delete -> not in public list
        r = s.get(f"{API}/services")
        ids = {d["service_id"] for d in r.json()}
        assert svc_id not in ids

        # cleanup hard
        db.services.delete_one({"service_id": svc_id})

    def test_unauthorized_create(self, s):
        r = s.post(f"{API}/admin/services", json={
            "name": "x", "pet_type": "dog", "description": "d",
            "duration_minutes": 10, "base_price": 1
        })
        assert r.status_code == 401


# ---------- Customer auth (seeded session) ----------
class TestCustomerAuth:
    def test_auth_me_with_bearer(self, s, seeded_user, user_headers):
        r = s.get(f"{API}/auth/me", headers=user_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == seeded_user["user_id"]
        assert data["email"] == seeded_user["email"]

    def test_auth_me_invalid_token(self, s):
        r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer nope"})
        assert r.status_code == 401

    def test_auth_me_expired(self, s):
        user_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
        token = f"sess_TEST_{uuid.uuid4().hex}"
        db.users.insert_one({
            "user_id": user_id, "email": f"TEST_{user_id}@ex.com", "name": "Exp",
            "picture": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        db.user_sessions.insert_one({
            "user_id": user_id, "session_token": token,
            "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401
        db.user_sessions.delete_many({"user_id": user_id})
        db.users.delete_many({"user_id": user_id})

    def test_logout_deletes_session(self, s):
        # Create ephemeral session to logout
        user_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
        token = f"sess_TEST_{uuid.uuid4().hex}"
        db.users.insert_one({
            "user_id": user_id, "email": f"TEST_{user_id}@ex.com", "name": "L",
            "picture": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        db.user_sessions.insert_one({
            "user_id": user_id, "session_token": token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Backend logout only deletes session if cookie is present. Send as cookie.
        r = requests.post(f"{API}/auth/logout", cookies={"session_token": token})
        assert r.status_code == 200
        assert db.user_sessions.find_one({"session_token": token}) is None
        db.users.delete_many({"user_id": user_id})


# ---------- Bookings ----------
class TestBookings:
    @pytest.fixture(scope="class")
    def booking_id_holder(self):
        return {}

    def _valid_payload(self, city="mumbai"):
        return {
            "city": city,
            "pet_name": "Buddy",
            "pet_type": "dog",
            "address_line1": "123 Test St",
            "address_line2": "",
            "pincode": "400001",
            "phone": "9999999999",
            "slot_date": "2026-02-01",
            "slot_time": "10:00",
            "items": [{
                "service_id": "svc_test",
                "service_name": "Bath & Brush",
                "pet_type": "dog",
                "price": 1000,
                "qty": 2,
            }],
            "payment_mode": "cash",
            "upi_txn_ref": None,
            "notes": "",
        }

    def test_create_booking_cash(self, s, user_headers, seeded_user, booking_id_holder):
        r = s.post(f"{API}/bookings", json=self._valid_payload(), headers=user_headers)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["user_id"] == seeded_user["user_id"]
        assert b["subtotal"] == 2000
        assert b["gst"] == 360.0
        assert b["total"] == 2360.0
        assert b["payment_status"] == "pending"
        assert b["invoice_no"].startswith("INV-")
        booking_id_holder["id"] = b["booking_id"]

    def test_create_booking_upi_with_ref(self, s, user_headers):
        p = self._valid_payload()
        p["payment_mode"] = "upi"
        p["upi_txn_ref"] = "TXN1234567890"
        r = s.post(f"{API}/bookings", json=p, headers=user_headers)
        assert r.status_code == 200
        assert r.json()["payment_status"] == "paid"

    def test_create_booking_upi_without_ref(self, s, user_headers):
        p = self._valid_payload()
        p["payment_mode"] = "upi"
        p["upi_txn_ref"] = None
        r = s.post(f"{API}/bookings", json=p, headers=user_headers)
        assert r.status_code == 200
        assert r.json()["payment_status"] == "pending"

    def test_create_booking_unsupported_city(self, s, user_headers):
        p = self._valid_payload(city="atlantis")
        r = s.post(f"{API}/bookings", json=p, headers=user_headers)
        assert r.status_code == 400

    def test_create_booking_empty_items(self, s, user_headers):
        p = self._valid_payload()
        p["items"] = []
        r = s.post(f"{API}/bookings", json=p, headers=user_headers)
        assert r.status_code == 400

    def test_create_booking_unauth(self, s):
        r = s.post(f"{API}/bookings", json=self._valid_payload())
        assert r.status_code == 401

    def test_list_my_bookings(self, s, user_headers, seeded_user):
        r = s.get(f"{API}/bookings", headers=user_headers)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 1
        for d in docs:
            assert d["user_id"] == seeded_user["user_id"]

    def test_get_booking_by_id(self, s, user_headers, booking_id_holder):
        bid = booking_id_holder["id"]
        r = s.get(f"{API}/bookings/{bid}", headers=user_headers)
        assert r.status_code == 200
        assert r.json()["booking_id"] == bid

    def test_other_user_forbidden(self, s, second_user, booking_id_holder):
        bid = booking_id_holder["id"]
        r = s.get(f"{API}/bookings/{bid}",
                  headers={"Authorization": f"Bearer {second_user['token']}"})
        assert r.status_code == 403

    def test_invoice_pdf(self, s, user_headers, booking_id_holder):
        bid = booking_id_holder["id"]
        r = s.get(f"{API}/bookings/{bid}/invoice.pdf", headers=user_headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 1000
        assert r.content[:4] == b"%PDF"


# ---------- Admin bookings & stats ----------
class TestAdminBookings:
    def test_list_all(self, s, admin_headers):
        r = s.get(f"{API}/admin/bookings", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_status(self, s, admin_headers):
        r = s.get(f"{API}/admin/bookings", headers=admin_headers)
        bookings = r.json()
        if not bookings:
            pytest.skip("no bookings to update")
        bid = bookings[0]["booking_id"]
        r = s.patch(f"{API}/admin/bookings/{bid}/status",
                    json={"status": "confirmed"}, headers=admin_headers)
        assert r.status_code == 200

    def test_update_invalid_status(self, s, admin_headers):
        r = s.get(f"{API}/admin/bookings", headers=admin_headers)
        bookings = r.json()
        if not bookings:
            pytest.skip("no bookings to update")
        bid = bookings[0]["booking_id"]
        r = s.patch(f"{API}/admin/bookings/{bid}/status",
                    json={"status": "bogus"}, headers=admin_headers)
        assert r.status_code == 400

    def test_stats(self, s, admin_headers):
        r = s.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for key in ("total_bookings", "pending", "completed", "revenue", "total_users"):
            assert key in data

    def test_admin_bookings_unauth(self, s):
        r = s.get(f"{API}/admin/bookings")
        assert r.status_code == 401



# ---------- Health probe (Kubernetes liveness/readiness) ----------
# /health is a top-level FastAPI route (outside /api). K8s hits it via pod
# loopback (http://<pod>:8001/health), so we test it against the backend
# port directly rather than through the ingress (which only routes /api/*).
class TestHealth:
    """Kubernetes probe endpoint — must return 200 + {'status':'ok'} on backend port."""

    HEALTH_URL = "http://localhost:8001/health"

    def test_health_returns_200_ok(self, s):
        r = s.get(self.HEALTH_URL, timeout=5)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data == {"status": "ok"}, f"unexpected body: {data}"

    def test_health_is_json(self, s):
        r = s.get(self.HEALTH_URL, timeout=5)
        assert r.status_code == 200
        assert "application/json" in r.headers.get("content-type", "").lower()


# ---------- Referral endpoints (require customer session) ----------
class TestReferral:
    """/api/referral (my code + stats) and /api/referral/validate/{code}."""

    def test_referral_requires_auth(self, s):
        r = s.get(f"{API}/referral")
        assert r.status_code == 401

    def test_my_referral(self, s, user_headers, seeded_user):
        r = s.get(f"{API}/referral", headers=user_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # returns referral_code, referral_count, referral_credit_inr
        assert "referral_code" in data
        assert isinstance(data["referral_code"], str) and data["referral_code"].startswith("PG-")
        assert data.get("referral_count", 0) == 0
        assert data.get("referral_credit_inr", 0) == 0
        # persistence check: subsequent call returns same code
        r2 = s.get(f"{API}/referral", headers=user_headers)
        assert r2.json()["referral_code"] == data["referral_code"]

    def test_validate_referral_valid_other_user_code(self, s, second_user):
        # Seed a brand-new user (no bookings yet) — referral is only valid on
        # the *first* booking, so we can't reuse seeded_user which has bookings.
        fresh_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
        fresh_token = f"sess_TEST_{uuid.uuid4().hex}"
        db.users.insert_one({
            "user_id": fresh_id, "email": f"TEST_{fresh_id}@ex.com", "name": "Fresh",
            "picture": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        db.user_sessions.insert_one({
            "user_id": fresh_id, "session_token": fresh_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        fresh_headers = {"Authorization": f"Bearer {fresh_token}", "Content-Type": "application/json"}
        try:
            # get second user's referral code first
            second_headers = {"Authorization": f"Bearer {second_user['token']}", "Content-Type": "application/json"}
            r_other = s.get(f"{API}/referral", headers=second_headers)
            assert r_other.status_code == 200
            other_code = r_other.json()["referral_code"]

            # validate as fresh user (no bookings yet) — should be valid
            r = s.get(f"{API}/referral/validate/{other_code}", headers=fresh_headers)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("valid") is True, f"expected valid True, got: {data}"
        finally:
            db.user_sessions.delete_many({"user_id": fresh_id})
            db.users.delete_many({"user_id": fresh_id})
            db.bookings.delete_many({"user_id": fresh_id})

    def test_validate_referral_own_code_invalid(self, s, user_headers):
        r = s.get(f"{API}/referral", headers=user_headers)
        my_code = r.json()["referral_code"]
        r2 = s.get(f"{API}/referral/validate/{my_code}", headers=user_headers)
        # own code should not be valid — either 400 or {"valid": False}
        if r2.status_code == 200:
            assert r2.json().get("valid") is False
        else:
            assert r2.status_code in (400, 403)

    def test_validate_referral_bad_code(self, s, user_headers):
        r = s.get(f"{API}/referral/validate/PG-DOESNOTEXIST", headers=user_headers)
        if r.status_code == 200:
            assert r.json().get("valid") is False
        else:
            assert r.status_code in (400, 404)



# ---------- New iteration 2 tests ----------
# Profile endpoints, admin settings, admin customers, admin password change,
# dynamic GST from settings, booking auto-persisting phone/address to profile.

class TestProfile:
    """/api/profile GET/PATCH - requires auth, updates persist."""

    def test_get_profile_unauth(self, s):
        r = s.get(f"{API}/profile")
        assert r.status_code == 401

    def test_patch_profile_unauth(self, s):
        r = s.patch(f"{API}/profile", json={"phone": "1234567890"})
        assert r.status_code == 401

    def test_get_profile_returns_defaults(self, s, user_headers, seeded_user):
        r = s.get(f"{API}/profile", headers=user_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == seeded_user["user_id"]
        assert data["email"] == seeded_user["email"]
        # phone/address fields may be null initially
        for k in ("phone", "default_address_line1", "default_pincode", "default_city"):
            assert k in data

    def test_patch_profile_persists(self, s, user_headers, seeded_user):
        payload = {
            "phone": "9123456789",
            "default_address_line1": "TEST 42 Address Rd",
            "default_pincode": "560001",
            "default_city": "bangalore",
        }
        r = s.patch(f"{API}/profile", json=payload, headers=user_headers)
        assert r.status_code == 200, r.text

        # GET to verify persistence
        g = s.get(f"{API}/profile", headers=user_headers)
        assert g.status_code == 200
        data = g.json()
        assert data["phone"] == "9123456789"
        assert data["default_address_line1"] == "TEST 42 Address Rd"
        assert data["default_pincode"] == "560001"
        assert data["default_city"] == "bangalore"


class TestBookingAutoPersistProfile:
    """POST /api/bookings should also update user profile phone/address."""

    def test_booking_updates_profile(self, s, seeded_user):
        # Fresh user so this test isn't affected by TestProfile ordering
        uid = f"user_TEST_{uuid.uuid4().hex[:8]}"
        tok = f"sess_TEST_{uuid.uuid4().hex}"
        db.users.insert_one({
            "user_id": uid, "email": f"TEST_{uid}@ex.com", "name": "AP",
            "picture": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        db.user_sessions.insert_one({
            "user_id": uid, "session_token": tok,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        try:
            payload = {
                "city": "delhi", "pet_name": "Rex", "pet_type": "dog",
                "address_line1": "TEST persisted addr", "address_line2": "",
                "pincode": "110001", "phone": "9887766554",
                "slot_date": "2026-03-01", "slot_time": "11:00",
                "items": [{"service_id": "svc_x", "service_name": "Bath",
                           "pet_type": "dog", "price": 800, "qty": 1}],
                "payment_mode": "cash", "upi_txn_ref": None, "notes": "",
            }
            r = s.post(f"{API}/bookings", json=payload, headers=h)
            assert r.status_code == 200, r.text

            # GET profile — should be auto-filled from booking
            g = s.get(f"{API}/profile", headers=h)
            assert g.status_code == 200
            p = g.json()
            assert p["phone"] == "9887766554"
            assert p["default_address_line1"] == "TEST persisted addr"
            assert p["default_pincode"] == "110001"
            assert p["default_city"] == "delhi"
        finally:
            db.user_sessions.delete_many({"user_id": uid})
            db.bookings.delete_many({"user_id": uid})
            db.users.delete_many({"user_id": uid})


class TestAdminSettings:
    """/api/admin/settings GET/PATCH and public /api/payment-info reflection."""

    def test_settings_requires_auth(self, s):
        assert s.get(f"{API}/admin/settings").status_code == 401
        assert s.patch(f"{API}/admin/settings", json={"gst_percent": 5}).status_code == 401

    def test_get_settings_returns_defaults(self, s, admin_headers):
        r = s.get(f"{API}/admin/settings", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "upi_id" in data and "upi_payee_name" in data and "gst_percent" in data

    def test_patch_settings_upserts_and_reflects_in_public(self, s, admin_headers):
        try:
            new_upi = "TEST_pawgroom@upi"
            new_payee = "TEST PawGroom Payee"
            r = s.patch(f"{API}/admin/settings",
                        json={"upi_id": new_upi, "upi_payee_name": new_payee},
                        headers=admin_headers)
            assert r.status_code == 200, r.text

            # Public payment-info reflects
            pub = s.get(f"{API}/payment-info").json()
            assert pub["upi_id"] == new_upi
            assert pub["payee_name"] == new_payee

            # Admin GET reflects too
            g = s.get(f"{API}/admin/settings", headers=admin_headers).json()
            assert g["upi_id"] == new_upi
            assert g["upi_payee_name"] == new_payee
        finally:
            # Restore defaults
            s.patch(f"{API}/admin/settings",
                    json={"upi_id": "pawgroom@upi",
                          "upi_payee_name": "PawGroom Services"},
                    headers=admin_headers)


class TestDynamicGst:
    """New bookings must use the current gst_percent from settings; existing snapshots preserved."""

    def test_dynamic_gst_applied(self, s, admin_headers, user_headers, seeded_user):
        # First set gst=5%
        r = s.patch(f"{API}/admin/settings", json={"gst_percent": 5},
                    headers=admin_headers)
        assert r.status_code == 200

        try:
            payload = {
                "city": "hyderabad", "pet_name": "Milo", "pet_type": "dog",
                "address_line1": "TEST gst", "address_line2": "",
                "pincode": "500001", "phone": "9000000001",
                "slot_date": "2026-04-01", "slot_time": "12:00",
                "items": [{"service_id": "svc_g", "service_name": "Nails",
                           "pet_type": "dog", "price": 1000, "qty": 1}],
                "payment_mode": "cash", "upi_txn_ref": None, "notes": "",
            }
            r = s.post(f"{API}/bookings", json=payload, headers=user_headers)
            assert r.status_code == 200, r.text
            b = r.json()
            # subtotal 1000, gst 5% = 50, total 1050
            assert b["subtotal"] == 1000
            assert b["gst_percent"] == 5.0 or b["gst_percent"] == 5
            assert b["gst"] == 50.0
            assert b["total"] == 1050.0
        finally:
            # Reset gst to 18
            s.patch(f"{API}/admin/settings", json={"gst_percent": 18},
                    headers=admin_headers)

    def test_gst_reset_new_booking_uses_18(self, s, admin_headers, user_headers):
        # Confirm gst is back to 18
        g = s.get(f"{API}/admin/settings", headers=admin_headers).json()
        assert float(g["gst_percent"]) == 18.0

        payload = {
            "city": "chennai", "pet_name": "Coco", "pet_type": "dog",
            "address_line1": "TEST gst2", "address_line2": "",
            "pincode": "600001", "phone": "9000000002",
            "slot_date": "2026-04-02", "slot_time": "13:00",
            "items": [{"service_id": "svc_g2", "service_name": "Nails",
                       "pet_type": "dog", "price": 1000, "qty": 1}],
            "payment_mode": "cash", "upi_txn_ref": None, "notes": "",
        }
        r = s.post(f"{API}/bookings", json=payload, headers=user_headers)
        assert r.status_code == 200
        b = r.json()
        assert b["gst"] == 180.0
        assert b["total"] == 1180.0


class TestAdminPasswordChange:
    """POST /api/admin/password: verify + validate + restore to Admin@123."""

    def test_wrong_current_password(self, s, admin_headers):
        r = s.post(f"{API}/admin/password",
                   json={"current_password": "WRONG", "new_password": "NewGood1"},
                   headers=admin_headers)
        assert r.status_code == 401

    def test_short_new_password(self, s, admin_headers):
        r = s.post(f"{API}/admin/password",
                   json={"current_password": "Admin@123", "new_password": "abc"},
                   headers=admin_headers)
        assert r.status_code == 400

    def test_change_and_restore(self, s, admin_headers):
        new_pw = "TempPass!456"
        r = s.post(f"{API}/admin/password",
                   json={"current_password": "Admin@123", "new_password": new_pw},
                   headers=admin_headers)
        assert r.status_code == 200, r.text

        # Old password now fails
        r2 = s.post(f"{API}/admin/login",
                    json={"email": "admin@pawgroom.in", "password": "Admin@123"})
        assert r2.status_code == 401

        # New password succeeds
        r3 = s.post(f"{API}/admin/login",
                    json={"email": "admin@pawgroom.in", "password": new_pw})
        assert r3.status_code == 200
        new_token = r3.json()["token"]

        # Restore original password using new token
        restore = s.post(f"{API}/admin/password",
                         json={"current_password": new_pw, "new_password": "Admin@123"},
                         headers={"Authorization": f"Bearer {new_token}",
                                  "Content-Type": "application/json"})
        assert restore.status_code == 200

        # Confirm we're back to Admin@123
        final = s.post(f"{API}/admin/login",
                       json={"email": "admin@pawgroom.in", "password": "Admin@123"})
        assert final.status_code == 200

    def test_password_change_requires_admin_auth(self, s):
        r = s.post(f"{API}/admin/password",
                   json={"current_password": "Admin@123", "new_password": "abcdef"})
        assert r.status_code == 401


class TestAdminCustomers:
    """/api/admin/customers listing + detail."""

    def test_requires_admin_auth(self, s):
        assert s.get(f"{API}/admin/customers").status_code == 401
        assert s.get(f"{API}/admin/customers/nope").status_code == 401

    def test_list_customers(self, s, admin_headers, seeded_user):
        r = s.get(f"{API}/admin/customers", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Find our seeded user
        found = next((u for u in data if u["user_id"] == seeded_user["user_id"]), None)
        assert found is not None
        for k in ("email", "name", "phone", "referral_code",
                  "bookings_count", "total_spend"):
            assert k in found
        assert isinstance(found["bookings_count"], int)
        assert isinstance(found["total_spend"], (int, float))

    def test_customer_detail(self, s, admin_headers, seeded_user):
        r = s.get(f"{API}/admin/customers/{seeded_user['user_id']}",
                  headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "customer" in data and "bookings" in data
        assert data["customer"]["user_id"] == seeded_user["user_id"]
        assert isinstance(data["bookings"], list)

    def test_customer_detail_not_found(self, s, admin_headers):
        r = s.get(f"{API}/admin/customers/user_DOES_NOT_EXIST",
                  headers=admin_headers)
        assert r.status_code == 404
