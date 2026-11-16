import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Search,
  ShoppingBag,
  Heart,
  UserRound,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Minus,
  Truck,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  X,
  MessageCircle,
  ChevronRight,
  Check,
  Menu,
} from "lucide-react";
import {
  api,
  useData,
  useSession,
  Loading,
  ErrorState,
  Empty,
  AuthPage,
  Protected,
  money,
  date,
  Badge,
  Modal,
  Field,
  qc,
} from "./core";
type BagItem = {
  productId: string;
  quantity: number;
  name: string;
  image: string;
  price: number;
};
function readBag(): BagItem[] {
  try {
    return JSON.parse(localStorage.getItem("climo-bag") || "[]");
  } catch {
    return [];
  }
}
function writeBag(items: BagItem[]) {
  localStorage.setItem("climo-bag", JSON.stringify(items));
  window.dispatchEvent(new Event("bag-change"));
}
function useBag() {
  const [items, set] = useState(readBag);
  useEffect(() => {
    const f = () => set(readBag());
    window.addEventListener("bag-change", f);
    return () => window.removeEventListener("bag-change", f);
  }, []);
  return { items, update: writeBag };
}
function addToBag(p: any, quantity = 1) {
  const items = readBag(),
    existing = items.find((i) => i.productId === p.id);
  if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
  else
    items.push({
      productId: p.id,
      quantity,
      name: p.name,
      image: p.images[0],
      price:
        p.effectivePrice ??
        Math.round((p.price * (10000 - (p.promoBps || 0))) / 10000),
    });
  writeBag(items);
}
function Header() {
  const { user, run } = useSession();
  const { items } = useBag();
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  return (
    <>
      <div className="announcement">
        A little welcome gift. Use WELCOME10 on your first eligible order{" "}
        <span>
          Discover more <ArrowUpRight size={12} />
        </span>
      </div>
      <header className="store-header">
        <Link className="wordmark" to="/">
          climo<span>.</span>
        </Link>
        <nav className={menu ? "open" : ""}>
          <NavLink to="/shop">All sarees</NavLink>
          <Link to="/shop?search=silk">Silk stories</Link>
          <Link to="/shop?search=everyday">Everyday edit</Link>
          <Link to="/shop?search=wedding">The wedding edit</Link>
          <Link to="/page/about">Our story</Link>
        </nav>
        <div className="header-actions">
          <button aria-label="Search sarees" onClick={() => nav("/shop")}>
            <Search size={20} />
          </button>
          <Link aria-label="Wishlist" to="/wishlist">
            <Heart size={20} />
          </Link>
          <Link aria-label="Your account" to={user ? "/account" : "/login"}>
            <UserRound size={20} />
          </Link>
          <Link aria-label="Shopping bag" className="bag-icon" to="/bag">
            <ShoppingBag size={20} />
            {items.length > 0 && (
              <b>{items.reduce((n, i) => n + i.quantity, 0)}</b>
            )}
          </Link>
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </header>
    </>
  );
}
function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <div>
          <Link to="/" className="wordmark">
            climo.
          </Link>
          <p>
            A saree for every version of you.
            <br />A story in every thread.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/shop">All sarees</Link>
          <Link to="/shop?search=silk">Silk collection</Link>
          <Link to="/shop?search=cotton">Everyday cotton</Link>
          <Link to="/wishlist">Your wishlist</Link>
        </div>
        <div>
          <h4>Here to help</h4>
          <Link to="/page/shipping">Shipping</Link>
          <Link to="/page/returns">Returns & exchanges</Link>
          <Link to="/page/faq">FAQs</Link>
          <Link to="/support">Contact us</Link>
        </div>
        <div>
          <h4>Made for makers</h4>
          <p>
            Independent sellers.
            <br />
            One shared love of sarees.
          </p>
          <a href="http://localhost:5174">Seller workspace ↗</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Climo. Woven with intention.</span>
        <div>
          <Link to="/page/privacy">Privacy</Link>
          <Link to="/page/terms">Terms</Link>
        </div>
        <span className="fine">
          Development collection · illustrated samples
        </span>
      </div>
    </footer>
  );
}
function ProductCard({ p }: { p: any }) {
  const { run, user, notify } = useSession();
  const price =
    p.effectivePrice ??
    Math.round((p.price * (10000 - (p.promoBps || 0))) / 10000);
  return (
    <article className="product-card">
      <Link to={"/product/" + p.id} className="product-image">
        <img
          src={p.images[0]}
          alt={`${p.name} — sample textile illustration`}
          loading="lazy"
        />
        {p.stock - p.reserved === 0 ? (
          <span className="product-label">Awaiting a new weave</span>
        ) : (
          <span className="product-label">
            {Math.round((1 - price / p.mrp) * 100)}% off
          </span>
        )}
      </Link>
      <button
        aria-label={"Save " + p.name}
        className="heart"
        onClick={() =>
          user
            ? run(
                () => api("/me/wishlist/" + p.id, "POST"),
                "Saved to your wishlist",
              )
            : notify("Sign in to save your favourites", true)
        }
      >
        <Heart size={18} />
      </button>
      <div className="product-info">
        <div className="product-meta">
          {p.color} · {p.occasion}
        </div>
        <Link to={"/product/" + p.id}>
          <h3>{p.name}</h3>
        </Link>
        <div className="price">
          <strong>{money(price)}</strong>
          <del>{money(p.mrp)}</del>
          <span></span>
        </div>
      </div>
    </article>
  );
}
function Home() {
  const products = useData("/products"),
    banners = useData("/banners"),
    meta = useData("/catalog/meta");
  const hero = banners.data?.find((b: any) => b.position === "HERO");
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="line" /> THE CLIMO COLLECTION
          </div>
          <h1>{hero?.title || "Every drape,\na different story."}</h1>
          <p>
            {hero?.subtitle ||
              "A considered collection of sarees, from everyday rituals to once-in-a-lifetime moments."}
          </p>
          <Link className="button" to={hero?.destination || "/shop"}>
            {hero?.cta || "Explore the collection"} <ArrowUpRight size={18} />
          </Link>
          <div className="hero-note">
            <span>01 — 03</span>
            <i />
            <small>
              Rooted in tradition.
              <br />
              Styled for today.
            </small>
          </div>
        </div>
        <div className="hero-visual">
          <img
            src={hero?.image || "/art/hero.svg"}
            alt="Illustrated rose saree with a gold woven border"
          />
          <div className="hero-caption">
            <span>THE FESTIVE EDIT</span>
            <strong>
              A little colour.
              <br />A lot of you.
            </strong>
            <Link to="/shop?search=festive" aria-label="Shop festive sarees">
              <ArrowUpRight />
            </Link>
          </div>
        </div>
      </section>
      <div className="trust-strip">
        <span>
          <Truck size={19} /> Thoughtful doorstep delivery
        </span>
        <span>
          <ShieldCheck size={19} /> Reviewed sellers & collections
        </span>
        <span>
          <RefreshCw size={19} /> Returns & exchanges supported
        </span>
        <span>More than a saree. A feeling.</span>
      </div>
      <section className="section">
        <div className="section-row">
          <div>
            <div className="eyebrow">FIND YOUR WEAVE</div>
            <h2>A world of beautiful possibilities.</h2>
          </div>
          <Link className="text-link" to="/shop">
            View all collections <ArrowRight size={17} />
          </Link>
        </div>
        <div className="category-grid">
          {(meta.data || [])
            .filter((t: any) => t.kind === "CATEGORY")
            .slice(0, 6)
            .map((t: any, i: number) => (
              <Link key={t.id} to={"/shop?category=" + t.id}>
                <div className="category-art">
                  <img
                    src={
                      "/art/" +
                      ["rose", "ivory", "plum", "emerald", "sage", "indigo"][
                        i
                      ] +
                      ".svg"
                    }
                    alt=""
                  />
                </div>
                <h3>{t.name}</h3>
                <span>
                  Explore <ArrowUpRight size={12} />
                </span>
              </Link>
            ))}
        </div>
      </section>
      <section className="section arrivals">
        <div className="section-row">
          <div>
            <div className="eyebrow">YOUR NEXT FAVOURITE</div>
            <h2>Fresh from the loom.</h2>
          </div>
          <Link className="text-link" to="/shop">
            Shop new arrivals <ArrowRight size={17} />
          </Link>
        </div>
        {products.isLoading ? (
          <Loading />
        ) : products.error ? (
          <ErrorState error={products.error} />
        ) : (
          <div className="product-grid">
            {products.data?.items.slice(0, 4).map((p: any) => (
              <ProductCard p={p} key={p.id} />
            ))}
          </div>
        )}
      </section>
      <section className="editorial">
        <div>
          <span className="eyebrow">THE EVERYDAY EDIT</span>
          <h2>
            For the moments
            <br />
            that make a life.
          </h2>
          <p>
            Unhurried mornings. Familiar streets. A favourite cup of chai.
            <br />
            Discover sarees that feel beautifully like you.
          </p>
          <Link className="button secondary" to="/shop?search=cotton">
            Meet your everyday favourites <ArrowRight size={17} />
          </Link>
        </div>
        <img src="/art/ivory.svg" alt="Ivory textile illustration" />
        <img src="/art/mustard.svg" alt="Mustard textile illustration" />
      </section>
      <section className="brand-note">
        <span className="eyebrow">CONSIDERED, NOT COMPLICATED</span>
        <h2>
          Good threads. Great stories.
          <br />
          And a little everyday magic.
        </h2>
        <Link to="/page/about" className="text-link">
          Get to know Climo <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
function Shop() {
  const [params, setParams] = useSearchParams();
  const meta = useData("/catalog/meta");
  const query = useData("/products?" + params.toString());
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    p.delete("page");
    setParams(p);
  };
  return (
    <main className="section shop">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        All sarees
      </div>
      <div className="section-row">
        <div>
          <div className="eyebrow">THE COMPLETE COLLECTION</div>
          <h1>A weave for every you.</h1>
          <p>Find the colour, texture and feeling you’ve been looking for.</p>
        </div>
        <span className="muted">
          {query.data?.total ?? "…"} considered pieces
        </span>
      </div>
      <div className="shop-layout">
        <aside className="filters">
          <h4>
            <SlidersHorizontal size={16} /> Refine your collection
          </h4>
          <label className="field">
            <span>Search</span>
            <div className="search-field">
              <Search size={16} />
              <input
                placeholder="Silk, rose, wedding…"
                value={params.get("search") || ""}
                onChange={(e) => set("search", e.target.value)}
              />
            </div>
          </label>
          <label className="field">
            <span>Weave / category</span>
            <select
              value={params.get("category") || ""}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">All sarees</option>
              {meta.data
                ?.filter((t: any) => t.kind === "CATEGORY")
                .map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Fabric</span>
            <select
              value={params.get("fabric") || ""}
              onChange={(e) => set("fabric", e.target.value)}
            >
              <option value="">All fabrics</option>
              {meta.data
                ?.filter((t: any) => t.kind === "FABRIC")
                .map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Price range</span>
            <select
              value={params.get("max") || ""}
              onChange={(e) => set("max", e.target.value)}
            >
              <option value="">Any price</option>
              <option value="199900">Under ₹1,999</option>
              <option value="299900">Under ₹2,999</option>
              <option value="499900">Under ₹4,999</option>
            </select>
          </label>
          <button className="text-button" onClick={() => setParams({})}>
            Clear all filters
          </button>
          <div className="filter-note">
            A little help choosing?
            <p>Search by colour, fabric or occasion with our catalog finder.</p>
          </div>
        </aside>
        <div>
          <div className="sort-row">
            <span>
              {params.get("search")
                ? "Results for “" + params.get("search") + "”"
                : "All things beautiful"}
            </span>
            <select
              aria-label="Sort products"
              value={params.get("sort") || "newest"}
              onChange={(e) => set("sort", e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error} />
          ) : query.data.items.length ? (
            <>
              <div className="product-grid three">
                {query.data.items.map((p: any) => (
                  <ProductCard p={p} key={p.id} />
                ))}
              </div>
              {query.data.total > 24 && (
                <div className="actions">
                  <button
                    disabled={Number(params.get("page") || 1) === 1}
                    onClick={() => {
                      params.set(
                        "page",
                        String(Number(params.get("page") || 1) - 1),
                      );
                      setParams(params);
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={
                      Number(params.get("page") || 1) * 24 >= query.data.total
                    }
                    onClick={() => {
                      params.set(
                        "page",
                        String(Number(params.get("page") || 1) + 1),
                      );
                      setParams(params);
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty
              title="A different thread, perhaps?"
              body="Try another search or clear your filters."
            />
          )}
        </div>
      </div>
    </main>
  );
}
function Product() {
  const { id } = useParams();
  const query = useData("/products/" + id),
    { run, user, notify } = useSession();
  const [image, setImage] = useState(0),
    [quantity, setQuantity] = useState(1),
    [zoom, setZoom] = useState(false);
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const p = query.data;
  return (
    <main className="section">
      <div className="breadcrumb">
        <Link to="/shop">The collection</Link>
        <ChevronRight size={12} />
        {p.name}
      </div>
      <div className="product-detail">
        <div>
          <button
            className="detail-image"
            onClick={() => setZoom(true)}
            aria-label="Zoom product illustration"
          >
            <img src={p.images[image]} alt={p.name} />
          </button>
          <div className="thumbnails">
            {p.images.map((src: string, i: number) => (
              <button key={src} onClick={() => setImage(i)}>
                <img src={src} alt={"View " + (i + 1)} />
              </button>
            ))}
          </div>
          <p className="fine">
            Sample textile illustration. Replace with verified product
            photography before launch.
          </p>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{p.seller.businessName}</span>
          <h1>{p.name}</h1>
          <p>
            {p.color} · {p.occasion}
          </p>
          <div className="price large">
            <strong>{money(p.effectivePrice)}</strong>
            <del>{money(p.mrp)}</del>
            <Badge
              value={Math.round((1 - p.effectivePrice / p.mrp) * 100) + "% OFF"}
            />
          </div>
          <p className="fine">
            Shipping and eligible coupons calculated before payment.
          </p>
          <hr />
          <p>{p.description}</p>
          <div className="swatch-row">
            <span
              style={{
                background: (
                  {
                    Rose: "#a75566",
                    Emerald: "#23584c",
                    Ivory: "#d5c2a1",
                    Plum: "#58344f",
                    Mustard: "#b18738",
                    Sage: "#879b80",
                    Indigo: "#3e536f",
                    Terracotta: "#ab593e",
                  } as any
                )[p.color],
              }}
            />{" "}
            {p.color}
          </div>
          <div className="buy-row">
            {p.available > 0 ? (
              <>
                <div className="quantity">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus size={14} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQuantity(Math.min(p.available, 20, quantity + 1))
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  className="button"
                  onClick={() => {
                    addToBag(p, quantity);
                    notify("Added to your bag");
                  }}
                >
                  Add to bag <ShoppingBag size={18} />
                </button>
              </>
            ) : (
              <button
                className="button"
                onClick={() =>
                  run(
                    () =>
                      api("/me/stock-requests", "POST", {
                        productId: p.id,
                        quantity,
                      }),
                    "Availability requested",
                  )
                }
              >
                Out of stock — request availability
              </button>
            )}
            <button
              className="button secondary square"
              aria-label="Add to wishlist"
              onClick={() =>
                run(
                  () => api("/me/wishlist/" + p.id, "POST"),
                  "Saved to wishlist",
                )
              }
            >
              <Heart size={19} />
            </button>
          </div>
          <div className="detail-benefits">
            <span>
              <ShieldCheck size={17} /> Approved seller
            </span>
            <span>
              <RefreshCw size={17} /> Eligible returns
            </span>
          </div>
          <details open>
            <summary>The finer details</summary>
            <dl>
              {Object.entries(p.attributes)
                .filter(([k]) => k !== "sample")
                .map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
                    <dd>{String(v)}</dd>
                  </React.Fragment>
                ))}
            </dl>
          </details>
          <details>
            <summary>Care & delivery</summary>
            <p>
              {p.attributes.washCare}. Delivery updates will appear in your
              order after shipment. Returns are subject to the policy and item
              eligibility.
            </p>
            <Link to="/page/returns">Read return policy</Link>
          </details>
        </div>
      </div>
      <section className="section reviews">
        <h2>Stories from the collection.</h2>
        {p.reviews.length ? (
          p.reviews.map((r: any) => (
            <article className="card" key={r.id}>
              <span>{"★".repeat(r.rating)} · Verified purchase</span>
              <p>{r.body}</p>
            </article>
          ))
        ) : (
          <p>
            No published reviews yet. A delivered purchase is required to
            review.
          </p>
        )}
        {user && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(
                () =>
                  api("/products/" + p.id + "/reviews", "POST", {
                    rating: Number(f.get("rating")),
                    body: f.get("body"),
                  }),
                "Review submitted for moderation",
              );
            }}
          >
            <select name="rating" aria-label="Rating">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} stars
                </option>
              ))}
            </select>
            <input
              name="body"
              required
              minLength={10}
              placeholder="Share your experience…"
            />
            <button className="button secondary">Review</button>
          </form>
        )}
        <h3>Questions about this saree</h3>
        {p.questions.map((q: any) => (
          <p key={q.id}>
            <strong>{q.question}</strong>
            <br />
            {q.answer || "Awaiting a seller response"}
          </p>
        ))}
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                api("/products/" + p.id + "/questions", "POST", {
                  question: f.get("question"),
                }),
              "Question submitted",
            );
          }}
        >
          <input
            name="question"
            minLength={5}
            required
            placeholder="Ask about the weave, blouse or care…"
          />
          <button className="button secondary">Ask a question</button>
        </form>
      </section>
      {zoom && (
        <Modal title={p.name} onClose={() => setZoom(false)}>
          <img style={{ width: "100%" }} src={p.images[image]} alt={p.name} />
        </Modal>
      )}
    </main>
  );
}
function Bag() {
  const { items, update } = useBag();
  const { user, run, notify } = useSession();
  const [coupon, setCoupon] = useState(""),
    [quote, setQuote] = useState<any>(null),
    [address, setAddress] = useState(""),
    [busy, setBusy] = useState(false);
  const [key, setKey] = useState(crypto.randomUUID());
  const addresses = useData("/me/addresses", !!user),
    nav = useNavigate();
  useEffect(() => {
    setQuote(null);
    setKey(crypto.randomUUID());
  }, [items, coupon, address]);
  const payload = {
    items: items.map(({ productId, quantity }) => ({ productId, quantity })),
    coupon: coupon || undefined,
  };
  const quoteNow = async () => {
    const q = await run(() => api("/cart/quote", "POST", payload), "");
    if (q) setQuote(q);
    return q;
  };
  if (!items.length)
    return (
      <Empty
        title="Your next story is waiting."
        body="Find something beautiful for your bag."
      >
        <Link className="button" to="/shop">
          Explore sarees <ArrowRight size={17} />
        </Link>
      </Empty>
    );
  return (
    <main className="section">
      <div className="eyebrow">THOUGHTFULLY CHOSEN</div>
      <h1>Your shopping bag.</h1>
      <div className="checkout-layout">
        <div>
          {items.map((item) => (
            <article className="bag-item" key={item.productId}>
              <Link to={"/product/" + item.productId}>
                <img src={item.image} alt={item.name} />
              </Link>
              <div>
                <h3>{item.name}</h3>
                <p>
                  {money(item.price)}{" "}
                  <span className="fine">Last viewed price</span>
                </p>
                <div className="quantity">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() =>
                      update(
                        items.map((i) =>
                          i === item
                            ? { ...i, quantity: Math.max(1, i.quantity - 1) }
                            : i,
                        ),
                      )
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    aria-label="Increase quantity"
                    onClick={() =>
                      update(
                        items.map((i) =>
                          i === item
                            ? { ...i, quantity: Math.min(20, i.quantity + 1) }
                            : i,
                        ),
                      )
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <button
                className="icon-button"
                aria-label={"Remove " + item.name}
                onClick={() => update(items.filter((i) => i !== item))}
              >
                <X size={18} />
              </button>
            </article>
          ))}
          {user && (
            <>
              <h3>Delivery address</h3>
              {addresses.data?.map((a: any) => (
                <label
                  className={
                    "address-card " + (address === a.id ? "selected" : "")
                  }
                  key={a.id}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={address === a.id}
                    onChange={() => setAddress(a.id)}
                  />
                  <span>
                    <strong>{a.name}</strong>
                    <br />
                    {a.line1}, {a.city}, {a.state} — {a.pincode}
                    <br />
                    {a.phone}
                  </span>
                </label>
              ))}
              <AddressForm onSaved={(a: any) => setAddress(a.id)} />
            </>
          )}
        </div>
        <aside className="order-summary">
          <h2>A beautiful choice.</h2>
          <div className="coupon-input">
            <input
              placeholder="Have a welcome code?"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            />
            <button onClick={quoteNow}>Apply</button>
          </div>
          {quote ? (
            <>
              <div className="summary-line">
                <span>Merchandise</span>
                <span>{money(quote.subtotal)}</span>
              </div>
              <div className="summary-line">
                <span>Coupon savings</span>
                <span>−{money(quote.discount)}</span>
              </div>
              <div className="summary-line">
                <span>Shipping</span>
                <span>
                  {quote.shipping ? money(quote.shipping) : "Complimentary"}
                </span>
              </div>
              <hr />
              <div className="summary-line total">
                <span>Total</span>
                <span>{money(quote.total)}</span>
              </div>
            </>
          ) : (
            <p>
              Prices, stock, coupons and shipping are validated before payment.
            </p>
          )}
          <button
            className="button full"
            disabled={busy}
            onClick={async () => {
              if (!user) {
                nav("/login");
                return;
              }
              if (!address) {
                notify("Choose a delivery address", true);
                return;
              }
              setBusy(true);
              try {
                const q = await quoteNow();
                if (!q) return;
                const order = await api("/checkout", "POST", {
                  ...payload,
                  addressId: address,
                  key,
                });
                const payment = await api(
                  "/orders/" + order.id + "/payment",
                  "POST",
                );
                await loadRazorpay();
                const Razorpay = (window as any).Razorpay;
                new Razorpay({
                  ...payment,
                  handler: async (response: any) => {
                    await run(
                      () =>
                        api("/payments/verify", "POST", {
                          orderId: order.id,
                          ...response,
                        }),
                      "Payment verification submitted",
                    );
                    update([]);
                    nav("/orders");
                  },
                  modal: {
                    ondismiss: () =>
                      notify(
                        "Payment is pending. Your reservation expires after 15 minutes.",
                      ),
                  },
                }).open();
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? "Preparing secure payment…"
              : user
                ? "Continue to payment"
                : "Sign in to checkout"}{" "}
            <ArrowRight size={18} />
          </button>
          <button className="text-button" onClick={quoteNow}>
            Refresh price breakdown
          </button>
          <p className="fine">
            <ShieldCheck size={13} /> Online payments only. Your order is
            confirmed after gateway verification.
          </p>
        </aside>
      </div>
    </main>
  );
}
async function loadRazorpay() {
  if ((window as any).Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("Could not load secure payment. Please retry later."));
    document.body.appendChild(s);
  });
}
function AddressForm({ onSaved }: { onSaved?: (a: any) => void }) {
  const { run } = useSession();
  return (
    <details className="address-form">
      <summary>Add a new address</summary>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const result = await run(
            () =>
              api(
                "/me/addresses",
                "POST",
                Object.fromEntries(new FormData(form)),
              ),
            "Address saved",
          );
          if (result) {
            form.reset();
            onSaved?.(result);
          }
        }}
      >
        {[
          ["name", "Recipient name"],
          ["phone", "Mobile number"],
          ["line1", "Street address"],
          ["city", "City"],
          ["state", "State"],
          ["pincode", "Pincode"],
        ].map(([name, label]) => (
          <Field key={name} name={name} label={label} required />
        ))}
        <button className="button secondary">Save address</button>
      </form>
    </details>
  );
}
function Orders() {
  const q = useData("/me/orders");
  const { run } = useSession();
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  return (
    <main className="section narrow">
      <span className="eyebrow">FROM OUR LOOMS TO YOUR DOOR</span>
      <h1>Your orders.</h1>
      {!q.data.length ? (
        <Empty
          title="Your story starts here."
          body="Your orders will appear here after checkout."
        >
          <Link to="/shop" className="button">
            Explore the collection
          </Link>
        </Empty>
      ) : (
        q.data.map((o: any) => (
          <article className="order-card" key={o.id}>
            <div className="section-row">
              <div>
                <strong>Order #{o.id.slice(0, 8)}</strong>
                <p className="fine">{date(o.createdAt)}</p>
              </div>
              <div>
                <Badge value={o.status} />
                <Badge value={o.paymentStatus} />
              </div>
              <strong>{money(o.total)}</strong>
            </div>
            {o.suborders.map((s: any) => (
              <div className="suborder" key={s.id}>
                <div className="section-row">
                  <span>{s.seller.businessName}</span>
                  <Badge value={s.status} />
                </div>
                {s.items.map((i: any) => (
                  <div className="order-item" key={i.id}>
                    <img src={i.snapshot.image} alt="" />
                    <div>
                      <Link to={"/product/" + i.productId}>
                        <h3>{i.snapshot.name}</h3>
                      </Link>
                      <span>
                        Qty {i.quantity} ·{" "}
                        {money(i.unitPrice * i.quantity - i.discount)}
                      </span>
                      {i.requests?.map((r: any) => (
                        <p key={r.id}>
                          <Badge value={r.status} /> {r.kind}
                        </p>
                      ))}
                    </div>
                    {s.status === "DELIVERED" &&
                      !i.requests?.some(
                        (r: any) => r.status !== "REJECTED",
                      ) && (
                        <button
                          className="text-button"
                          onClick={() => {
                            const kind = window.confirm(
                              "Choose OK for return, Cancel for exchange",
                            )
                              ? "RETURN"
                              : "EXCHANGE";
                            const reason = window.prompt(
                              "Please describe the reason (at least 10 characters)",
                            );
                            if (reason)
                              run(
                                () =>
                                  api("/me/after-sales", "POST", {
                                    itemId: i.id,
                                    kind,
                                    reason,
                                  }),
                                "Request submitted",
                              );
                          }}
                        >
                          Return / exchange
                        </button>
                      )}
                  </div>
                ))}
                {s.awb && (
                  <p>
                    Tracking reference: <strong>{s.awb}</strong>
                  </p>
                )}
                {s.tracking.length > 0 && (
                  <div className="timeline">
                    {s.tracking.map((t: any, i: number) => (
                      <span key={i}>
                        <Check size={12} />
                        {t.status.replaceAll("_", " ")}
                        <small>{date(t.at)}</small>
                      </span>
                    ))}
                  </div>
                )}
                <div className="actions">
                  {o.paymentStatus === "CAPTURED" && (
                    <a
                      className="text-link"
                      href={"/api/v1/orders/" + o.id + "/invoice/" + s.id}
                    >
                      Download receipt ↓
                    </a>
                  )}
                  {["CONFIRMED", "PROCESSING", "PACKED"].includes(s.status) && (
                    <button
                      className="text-button danger"
                      onClick={() =>
                        run(
                          () =>
                            api("/me/suborders/" + s.id + "/cancel", "POST"),
                          "Cancellation submitted; eligible refunds require Finance authorization",
                        )
                      }
                    >
                      Cancel before shipment
                    </button>
                  )}
                </div>
              </div>
            ))}
            {o.refunds.map((r: any) => (
              <p key={r.id}>
                Refund {money(r.amount)} <Badge value={r.status} />
              </p>
            ))}
          </article>
        ))
      )}
    </main>
  );
}
function Wishlist() {
  const q = useData("/me/wishlist");
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  return (
    <main className="section">
      <span className="eyebrow">SAVED FOR A BEAUTIFUL DAY</span>
      <h1>Your favourites.</h1>
      {q.data.length ? (
        <div className="product-grid">
          {q.data.map((i: any) => (
            <ProductCard key={i.productId} p={i.product} />
          ))}
        </div>
      ) : (
        <Empty
          title="Keep a little inspiration."
          body="Tap the heart on a saree to save it here."
        />
      )}
    </main>
  );
}
function Account() {
  const { user, run } = useSession();
  const notifications = useData("/me/notifications"),
    requests = useData("/stock-requests");
  return (
    <main className="section narrow">
      <span className="eyebrow">YOUR CLIMO</span>
      <h1>Hello, {user?.name}.</h1>
      <p>{user?.email}</p>
      <div className="account-links">
        <Link to="/orders">
          Your orders <ArrowUpRight />
        </Link>
        <Link to="/wishlist">
          Saved favourites <ArrowUpRight />
        </Link>
        <Link to="/support">
          Get in touch <ArrowUpRight />
        </Link>
      </div>
      <h2>Delivery addresses</h2>
      <AddressForm />
      <h2>Updates for you</h2>
      {notifications.data?.length ? (
        notifications.data.map((n: any) => (
          <div className="card" key={n.id}>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
          </div>
        ))
      ) : (
        <p>No notifications yet.</p>
      )}
      <h2>Availability requests</h2>
      {requests.data?.map((r: any) => (
        <div className="card" key={r.id}>
          <span>
            Request #{r.id.slice(0, 8)} · Qty {r.quantity}
          </span>{" "}
          <Badge value={r.status} />
          {r.response && (
            <p>
              {r.response.remarks} · {r.response.quantity} available ·{" "}
              {r.response.eta}
            </p>
          )}
        </div>
      ))}
      <div className="actions">
        <button
          className="button secondary"
          onClick={() =>
            run(
              () => api("/me/privacy-requests", "POST", { kind: "EXPORT" }),
              "Data export request submitted",
            )
          }
        >
          Request my data
        </button>
        <button
          className="text-button"
          onClick={() => run(() => api("/auth/logout", "POST"), "Signed out")}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
export function Support() {
  const q = useData("/tickets"),
    { run } = useSession();
  return (
    <div className="section narrow">
      <span className="eyebrow">WE’RE HERE TO HELP</span>
      <h1>A conversation away.</h1>
      <form
        className="card form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const result = await run(
            () =>
              api("/tickets", "POST", Object.fromEntries(new FormData(form))),
            "Support ticket created",
          );
          if (result) form.reset();
        }}
      >
        <Field
          name="subject"
          label="What can we help with?"
          minLength={5}
          required
        />
        <label className="field">
          <span>Tell us a little more</span>
          <textarea name="body" minLength={10} required rows={4} />
        </label>
        <button className="button">
          Start a conversation <ArrowRight size={17} />
        </button>
      </form>
      {q.error && <ErrorState error={q.error} />}
      <div className="ticket-list">
        {q.data?.map((t: any) => (
          <details key={t.id} className="card">
            <summary>
              {t.subject} <Badge value={t.status} />
            </summary>
            {t.messages.map((m: any) => (
              <p className="ticket-message" key={m.id}>
                {m.body}
                <small>{date(m.createdAt)}</small>
              </p>
            ))}
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    api("/tickets/" + t.id + "/messages", "POST", {
                      body: new FormData(e.currentTarget).get("body"),
                    }),
                  "Reply sent",
                );
              }}
            >
              <input name="body" placeholder="Your reply…" required />
              <button className="button secondary">Reply</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  );
}
function Page() {
  const { slug } = useParams(),
    q = useData("/pages/" + slug);
  return q.isLoading ? (
    <Loading />
  ) : q.error ? (
    <ErrorState error={q.error} />
  ) : (
    <main className="section prose">
      <span className="eyebrow">A NOTE FROM CLIMO</span>
      <h1>{q.data.title}</h1>
      <p style={{ whiteSpace: "pre-wrap" }}>{q.data.body}</p>
    </main>
  );
}
function Finder() {
  const [open, setOpen] = useState(false),
    [result, setResult] = useState<any>(null);
  const { run } = useSession();
  return (
    <>
      <button
        className="finder-toggle"
        onClick={() => setOpen(!open)}
        aria-label="Open catalog finder"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        <span>Find your weave</span>
      </button>
      {open && (
        <aside className="finder">
          <div className="eyebrow">YOUR CATALOG COMPANION</div>
          <h3>A little inspiration?</h3>
          <p>Search our live collection by colour, fabric or occasion.</p>
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const query = new FormData(e.currentTarget).get("query");
              const data = await run(
                () => api("/assistant/search", "POST", { query }),
                "",
              );
              if (data) setResult(data);
            }}
          >
            <input
              name="query"
              placeholder="Try rose or silk…"
              required
              minLength={2}
            />
            <button aria-label="Search catalog" className="icon-button">
              <ArrowRight />
            </button>
          </form>
          {result && (
            <>
              <p>{result.message}</p>
              {result.products.map((p: any) => (
                <Link
                  className="finder-result"
                  key={p.id}
                  to={"/product/" + p.id}
                  onClick={() => setOpen(false)}
                >
                  <img src={p.image} alt="" />
                  <span>
                    {p.name}
                    <br />
                    <strong>{money(p.price)}</strong>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </>
          )}
          <p className="fine">Live catalog search. AI chat is not connected.</p>
        </aside>
      )}
    </>
  );
}
export function Storefront() {
  const { user } = useSession();
  useEffect(() => {
    if (user) {
      const owner = localStorage.getItem("climo-bag-owner");
      if (owner && owner !== user.id) writeBag([]);
      localStorage.setItem("climo-bag-owner", user.id);
      api("/me/cart")
        .then((saved: any[]) => {
          const local = readBag();
          for (const row of saved)
            if (!local.some((i) => i.productId === row.productId))
              local.push({
                productId: row.productId,
                quantity: row.quantity,
                name: row.product.name,
                image: row.product.images[0],
                price: row.product.price,
              });
          writeBag(local);
        })
        .catch(() => {});
      const sync = () =>
        api("/me/cart", "PUT", {
          items: readBag().map(({ productId, quantity }) => ({
            productId,
            quantity,
          })),
        }).catch(() => {});
      window.addEventListener("bag-change", sync);
      return () => window.removeEventListener("bag-change", sync);
    } else if (user === null && localStorage.getItem("climo-bag-owner")) {
      writeBag([]);
      localStorage.removeItem("climo-bag-owner");
    }
  }, [user?.id]);
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:id" element={<Product />} />
        <Route path="/bag" element={<Bag />} />
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/orders"
          element={
            <Protected roles={["CUSTOMER"]}>
              <Orders />
            </Protected>
          }
        />
        <Route
          path="/wishlist"
          element={
            <Protected>
              <Wishlist />
            </Protected>
          }
        />
        <Route
          path="/account"
          element={
            <Protected>
              <Account />
            </Protected>
          }
        />
        <Route
          path="/support"
          element={
            <Protected>
              <Support />
            </Protected>
          }
        />
        <Route path="/page/:slug" element={<Page />} />
        <Route
          path="*"
          element={
            <Empty title="This thread leads elsewhere.">
              <Link to="/shop">Back to the collection</Link>
            </Empty>
          }
        />
      </Routes>
      <Footer />
      <Finder />
    </>
  );
}
