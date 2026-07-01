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
