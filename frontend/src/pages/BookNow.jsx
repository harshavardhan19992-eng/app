import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatINR, cn } from "@/lib/utils";
import { PawPrint, Calendar as CalIcon, MapPin, ShoppingBag, Wallet, IndianRupee, Check, ArrowRight, ArrowLeft, Zap } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STEPS = ["City & pet", "Services", "Date & address", "Payment"];

export default function BookNow() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const initialCity = search.get("city") || "";

  const [step, setStep] = useState(0);
  const [cities, setCities] = useState([]);
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [payInfo, setPayInfo] = useState({ upi_id: "", payee_name: "" });
  const [referralValidation, setReferralValidation] = useState(null);

  const [form, setForm] = useState({
    city: initialCity,
    pet_name: "",
    pet_type: "dog",
    address_line1: "",
    address_line2: "",
    locality: "",
    landmark: "",
    pincode: "",
    state: "",
    phone: "",
    property_type: "apartment",
    floor_info: "",
    access_instructions: "",
    parking_type: "street",
    utilities_confirmed: false,
    slot_date: "",
    slot_time: "",
    payment_mode: "cash",
    upi_txn_ref: "",
    notes: "",
    referral_code: (search.get("ref") || "").toUpperCase(),
    items: {}, // { service_id: qty }
  });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    api.get("/cities").then((r) => setCities(r.data));
    api.get("/slots").then((r) => setSlots(r.data));
    api.get("/payment-info").then((r) => setPayInfo(r.data));
    // Auto-fill from saved profile
    api.get("/profile").then((r) => {
      setForm((f) => ({
        ...f,
        phone: f.phone || r.data.phone || "",
        address_line1: f.address_line1 || r.data.default_address_line1 || "",
        address_line2: f.address_line2 || r.data.default_address_line2 || "",
        locality: f.locality || r.data.default_locality || "",
        landmark: f.landmark || r.data.default_landmark || "",
        pincode: f.pincode || r.data.default_pincode || "",
        city: f.city || r.data.default_city || "",
        state: f.state || r.data.default_state || "",
      }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.city) return;
    api.get(`/services?city=${form.city}&pet_type=${form.pet_type}`).then((r) => setServices(r.data));
  }, [form.city, form.pet_type]);

  const selectedServiceItems = useMemo(() => {
    return services
      .filter((s) => (form.items[s.service_id] || 0) > 0)
      .map((s) => ({
        service_id: s.service_id,
        service_name: s.name,
        pet_type: s.pet_type,
        price: s.price,
        qty: form.items[s.service_id],
      }));
  }, [services, form.items]);

  const subtotal = selectedServiceItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const referralDiscount = referralValidation?.valid && subtotal >= (referralValidation.min_subtotal || 500)
    ? (referralValidation.discount_inr || 0) : 0;
  const discounted = Math.max(0, subtotal - referralDiscount);

  // Priority slot detection: weekend (Sat/Sun) or evening (>=17:00)
  const isPrioritySlot = (() => {
    if (!form.slot_date || !form.slot_time) return false;
    const d = new Date(form.slot_date + "T00:00:00");
    if (d.getDay() === 0 || d.getDay() === 6) return true;
    const hour = parseInt(form.slot_time.split(":")[0], 10);
    return hour >= 17;
  })();
  const priorityFee = isPrioritySlot ? 99 : 0;
  const taxable = discounted + priorityFee;
  const gst = Math.round(taxable * 0.18);
  const total = taxable + gst;

  const validateReferral = async () => {
    const code = form.referral_code.trim().toUpperCase();
    if (!code) { setReferralValidation(null); return; }
    try {
      const r = await api.get(`/referral/validate/${encodeURIComponent(code)}`);
      setReferralValidation(r.data);
      if (r.data.valid) toast.success("Referral applied — ₹200 off!");
      else toast.error(r.data.reason || "Invalid code");
    } catch {
      setReferralValidation({ valid: false, reason: "Could not validate" });
    }
  };

  const canNext = () => {
    if (step === 0) return !!form.city && !!form.pet_type && !!form.pet_name.trim();
    if (step === 1) return selectedServiceItems.length > 0;
    if (step === 2)
      return (
        !!form.slot_date && !!form.slot_time && !!form.address_line1.trim() &&
        !!form.locality.trim() &&
        /^\d{6}$/.test(form.pincode) && /^\d{10}$/.test(form.phone) &&
        form.utilities_confirmed
      );
    return true;
  };

  const toggleQty = (sid, delta) => {
    setForm((f) => {
      const next = { ...f.items };
      const cur = next[sid] || 0;
      const val = Math.max(0, cur + delta);
      if (val === 0) delete next[sid];
      else next[sid] = val;
      return { ...f, items: next };
    });
  };

  const submit = async () => {
    if (form.payment_mode === "upi" && !form.upi_txn_ref.trim()) {
      toast.error("Enter the UPI transaction reference to confirm.");
      return;
    }
    try {
      const payload = {
        city: form.city,
        pet_name: form.pet_name,
        pet_type: form.pet_type,
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        locality: form.locality,
        landmark: form.landmark,
        pincode: form.pincode,
        state: form.state,
        property_type: form.property_type,
        floor_info: form.floor_info,
        access_instructions: form.access_instructions,
        parking_type: form.parking_type,
        utilities_confirmed: form.utilities_confirmed,
        phone: form.phone,
        slot_date: form.slot_date,
        slot_time: form.slot_time,
        payment_mode: form.payment_mode,
        upi_txn_ref: form.upi_txn_ref || null,
        notes: form.notes,
        referral_code: form.referral_code || null,
        items: selectedServiceItems,
      };
      const r = await api.post("/bookings", payload);
      toast.success("Booking confirmed! Invoice is ready to download.");
      navigate(`/dashboard`, { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Booking failed");
    }
  };

  if (loading || !user) return null;

  return (
    <main data-testid="book-now-page" className="max-w-6xl mx-auto px-6 lg:px-10 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">Book a session</div>
        <h1 className="font-serif-display text-4xl sm:text-5xl">Let&rsquo;s plan a spa day.</h1>
      </div>

      <Stepper step={step} />

      <div className="grid lg:grid-cols-3 gap-8 mt-10">
        <div className="lg:col-span-2 rounded-3xl border border-[#E5DFD3] bg-[#FDFBF7] p-6 sm:p-8">
          {step === 0 && (
            <StepPetCity form={form} setForm={setForm} cities={cities} />
          )}
          {step === 1 && (
            <StepServices form={form} services={services} toggleQty={toggleQty} />
          )}
          {step === 2 && (
            <>
              <StepDateAddress form={form} setForm={setForm} slots={slots} />
              {isPrioritySlot && (
                <div
                  data-testid="priority-notice"
                  className="mt-6 rounded-2xl border border-[#D96C4A]/40 bg-[#FDFBF7] p-5 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-[#D96C4A] text-white flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4" strokeWidth={1.75}/>
                  </div>
                  <div>
                    <div className="font-serif-display text-xl">Priority slot — ₹99 fee</div>
                    <div className="text-sm text-[#5C7365] mt-1">
                      Weekend and evening slots book out fast. This ₹99 fee guarantees a groomer
                      is allocated for your session and prioritised on the day. Automatically added to your total.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <StepPayment
              form={form}
              setForm={setForm}
              payInfo={payInfo}
              total={total}
              referralValidation={referralValidation}
              onValidateReferral={validateReferral}
            />
          )}

          <div className="mt-10 flex items-center justify-between">
            <Button
              variant="outline"
              data-testid="step-back-btn"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-full h-11 px-6 border-[#E5DFD3]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.75}/> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                data-testid="step-next-btn"
                disabled={!canNext()}
                onClick={() => setStep((s) => s + 1)}
                className="rounded-full h-11 px-6 bg-[#1E3F2D] hover:bg-[#25523a] text-white"
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.75}/>
              </Button>
            ) : (
              <Button
                data-testid="confirm-booking-btn"
                onClick={submit}
                className="rounded-full h-11 px-6 bg-[#D96C4A] hover:bg-[#c65e3e] text-white"
              >
                Confirm booking <Check className="w-4 h-4 ml-2" strokeWidth={1.75}/>
              </Button>
            )}
          </div>
        </div>

        <aside className="rounded-3xl border border-[#E5DFD3] bg-[#F1EBE1] p-6 sm:p-8 h-fit sticky top-24">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-4 h-4" strokeWidth={1.75}/>
            <h3 className="font-serif-display text-2xl">Summary</h3>
          </div>
          <div className="text-sm text-[#5C7365] space-y-2">
            <div className="flex items-center gap-2"><PawPrint className="w-3.5 h-3.5" strokeWidth={1.75}/> {form.pet_name || "Pet name pending"} ({form.pet_type})</div>
            <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" strokeWidth={1.75}/> {cities.find((c) => c.slug === form.city)?.name || "City pending"}</div>
            <div className="flex items-center gap-2"><CalIcon className="w-3.5 h-3.5" strokeWidth={1.75}/> {form.slot_date && form.slot_time ? `${form.slot_date} • ${form.slot_time}` : "Slot pending"}</div>
          </div>

          <div className="mt-5 border-t border-[#E5DFD3] pt-4 space-y-2">
            {selectedServiceItems.length === 0 && (
              <div className="text-sm text-[#5C7365]">No services selected yet.</div>
            )}
            {selectedServiceItems.map((it) => (
              <div key={it.service_id} className="flex items-center justify-between text-sm">
                <span>{it.service_name} × {it.qty}</span>
                <span>{formatINR(it.price * it.qty)}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[#E5DFD3] pt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            {referralDiscount > 0 && (
              <div className="flex justify-between text-[#D96C4A]">
                <span>Referral discount</span><span>− {formatINR(referralDiscount)}</span>
              </div>
            )}
            {priorityFee > 0 && (
              <div className="flex justify-between text-[#1E3F2D]" data-testid="summary-priority-line">
                <span>Priority slot fee</span><span>+ {formatINR(priorityFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#5C7365]"><span>GST (18%)</span><span>{formatINR(gst)}</span></div>
            <div className="flex justify-between text-lg font-medium mt-2"><span>Total</span><span className="font-serif-display text-2xl">{formatINR(total)}</span></div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stepper({ step }) {
  return (
    <ol data-testid="booking-stepper" className="flex flex-wrap items-center gap-3">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-3">
          <span
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs border",
              i <= step ? "bg-[#1E3F2D] text-white border-[#1E3F2D]" : "bg-white text-[#5C7365] border-[#E5DFD3]"
            )}
          >
            {i + 1}
          </span>
          <span className={cn("text-sm", i === step ? "text-[#1E3F2D] font-medium" : "text-[#5C7365]")}>{s}</span>
          {i < STEPS.length - 1 && <span className="w-8 h-px bg-[#E5DFD3]" />}
        </li>
      ))}
    </ol>
  );
}

function StepPetCity({ form, setForm, cities }) {
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      <div>
        <Label className="text-[#1E3F2D]">City</Label>
        <Select value={form.city} onValueChange={(v) => setForm((f) => ({ ...f, city: v }))}>
          <SelectTrigger data-testid="city-select" className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11">
            <SelectValue placeholder="Choose your city" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c.slug} value={c.slug} data-testid={`city-option-${c.slug}`}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Pet type</Label>
        <RadioGroup
          className="mt-2 grid grid-cols-2 gap-3"
          value={form.pet_type}
          onValueChange={(v) => setForm((f) => ({ ...f, pet_type: v, items: {} }))}
        >
          {[
            { v: "dog", label: "Dog 🐶" },
            { v: "cat", label: "Cat 🐱" },
          ].map((p) => (
            <label
              key={p.v}
              className={cn(
                "cursor-pointer rounded-xl border h-11 px-4 flex items-center gap-3",
                form.pet_type === p.v ? "border-[#1E3F2D] bg-[#F1EBE1]" : "border-[#E5DFD3] bg-[#FDFBF7]"
              )}
            >
              <RadioGroupItem value={p.v} data-testid={`pet-type-${p.v}`} />
              <span className="text-sm">{p.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="pet_name">Pet&rsquo;s name</Label>
        <Input
          id="pet_name"
          data-testid="pet-name-input"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          placeholder="e.g. Miso"
          value={form.pet_name}
          onChange={(e) => setForm((f) => ({ ...f, pet_name: e.target.value }))}
        />
      </div>
    </div>
  );
}

function StepServices({ form, services, toggleQty }) {
  return (
    <div>
      <div className="text-sm text-[#5C7365] mb-4">
        Showing packages for <b>{form.pet_type === "dog" ? "dogs" : "cats"}</b>. Prices reflect your city.
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {services.map((s) => {
          const qty = form.items[s.service_id] || 0;
          return (
            <div
              key={s.service_id}
              data-testid={`svc-row-${s.service_id}`}
              className={cn(
                "rounded-2xl border p-5 flex flex-col gap-3",
                qty > 0 ? "border-[#1E3F2D] bg-[#F1EBE1]" : "border-[#E5DFD3] bg-[#FDFBF7]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-serif-display text-xl">{s.name}</div>
                  <div className="text-xs text-[#5C7365] mt-1">{s.duration_minutes} minutes</div>
                </div>
                <div className="font-serif-display text-xl">{formatINR(s.price)}</div>
              </div>
              <p className="text-sm text-[#5C7365]">{s.description}</p>
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#5C7365]">Add to booking</div>
                <div className="flex items-center gap-2">
                  <button
                    data-testid={`svc-dec-${s.service_id}`}
                    className="w-8 h-8 rounded-full border border-[#E5DFD3] bg-white hover:bg-[#F1EBE1]"
                    onClick={() => toggleQty(s.service_id, -1)}
                    disabled={qty === 0}
                  >−</button>
                  <span data-testid={`svc-qty-${s.service_id}`} className="w-6 text-center">{qty}</span>
                  <button
                    data-testid={`svc-inc-${s.service_id}`}
                    className="w-8 h-8 rounded-full bg-[#1E3F2D] text-white"
                    onClick={() => toggleQty(s.service_id, 1)}
                  >+</button>
                </div>
              </div>
            </div>
          );
        })}
        {services.length === 0 && (
          <div className="col-span-full text-sm text-[#5C7365]">Choose a city in the previous step to see services.</div>
        )}
      </div>
    </div>
  );
}

function StepDateAddress({ form, setForm, slots }) {
  const dateObj = form.slot_date ? new Date(form.slot_date) : undefined;
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      <div>
        <Label>Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              data-testid="date-picker-trigger"
              className="mt-2 w-full h-11 rounded-xl border border-[#E5DFD3] bg-[#FDFBF7] px-4 text-left flex items-center gap-2"
            >
              <CalIcon className="w-4 h-4" strokeWidth={1.75}/>
              {dateObj ? format(dateObj, "PPP") : "Pick a date"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0" align="start">
            <CalendarUI
              mode="single"
              selected={dateObj}
              onSelect={(d) => {
                if (!d) return;
                const s = d.toISOString().slice(0, 10);
                setForm((f) => ({ ...f, slot_date: s }));
              }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label>Time slot</Label>
        <Select value={form.slot_time} onValueChange={(v) => setForm((f) => ({ ...f, slot_time: v }))}>
          <SelectTrigger data-testid="slot-select" className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11">
            <SelectValue placeholder="Choose a slot" />
          </SelectTrigger>
          <SelectContent>
            {slots.map((s) => (
              <SelectItem key={s} value={s} data-testid={`slot-${s}`}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="addr1">Address line 1</Label>
        <Input
          id="addr1"
          data-testid="address-line1-input"
          placeholder="Flat / house no., building name, street"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          value={form.address_line1}
          onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="addr2">Address line 2 (optional)</Label>
        <Input
          id="addr2"
          data-testid="address-line2-input"
          placeholder="Block, tower, wing"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          value={form.address_line2}
          onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="locality">Locality / Area</Label>
        <Input
          id="locality"
          data-testid="locality-input"
          placeholder="e.g. Bandra West, HSR Layout"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          value={form.locality}
          onChange={(e) => setForm((f) => ({ ...f, locality: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="landmark">Nearby landmark (optional)</Label>
        <Input
          id="landmark"
          data-testid="landmark-input"
          placeholder="e.g. Opposite HDFC Bank"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          value={form.landmark}
          onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="pin">PIN code</Label>
        <Input
          id="pin"
          data-testid="pincode-input"
          inputMode="numeric"
          maxLength={6}
          placeholder="6 digits"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          value={form.pincode}
          onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "") }))}
        />
      </div>
      <div>
        <Label htmlFor="state">State (optional)</Label>
        <Input
          id="state"
          data-testid="state-input"
          placeholder="e.g. Maharashtra"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          value={form.state}
          onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="phone">Mobile number</Label>
        <Input
          id="phone"
          data-testid="phone-input"
          inputMode="numeric"
          maxLength={10}
          placeholder="10 digits"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
        />
      </div>
      <div>
        <Label>Property type</Label>
        <Select value={form.property_type} onValueChange={(v) => setForm((f) => ({ ...f, property_type: v }))}>
          <SelectTrigger data-testid="property-type-select" className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apartment">Apartment / Flat</SelectItem>
            <SelectItem value="house">Independent house</SelectItem>
            <SelectItem value="villa">Villa / Bungalow</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="floor">Floor / lift info (optional)</Label>
        <Input
          id="floor"
          data-testid="floor-input"
          placeholder="e.g. 5th floor, lift available"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
          value={form.floor_info}
          onChange={(e) => setForm((f) => ({ ...f, floor_info: e.target.value }))}
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Parking</Label>
        <RadioGroup
          className="mt-2 grid grid-cols-3 gap-2"
          value={form.parking_type}
          onValueChange={(v) => setForm((f) => ({ ...f, parking_type: v }))}
        >
          {[
            { v: "available", label: "Available onsite" },
            { v: "street", label: "Street parking" },
            { v: "none", label: "Not available" },
          ].map((p) => (
            <label
              key={p.v}
              className={cn(
                "cursor-pointer rounded-xl border h-11 px-3 flex items-center gap-2 text-sm",
                form.parking_type === p.v ? "border-[#1E3F2D] bg-[#F1EBE1]" : "border-[#E5DFD3] bg-[#FDFBF7]"
              )}
            >
              <RadioGroupItem value={p.v} data-testid={`parking-${p.v}`} />
              {p.label}
            </label>
          ))}
        </RadioGroup>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="access">Entry / access instructions (optional)</Label>
        <Textarea
          id="access"
          data-testid="access-instructions-input"
          placeholder="Gate code, guard name, doorbell, pet at door…"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3]"
          value={form.access_instructions}
          onChange={(e) => setForm((f) => ({ ...f, access_instructions: e.target.value }))}
        />
      </div>
      <div className="sm:col-span-2 rounded-2xl border border-[#E5DFD3] bg-[#F1EBE1] p-4 flex items-start gap-3">
        <input
          id="utilities"
          type="checkbox"
          data-testid="utilities-confirm"
          className="mt-1 w-4 h-4 accent-[#1E3F2D]"
          checked={form.utilities_confirmed}
          onChange={(e) => setForm((f) => ({ ...f, utilities_confirmed: e.target.checked }))}
        />
        <label htmlFor="utilities" className="text-sm cursor-pointer">
          <div className="font-medium text-[#1E3F2D]">Water and power will be available at the location</div>
          <div className="text-xs text-[#5C7365] mt-1">
            Our groomers need running water and an electrical outlet for bathing, blow-drying and clipping.
          </div>
        </label>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="notes">Notes for the groomer (optional)</Label>
        <Textarea
          id="notes"
          data-testid="notes-input"
          placeholder="Behaviour, allergies, coat type…"
          className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3]"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
    </div>
  );
}

function StepPayment({ form, setForm, payInfo, total, referralValidation, onValidateReferral }) {
  return (
    <div>
      <RadioGroup
        className="grid sm:grid-cols-2 gap-4"
        value={form.payment_mode}
        onValueChange={(v) => setForm((f) => ({ ...f, payment_mode: v, upi_txn_ref: "" }))}
      >
        {[
          { v: "cash", icon: Wallet, title: "Cash on service", desc: "Pay our groomer at your doorstep after the session." },
          { v: "upi", icon: IndianRupee, title: "UPI (GPay / PhonePe / Paytm)", desc: `Pay to ${payInfo.upi_id || "our UPI"} and add the reference.` },
        ].map((p) => (
          <label
            key={p.v}
            className={cn(
              "cursor-pointer rounded-2xl border p-5",
              form.payment_mode === p.v ? "border-[#1E3F2D] bg-[#F1EBE1]" : "border-[#E5DFD3] bg-[#FDFBF7]"
            )}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value={p.v} data-testid={`pay-mode-${p.v}`} />
              <p.icon className="w-4 h-4" strokeWidth={1.75}/>
              <span className="font-medium">{p.title}</span>
            </div>
            <p className="text-sm text-[#5C7365] mt-2 ml-9">{p.desc}</p>
          </label>
        ))}
      </RadioGroup>

      {form.payment_mode === "upi" && (
        <div className="mt-6 rounded-2xl border border-[#E5DFD3] p-5 bg-[#FDFBF7]">
          <div className="text-sm text-[#5C7365]">Pay <b className="text-[#1E3F2D]">{formatINR(total)}</b> to:</div>
          <div className="font-serif-display text-3xl mt-1">{payInfo.upi_id || "pawgroom@upi"}</div>
          <div className="text-xs text-[#5C7365] mt-1">{payInfo.payee_name}</div>
          <div className="mt-4">
            <Label htmlFor="upi_ref">UPI transaction reference</Label>
            <Input
              id="upi_ref"
              data-testid="upi-ref-input"
              placeholder="e.g. 4032xxxxxx01"
              className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
              value={form.upi_txn_ref}
              onChange={(e) => setForm((f) => ({ ...f, upi_txn_ref: e.target.value }))}
            />
          </div>
        </div>
      )}

      {/* Referral code */}
      <div className="mt-6 rounded-2xl border border-dashed border-[#D96C4A]/40 p-5 bg-[#FDFBF7]">
        <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">Got a referral code?</div>
        <div className="font-serif-display text-xl mb-3">Save ₹200 on your first booking</div>
        <div className="flex gap-2">
          <Input
            data-testid="referral-code-input"
            placeholder="PG-XXXXXX"
            className="rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11 uppercase"
            value={form.referral_code}
            onChange={(e) => setForm((f) => ({ ...f, referral_code: e.target.value.toUpperCase() }))}
          />
          <Button
            data-testid="apply-referral-btn"
            type="button"
            onClick={onValidateReferral}
            className="rounded-full bg-[#D96C4A] hover:bg-[#c65e3e] text-white h-11 px-5 whitespace-nowrap"
          >
            Apply
          </Button>
        </div>
        {referralValidation && (
          <div className={cn("mt-2 text-xs", referralValidation.valid ? "text-emerald-700" : "text-rose-700")}>
            {referralValidation.valid ? "✓ Applied — ₹200 off (min. subtotal ₹500)" : referralValidation.reason}
          </div>
        )}
      </div>
    </div>
  );
}
