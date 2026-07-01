import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { PawPrint, MapPin, ShieldCheck, Sparkles, Clock, ArrowRight, Star } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1509205477838-a534e43a849f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwyfHxkb2clMjBjYXQlMjBncm9vbWluZ3xlbnwwfHx8fDE3ODI2NzQ5NjN8MA&ixlib=rb-4.1.0&q=85";
const IMG_A = "https://images.pexels.com/photos/12721119/pexels-photo-12721119.jpeg";
const IMG_B = "https://images.pexels.com/photos/37304670/pexels-photo-37304670.jpeg";
const IMG_C = "https://images.pexels.com/photos/37022013/pexels-photo-37022013.jpeg";
const IMG_D = "https://images.unsplash.com/photo-1563460716037-460a3ad24ba9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwxfHxkb2clMjBjYXQlMjBncm9vbWluZ3xlbnwwfHx8fDE3ODI2NzQ5NjN8MA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  const [services, setServices] = useState([]);
  const [cities, setCities] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/services").then((r) => setServices(r.data)).catch(() => {});
    api.get("/cities").then((r) => setCities(r.data)).catch(() => {});
  }, []);

  return (
    <main data-testid="landing-page" className="text-[#1E3F2D]">
      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-14 pb-20">
        <div className="grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-6">
              <span className="w-8 h-px bg-[#5C7365]" />
              At-home pet grooming • India
            </div>
            <h1
              data-testid="hero-title"
              className="font-serif-display text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tight"
            >
              Pampering that arrives<br/>
              <span className="italic text-[#D96C4A]">at your doorstep.</span>
            </h1>
            <p className="mt-6 text-lg text-[#5C7365] max-w-xl">
              Certified groomers, hypoallergenic products and a calm, familiar space.
              Book a session for your dog or cat in under two minutes.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                data-testid="hero-cta-book"
                onClick={() => navigate("/book")}
                className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white h-12 px-7 text-base hover-lift"
              >
                Book a session <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.75} />
              </Button>
              <Link
                to="#services"
                data-testid="hero-cta-services"
                className="rounded-full border border-[#1E3F2D]/20 h-12 px-7 flex items-center text-base hover-lift hover:bg-[#F1EBE1]"
              >
                Explore services
              </Link>
            </div>

            <div className="mt-14 grid grid-cols-3 gap-8 max-w-lg">
              {[
                { k: "12k+", v: "Happy pets" },
                { k: "8", v: "Cities live" },
                { k: "4.9★", v: "Avg rating" },
              ].map((s) => (
                <div key={s.v}>
                  <div className="font-serif-display text-4xl">{s.k}</div>
                  <div className="text-xs uppercase tracking-widest text-[#5C7365] mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden border border-[#E5DFD3]">
              <img src={HERO_IMG} alt="Pet grooming" className="w-full h-[520px] object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1E3F2D]/70 to-transparent p-6">
                <div className="bg-[#FDFBF7]/95 backdrop-blur rounded-2xl p-4 flex items-center gap-4 border border-[#E5DFD3]">
                  <div className="w-10 h-10 rounded-full bg-[#D96C4A] text-white flex items-center justify-center">
                    <Sparkles className="w-5 h-5" strokeWidth={1.75}/>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Next-day slots open</div>
                    <div className="text-xs text-[#5C7365]">10 AM – 8 PM • 7 days a week</div>
                  </div>
                  <Button
                    data-testid="hero-widget-book"
                    onClick={() => navigate("/book")}
                    className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white h-9 px-4 text-sm"
                  >
                    Book
                  </Button>
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -right-4 hidden md:block w-28 h-28 rounded-full border border-[#1E3F2D]/20 slow-spin">
              <div className="w-2 h-2 rounded-full bg-[#D96C4A] absolute top-0 left-1/2 -translate-x-1/2"/>
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="border-y border-[#E5DFD3] bg-[#F1EBE1]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid md:grid-cols-4 gap-8">
          {[
            { icon: PawPrint, title: "Trained groomers", desc: "Vetted, background-checked & pet-first." },
            { icon: ShieldCheck, title: "Sanitised kit", desc: "Fresh tools & hypoallergenic products every session." },
            { icon: Clock, title: "On-time, at home", desc: "Zero cages, zero stress. Comfort of your home." },
            { icon: MapPin, title: "8 cities, growing", desc: "Metro coverage with local groomer teams." },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1E3F2D] text-[#FDFBF7] flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4" strokeWidth={1.75}/>
              </div>
              <div>
                <div className="font-medium">{f.title}</div>
                <div className="text-sm text-[#5C7365] mt-1">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-3">Our services</div>
            <h2 className="font-serif-display text-4xl sm:text-5xl">Grooming packages</h2>
            <p className="text-[#5C7365] mt-3 max-w-xl">
              From a quick bath to a full deluxe spa. Prices vary by city — final pricing shown at checkout.
            </p>
          </div>
          <Button
            data-testid="services-cta-book"
            onClick={() => navigate("/book")}
            className="rounded-full bg-[#D96C4A] hover:bg-[#c65e3e] text-white h-11 px-6"
          >
            Book now
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, idx) => (
            <article
              key={s.service_id}
              data-testid={`service-card-${s.service_id}`}
              className="rounded-3xl overflow-hidden border border-[#E5DFD3] bg-[#FDFBF7] hover-lift group"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={s.image_url || [IMG_A, IMG_B, IMG_C, IMG_D][idx % 4]}
                  alt={s.name}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="pill text-[#1E3F2D] border-[#E5DFD3]">
                    {s.pet_type === "dog" ? "🐶 Dog" : "🐱 Cat"}
                  </span>
                  <span className="pill text-[#1E3F2D] border-[#E5DFD3]">
                    <Clock className="w-3 h-3" strokeWidth={1.75}/> {s.duration_minutes}m
                  </span>
                </div>
                <h3 className="font-serif-display text-2xl">{s.name}</h3>
                <p className="text-sm text-[#5C7365] mt-2 min-h-[54px]">{s.description}</p>
                <div className="mt-5 flex items-center justify-between">
                  <div className="text-[#5C7365] text-xs">Starting at</div>
                  <div className="font-serif-display text-2xl">{formatINR(s.base_price)}</div>
                </div>
              </div>
            </article>
          ))}
          {services.length === 0 && (
            <div className="col-span-full text-center text-[#5C7365] py-16">Loading services…</div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-[#1E3F2D] text-[#FDFBF7]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <div className="text-xs uppercase tracking-[0.25em] text-[#FDFBF7]/60 mb-3">How it works</div>
            <h2 className="font-serif-display text-4xl sm:text-5xl">Four gentle steps.</h2>
            <p className="text-[#FDFBF7]/70 mt-4 max-w-md">
              We keep the process calm, transparent and delightful — for both you and your companion.
            </p>
            <img src={IMG_D} alt="Puppy" className="mt-10 rounded-3xl border border-white/10 aspect-[4/3] w-full object-cover" />
          </div>
          <ol className="lg:col-span-7 grid sm:grid-cols-2 gap-6">
            {[
              { t: "Pick your city", d: "We serve 8 Indian metros with more coming soon.", n: "01" },
              { t: "Choose services", d: "Bath, full groom, deluxe spa, nails and more.", n: "02" },
              { t: "Select a slot", d: "Same-day or plan up to two weeks ahead.", n: "03" },
              { t: "We arrive, they relax", d: "Our groomer arrives on time with everything needed.", n: "04" },
            ].map((s) => (
              <li key={s.n} className="border border-white/10 rounded-3xl p-6 bg-white/5 hover-lift">
                <div className="font-serif-display text-4xl text-[#D96C4A]">{s.n}</div>
                <div className="font-medium mt-2">{s.t}</div>
                <div className="text-sm text-white/70 mt-1">{s.d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CITIES */}
      <section id="cities" className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-3">Where we serve</div>
            <h2 className="font-serif-display text-4xl sm:text-5xl">Live across India&rsquo;s metros.</h2>
            <p className="text-[#5C7365] mt-4 max-w-md">
              Local teams, familiar accents and city-tuned pricing. Pick a city to see slot availability
              and applicable rates.
            </p>
          </div>
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cities.map((c) => (
              <button
                key={c.slug}
                data-testid={`city-chip-${c.slug}`}
                onClick={() => navigate(`/book?city=${c.slug}`)}
                className="text-left rounded-2xl border border-[#E5DFD3] bg-[#FDFBF7] p-5 hover-lift hover:border-[#1E3F2D]"
              >
                <div className="flex items-center gap-2 text-[#5C7365] text-xs uppercase tracking-widest mb-1">
                  <MapPin className="w-3 h-3" strokeWidth={1.75}/> India
                </div>
                <div className="font-serif-display text-2xl">{c.name}</div>
                <div className="text-xs text-[#5C7365] mt-1">
                  {c.multiplier > 1 ? `+${Math.round((c.multiplier - 1) * 100)}%` :
                    c.multiplier < 1 ? `-${Math.round((1 - c.multiplier) * 100)}%` : "Base pricing"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="bg-[#F1EBE1] border-y border-[#E5DFD3]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-24 text-center">
          <div className="flex items-center justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-[#D96C4A] text-[#D96C4A]" />)}
          </div>
          <p className="font-serif-display text-3xl sm:text-4xl leading-tight italic">
            &ldquo;My Beagle used to hate car rides to the parlour. PawGroom brought the parlour home —
            he actually looks forward to bath day now.&rdquo;
          </p>
          <div className="mt-6 text-sm text-[#5C7365]">Ananya S. — Bengaluru • Beagle mum to Miso</div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 text-center">
        <h2 className="font-serif-display text-4xl sm:text-5xl">Ready to spoil them?</h2>
        <p className="text-[#5C7365] mt-3 max-w-md mx-auto">
          Two minutes to book. A whole afternoon of joy.
        </p>
        <Button
          data-testid="footer-cta-book"
          onClick={() => navigate("/book")}
          className="rounded-full bg-[#D96C4A] hover:bg-[#c65e3e] text-white h-12 px-8 mt-8 hover-lift"
        >
          Book a session <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.75}/>
        </Button>
      </section>
    </main>
  );
}
