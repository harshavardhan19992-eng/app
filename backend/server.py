"""PawGroom India — at-home pet grooming booking backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import bcrypt
import jwt as pyjwt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
UPI_ID = os.environ["UPI_ID"]
UPI_PAYEE_NAME = os.environ["UPI_PAYEE_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="PawGroom API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pawgroom")


# -------------------- Models --------------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    referral_code: Optional[str] = None
    created_at: datetime


class BookingItem(BaseModel):
    service_id: str
    service_name: str
    pet_type: str
    price: float
    qty: int = 1


class BookingCreate(BaseModel):
    city: str
    pet_name: str
    pet_type: str  # 'dog' | 'cat'
    address_line1: str
    address_line2: Optional[str] = ""
    pincode: str
    phone: str
    slot_date: str  # YYYY-MM-DD
    slot_time: str  # e.g. "10:00"
    items: List[BookingItem]
    payment_mode: str  # 'cash' | 'upi'
    upi_txn_ref: Optional[str] = None
    notes: Optional[str] = ""
    referral_code: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: str  # 'pending' | 'confirmed' | 'in_service' | 'completed' | 'cancelled'


class ServiceCreate(BaseModel):
    name: str
    pet_type: str
    description: str
    duration_minutes: int
    base_price: float
    image_url: Optional[str] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    pet_type: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    base_price: Optional[float] = None
    image_url: Optional[str] = None
    active: Optional[bool] = None


class AdminLogin(BaseModel):
    email: str
    password: str


# -------------------- Auth Helpers --------------------
async def get_current_user(request: Request) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    return User(**user_doc)


async def get_current_admin(request: Request) -> Dict[str, Any]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin token required")
    token = auth.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not admin")
    return payload


# -------------------- Public/Catalog --------------------
CITY_CATALOG = [
    {"slug": "mumbai", "name": "Mumbai", "multiplier": 1.20},
    {"slug": "delhi", "name": "Delhi NCR", "multiplier": 1.15},
    {"slug": "bangalore", "name": "Bengaluru", "multiplier": 1.15},
    {"slug": "hyderabad", "name": "Hyderabad", "multiplier": 1.00},
    {"slug": "chennai", "name": "Chennai", "multiplier": 1.00},
    {"slug": "pune", "name": "Pune", "multiplier": 1.00},
    {"slug": "kolkata", "name": "Kolkata", "multiplier": 0.95},
    {"slug": "ahmedabad", "name": "Ahmedabad", "multiplier": 0.90},
]


@api.get("/")
async def root():
    return {"service": "PawGroom API", "status": "ok"}


@api.get("/cities")
async def list_cities():
    return CITY_CATALOG


@api.get("/services")
async def list_services(city: Optional[str] = None, pet_type: Optional[str] = None):
    q: Dict[str, Any] = {"active": True}
    if pet_type:
        q["pet_type"] = pet_type
    services = await db.services.find(q, {"_id": 0}).to_list(500)
    mult = 1.0
    if city:
        found = next((c for c in CITY_CATALOG if c["slug"] == city), None)
        if found:
            mult = found["multiplier"]
    for s in services:
        s["price"] = round(s["base_price"] * mult)
        s["city_multiplier"] = mult
    return services


@api.get("/slots")
async def list_slots():
    # simple fixed slots 10:00–19:00
    return [f"{h:02d}:00" for h in range(10, 20)]


# -------------------- Customer Auth (Emergent Google) --------------------
@api.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Exchange Emergent session_id from URL fragment for a session cookie."""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Emergent session")
    data = r.json()
    email = data["email"]
    name = data.get("name", email)
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        update = {"name": name, "picture": picture}
        if not existing.get("referral_code"):
            update["referral_code"] = f"PG-{uuid.uuid4().hex[:6].upper()}"
        await db.users.update_one({"user_id": user_id}, {"$set": update})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "referral_code": f"PG-{uuid.uuid4().hex[:6].upper()}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    return {
        "user_id": user_id, "email": email, "name": name, "picture": picture,
    }


@api.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


# -------------------- Admin Auth --------------------
@api.post("/admin/login")
async def admin_login(payload: AdminLogin):
    admin = await db.admins.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(payload.password.encode(), admin["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = pyjwt.encode(
        {
            "sub": admin["email"],
            "role": "admin",
            "exp": datetime.now(timezone.utc) + timedelta(days=2),
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token, "email": admin["email"], "name": admin.get("name", "Admin")}


@api.get("/admin/me")
async def admin_me(admin=Depends(get_current_admin)):
    return {"email": admin["sub"], "role": "admin"}


# -------------------- Services CRUD (Admin) --------------------
@api.post("/admin/services")
async def create_service(payload: ServiceCreate, admin=Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["service_id"] = f"svc_{uuid.uuid4().hex[:10]}"
    doc["active"] = True
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.services.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/services/{service_id}")
async def update_service(service_id: str, payload: ServiceUpdate, admin=Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.services.update_one({"service_id": service_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    doc = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return doc


@api.delete("/admin/services/{service_id}")
async def delete_service(service_id: str, admin=Depends(get_current_admin)):
    res = await db.services.update_one(
        {"service_id": service_id}, {"$set": {"active": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"ok": True}


# -------------------- Bookings --------------------
def _city_by_slug(slug: str):
    return next((c for c in CITY_CATALOG if c["slug"] == slug), None)


@api.get("/referral")
async def my_referral(user: User = Depends(get_current_user)):
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not doc.get("referral_code"):
        code = f"PG-{uuid.uuid4().hex[:6].upper()}"
        await db.users.update_one({"user_id": user.user_id}, {"$set": {"referral_code": code}})
        doc["referral_code"] = code
    return {
        "referral_code": doc["referral_code"],
        "referral_count": doc.get("referral_count", 0),
        "referral_credit_inr": doc.get("referral_credit_inr", 0),
    }


@api.get("/referral/validate/{code}")
async def validate_referral(code: str, user: User = Depends(get_current_user)):
    code = code.strip().upper()
    referrer = await db.users.find_one({"referral_code": code}, {"_id": 0})
    booking_count = await db.bookings.count_documents({"user_id": user.user_id})
    if not referrer:
        return {"valid": False, "reason": "Code not found"}
    if referrer["user_id"] == user.user_id:
        return {"valid": False, "reason": "Cannot use your own code"}
    if booking_count > 0:
        return {"valid": False, "reason": "Only for your first booking"}
    return {"valid": True, "discount_inr": 200, "min_subtotal": 500}


@api.post("/bookings")
async def create_booking(payload: BookingCreate, user: User = Depends(get_current_user)):
    city = _city_by_slug(payload.city)
    if not city:
        raise HTTPException(status_code=400, detail="Unsupported city")
    if not payload.items:
        raise HTTPException(status_code=400, detail="No services selected")

    subtotal = sum(i.price * i.qty for i in payload.items)

    # Apply referral discount (₹200 off, first booking only, valid other-user code)
    referral_discount = 0
    referral_code_used = None
    if payload.referral_code:
        code = payload.referral_code.strip().upper()
        referrer = await db.users.find_one({"referral_code": code}, {"_id": 0})
        user_booking_count = await db.bookings.count_documents({"user_id": user.user_id})
        if referrer and referrer["user_id"] != user.user_id and user_booking_count == 0 and subtotal >= 500:
            referral_discount = 200
            referral_code_used = code
            # Credit the referrer
            await db.users.update_one(
                {"user_id": referrer["user_id"]},
                {"$inc": {"referral_count": 1, "referral_credit_inr": 200}},
            )

    discounted_subtotal = max(0, subtotal - referral_discount)
    gst = round(discounted_subtotal * 0.18, 2)
    total = round(discounted_subtotal + gst, 2)

    booking_id = f"bkg_{uuid.uuid4().hex[:10]}"
    invoice_no = f"INV-{datetime.now(timezone.utc).strftime('%y%m')}-{uuid.uuid4().hex[:5].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    doc = {
        "booking_id": booking_id,
        "invoice_no": invoice_no,
        "user_id": user.user_id,
        "user_email": user.email,
        "user_name": user.name,
        "city_slug": city["slug"],
        "city_name": city["name"],
        "pet_name": payload.pet_name,
        "pet_type": payload.pet_type,
        "address_line1": payload.address_line1,
        "address_line2": payload.address_line2,
        "pincode": payload.pincode,
        "phone": payload.phone,
        "slot_date": payload.slot_date,
        "slot_time": payload.slot_time,
        "items": [i.model_dump() for i in payload.items],
        "subtotal": round(subtotal, 2),
        "referral_code_used": referral_code_used,
        "referral_discount": referral_discount,
        "gst": gst,
        "total": total,
        "payment_mode": payload.payment_mode,
        "payment_status": "paid" if payload.payment_mode == "upi" and payload.upi_txn_ref else "pending",
        "upi_txn_ref": payload.upi_txn_ref,
        "notes": payload.notes,
        "status": "pending",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/bookings")
async def my_bookings(user: User = Depends(get_current_user)):
    docs = await db.bookings.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return docs


@api.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: User = Depends(get_current_user)):
    doc = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    if doc["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not your booking")
    return doc


@api.get("/admin/bookings")
async def admin_bookings(admin=Depends(get_current_admin)):
    docs = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api.patch("/admin/bookings/{booking_id}/status")
async def admin_update_status(booking_id: str, payload: BookingStatusUpdate, admin=Depends(get_current_admin)):
    allowed = {"pending", "confirmed", "in_service", "completed", "cancelled"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(admin=Depends(get_current_admin)):
    total_bookings = await db.bookings.count_documents({})
    pending = await db.bookings.count_documents({"status": "pending"})
    completed = await db.bookings.count_documents({"status": "completed"})
    revenue_cursor = db.bookings.aggregate([
        {"$match": {"status": {"$in": ["completed", "confirmed", "in_service"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ])
    revenue_docs = await revenue_cursor.to_list(1)
    revenue = revenue_docs[0]["total"] if revenue_docs else 0
    total_users = await db.users.count_documents({})
    return {
        "total_bookings": total_bookings,
        "pending": pending,
        "completed": completed,
        "revenue": round(revenue, 2),
        "total_users": total_users,
    }


# -------------------- Invoice PDF --------------------
def _build_invoice_pdf(booking: Dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    brand = ParagraphStyle("brand", parent=styles["Title"],
                           fontName="Times-Bold", fontSize=28,
                           textColor=colors.HexColor("#1E3F2D"),
                           spaceAfter=2)
    tag = ParagraphStyle("tag", parent=styles["Normal"],
                         fontName="Helvetica", fontSize=9,
                         textColor=colors.HexColor("#5C7365"))
    h = ParagraphStyle("h", parent=styles["Heading3"],
                       fontName="Helvetica-Bold", fontSize=10,
                       textColor=colors.HexColor("#1E3F2D"))
    p = ParagraphStyle("p", parent=styles["Normal"],
                       fontName="Helvetica", fontSize=10,
                       textColor=colors.HexColor("#1E3F2D"))

    story = []
    story.append(Paragraph("PawGroom", brand))
    story.append(Paragraph("At-home pet grooming • India", tag))
    story.append(Spacer(1, 10))

    meta_data = [
        [Paragraph("<b>Invoice No.</b>", p), Paragraph(booking["invoice_no"], p),
         Paragraph("<b>Booking ID</b>", p), Paragraph(booking["booking_id"], p)],
        [Paragraph("<b>Invoice Date</b>", p),
         Paragraph(booking["created_at"][:10], p),
         Paragraph("<b>Service Date</b>", p),
         Paragraph(f'{booking["slot_date"]} • {booking["slot_time"]}', p)],
    ]
    meta = Table(meta_data, colWidths=[35 * mm, 45 * mm, 35 * mm, 45 * mm])
    meta.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5DFD3")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5DFD3")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FDFBF7")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta)
    story.append(Spacer(1, 14))

    story.append(Paragraph("Billed To", h))
    story.append(Paragraph(f'{booking["user_name"]} — {booking["user_email"]}', p))
    story.append(Paragraph(booking["phone"], p))
    addr2 = f' , {booking.get("address_line2","")}' if booking.get("address_line2") else ""
    story.append(Paragraph(
        f'{booking["address_line1"]}{addr2}, {booking["city_name"]} - {booking["pincode"]}', p))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f'Pet: <b>{booking["pet_name"]}</b> ({booking["pet_type"].title()})', p))
    story.append(Spacer(1, 14))

    # Items table
    items_data = [[
        Paragraph("<b>Service</b>", p),
        Paragraph("<b>Pet</b>", p),
        Paragraph("<b>Qty</b>", p),
        Paragraph("<b>Price</b>", p),
        Paragraph("<b>Total</b>", p),
    ]]
    for it in booking["items"]:
        line_total = it["price"] * it["qty"]
        items_data.append([
            Paragraph(it["service_name"], p),
            Paragraph(it["pet_type"].title(), p),
            Paragraph(str(it["qty"]), p),
            Paragraph(f'₹ {it["price"]:.0f}', p),
            Paragraph(f'₹ {line_total:.0f}', p),
        ])
    items = Table(items_data, colWidths=[70 * mm, 25 * mm, 15 * mm, 25 * mm, 25 * mm])
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1EBE1")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5DFD3")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5DFD3")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items)
    story.append(Spacer(1, 10))

    # Totals
    totals_data = [
        [Paragraph("Subtotal", p), Paragraph(f'₹ {booking["subtotal"]:.0f}', p)],
    ]
    if booking.get("referral_discount", 0) > 0:
        totals_data.append([
            Paragraph(f'Referral discount ({booking.get("referral_code_used","")})', p),
            Paragraph(f'− ₹ {booking["referral_discount"]:.0f}', p),
        ])
    totals_data += [
        [Paragraph("GST (18%)", p), Paragraph(f'₹ {booking["gst"]:.0f}', p)],
        [Paragraph("<b>Total</b>", p), Paragraph(f'<b>₹ {booking["total"]:.0f}</b>', p)],
    ]
    totals = Table(totals_data, colWidths=[130 * mm, 30 * mm])
    totals.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#1E3F2D")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(totals)
    story.append(Spacer(1, 18))

    pay_info = f'Payment: <b>{booking["payment_mode"].upper()}</b> — Status: <b>{booking["payment_status"].title()}</b>'
    if booking.get("upi_txn_ref"):
        pay_info += f' — UPI Ref: {booking["upi_txn_ref"]}'
    story.append(Paragraph(pay_info, p))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Thank you for booking with PawGroom. For queries write to hello@pawgroom.in.", tag))

    doc.build(story)
    return buf.getvalue()


@api.get("/bookings/{booking_id}/invoice.pdf")
async def download_invoice(booking_id: str, user: User = Depends(get_current_user)):
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not your invoice")
    pdf = _build_invoice_pdf(booking)
    filename = f'PawGroom-{booking["invoice_no"]}.pdf'
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/payment-info")
async def payment_info():
    return {"upi_id": UPI_ID, "payee_name": UPI_PAYEE_NAME}


# -------------------- Seeding --------------------
SERVICE_SEED = [
    # DOG
    {"name": "Bath & Brush", "pet_type": "dog",
     "description": "Warm-water bath with hypoallergenic shampoo, blow-dry, brushing and ear cleaning.",
     "duration_minutes": 60, "base_price": 799,
     "image_url": "https://images.pexels.com/photos/37304670/pexels-photo-37304670.jpeg"},
    {"name": "Full Grooming", "pet_type": "dog",
     "description": "Bath, breed-cut haircut, nail trim, ear cleaning, paw balm and cologne.",
     "duration_minutes": 90, "base_price": 1499,
     "image_url": "https://images.pexels.com/photos/37304670/pexels-photo-37304670.jpeg"},
    {"name": "Deluxe Spa", "pet_type": "dog",
     "description": "Full grooming plus aromatherapy soak, coat mask, teeth brushing and paw massage.",
     "duration_minutes": 120, "base_price": 2499,
     "image_url": "https://images.pexels.com/photos/12721119/pexels-photo-12721119.jpeg"},
    {"name": "Nails & Paw Care", "pet_type": "dog",
     "description": "Precision nail clipping, filing, paw pad trim and moisturising balm.",
     "duration_minutes": 30, "base_price": 399,
     "image_url": "https://images.pexels.com/photos/12721119/pexels-photo-12721119.jpeg"},
    {"name": "De-shedding Treatment", "pet_type": "dog",
     "description": "Undercoat treatment to reduce shedding by up to 90% for 4-6 weeks.",
     "duration_minutes": 60, "base_price": 999,
     "image_url": "https://images.unsplash.com/photo-1509205477838-a534e43a849f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"},
    # CAT
    {"name": "Cat Bath & Brush", "pet_type": "cat",
     "description": "Feline-friendly bath, blow-dry and gentle brushing suited to cats.",
     "duration_minutes": 50, "base_price": 899,
     "image_url": "https://images.pexels.com/photos/37022013/pexels-photo-37022013.jpeg"},
    {"name": "Cat Full Grooming", "pet_type": "cat",
     "description": "Bath, sanitary trim, nail clipping and coat de-matting.",
     "duration_minutes": 75, "base_price": 1699,
     "image_url": "https://images.pexels.com/photos/37022013/pexels-photo-37022013.jpeg"},
    {"name": "Cat Nail Trim", "pet_type": "cat",
     "description": "Careful clipping with cat-safe clippers and paw check.",
     "duration_minutes": 20, "base_price": 349,
     "image_url": "https://images.pexels.com/photos/37022013/pexels-photo-37022013.jpeg"},
]


@app.on_event("startup")
async def seed_on_startup():
    # Seed admin
    admin_email = ADMIN_EMAIL.lower()
    existing = await db.admins.find_one({"email": admin_email}, {"_id": 0})
    if not existing:
        pw_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await db.admins.insert_one({
            "email": admin_email,
            "name": "PawGroom Admin",
            "password_hash": pw_hash,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded default admin: %s", admin_email)

    # Seed services
    count = await db.services.count_documents({})
    if count == 0:
        docs = []
        for s in SERVICE_SEED:
            docs.append({
                **s,
                "service_id": f"svc_{uuid.uuid4().hex[:10]}",
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        await db.services.insert_many(docs)
        logger.info("Seeded %d services", len(docs))


@app.on_event("shutdown")
async def _shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
