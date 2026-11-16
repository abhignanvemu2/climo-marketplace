import React, { useState } from "react";
import { Routes, Route, NavLink, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Store,
  Layers,
  Image,
  TicketPercent,
  ShoppingBag,
  RotateCcw,
  Wallet,
  ClipboardList,
  Settings,
  MessageCircle,
  LogOut,
  ChevronDown,
  ArrowUpRight,
  Plus,
  Search,
  Check,
  CheckCircle2,
  Clock,
  Shield,
  Star,
  FileText,
  Bell,
  Menu,
  X,
} from "lucide-react";
import {
  api,
  useData,
  useSession,
  Loading,
  ErrorState,
  Empty,
  Protected,
  AuthPage,
  money,
  date,
  Badge,
  Table,
  Modal,
  Field,
} from "./core";
import { Support } from "./storefront";
const adminNav = [
  ["", "Overview", LayoutDashboard],
  ["sellers", "Sellers", Store],
  ["customers", "Customers", ShoppingBag],
  ["products", "Catalog & approvals", Package],
  ["taxons", "Brands & categories", Layers],
  ["banners", "Banners", Image],
  ["pages", "Content pages", FileText],
  ["coupons", "Coupons", TicketPercent],
  ["commissions", "Commission rules", Wallet],
  ["orders", "Orders", ShoppingBag],
  ["after-sales", "Returns & exchanges", RotateCcw],
  ["stock", "Stock requests", ClipboardList],
  ["reviews", "Review moderation", Star],
  ["refunds", "Refunds", Wallet],
  ["settlements", "Settlements", Wallet],
  ["support", "Support", MessageCircle],
  ["audit", "Audit trail", Shield],
  ["settings", "Settings", Settings],
] as const;
const sellerNav = [
  ["", "Overview", LayoutDashboard],
  ["products", "My catalog", Package],
  ["orders", "Orders & fulfillment", ShoppingBag],
  ["stock", "Stock requests", ClipboardList],
  ["earnings", "Earnings", Wallet],
  ["profile", "Business profile", Store],
  ["support", "Support", MessageCircle],
] as const;
const financeNav = [
  ["", "Overview", LayoutDashboard],
  ["orders", "Payment visibility", ShoppingBag],
  ["refunds", "Refund authorization", RotateCcw],
  ["settlements", "Weekly settlements", Wallet],
  ["audit", "Financial audit", Shield],
] as const;
export function Workspace({ mode }: { mode: "seller" | "admin" }) {
  const { user, run } = useSession();
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  if (location.pathname === "/login") return <AuthPage portal={mode} />;
  const finance = user?.role === "FINANCE";
  const links = mode === "seller" ? sellerNav : finance ? financeNav : adminNav;
  return (
    <Protected roles={mode === "seller" ? ["SELLER"] : ["ADMIN", "FINANCE"]}>
      <div className="workspace">
        <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
          <Link to="/" className="wordmark">
            climo<span>.</span>
          </Link>
          <div className="workspace-switch">
            <span className="avatar">
              {mode === "seller" ? "L" : finance ? "F" : "C"}
            </span>
            <div>
              <strong>
                {mode === "seller"
                  ? "The seller studio"
                  : finance
                    ? "Finance workspace"
                    : "Climo marketplace"}
              </strong>
              <small>
                {mode === "seller"
                  ? "Seller portal"
                  : finance
                    ? "Restricted financial access"
                    : "Administration"}
              </small>
            </div>
            <ChevronDown size={14} />
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {links.map(([path, label, Icon]) => (
              <NavLink
                end={path === ""}
                key={path}
                to={"/" + path}
                onClick={() => setMobile(false)}
              >
                <Icon size={18} />
                {label}
                {path === "products" && <span className="nav-dot" />}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <a href="http://localhost:5173" target="_blank" rel="noreferrer">
              View storefront <ArrowUpRight size={16} />
            </a>
            <button
              onClick={() =>
                run(() => api("/auth/logout", "POST"), "Signed out")
              }
            >
              <LogOut size={16} /> Sign out
            </button>
            <div className="profile-chip">
              <span className="avatar dark">{user?.name?.[0]}</span>
              <div>
                <strong>{user?.name}</strong>
                <small>{user?.role.toLowerCase()}</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="workspace-header">
            <div>
              <button
                className="mobile-menu"
                aria-label="Toggle navigation"
                onClick={() => setMobile(!mobile)}
              >
                <Menu />
              </button>
              <span>Workspace</span> <span className="muted">/</span>{" "}
              <strong>
                {links.find(([p]) => "/" + p === location.pathname)?.[1] ||
                  "Overview"}
              </strong>
            </div>
            <div>
              <span className="environment">Development</span>
              <span className="header-divider" />
              <span>
                {new Date().toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <Bell size={18} />
            </div>
          </header>
          <div className="workspace-content">
            <Routes>
              <Route path="/" element={<Overview mode={mode} />} />
              <Route path="/products" element={<Products mode={mode} />} />
              <Route path="/orders" element={<Orders mode={mode} />} />
              <Route path="/sellers" element={<Sellers />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/taxons" element={<Configuration kind="taxons" />} />
              <Route
                path="/banners"
                element={<Configuration kind="banners" />}
              />
              <Route
                path="/coupons"
                element={<Configuration kind="coupons" />}
              />
              <Route
                path="/commissions"
                element={<Configuration kind="commissions" />}
              />
              <Route path="/pages" element={<Pages />} />
              <Route path="/profile" element={<SellerProfile />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/after-sales" element={<AfterSales />} />
              <Route path="/refunds" element={<Refunds />} />
              <Route path="/settlements" element={<Settlements />} />
              <Route path="/earnings" element={<Earnings />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/support" element={<Support />} />
              <Route path="*" element={<Empty title="Page not found" />} />
            </Routes>
          </div>
          <div className="workspace-footer">
            CLIMO WORKSPACE{" "}
            <span>Thoughtful commerce, from the inside out.</span>
          </div>
        </div>
      </div>
    </Protected>
  );
}
function PageHead({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
      {children}
    </div>
  );
}
function DataBoundary({ q, children }: { q: any; children: React.ReactNode }) {
  return q.isLoading ? (
    <Loading />
  ) : q.error ? (
    <ErrorState error={q.error} />
  ) : (
    <>{children}</>
  );
}
function Overview({ mode }: { mode: string }) {
  const { user } = useSession();
  const q = useData(mode === "seller" ? "/seller/products" : "/admin/overview"),
    orders = useData(mode === "seller" ? "/seller/orders" : "/admin/orders");
  const d = q.data;
  const stats =
    mode === "seller"
      ? [
          ["Products", d?.length || 0],
          [
            "Approved",
            d?.filter((p: any) => p.status === "APPROVED").length || 0,
          ],
          [
            "Pending review",
            d?.filter((p: any) => p.status === "PENDING").length || 0,
          ],
          [
            "Low stock",
            d?.filter((p: any) => p.stock - p.reserved < 5).length || 0,
          ],
        ]
      : [
          ["Gross merchandise", money(d?.gmv || 0)],
          ["Orders", d?.orders || 0],
          ["Active catalog", d?.products || 0],
          ["Awaiting review", d?.pending || 0],
        ];
  return (
    <>
      <PageHead
        eyebrow="A LITTLE PERSPECTIVE"
        title={"Good to see you, " + (user?.name || "there") + "."}
        body="Here’s what’s happening across your marketplace today."
      >
        <Link to="/products" className="button">
          Manage collection <ArrowUpRight size={16} />
        </Link>
      </PageHead>
      <DataBoundary q={q}>
        <div className="stats">
          {stats.map(([label, value], i) => (
            <div className="stat" key={label}>
              <div>
                <span>{label}</span>
                {
                  [
                    <Wallet size={17} />,
                    <ShoppingBag size={17} />,
                    <Package size={17} />,
                    <Clock size={17} />,
                  ][i]
                }
              </div>
              <strong>{value}</strong>
              <small>Based on current marketplace records</small>
            </div>
          ))}
        </div>
      </DataBoundary>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <h3>Recent orders</h3>
            <Link to="/orders" className="text-link">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <DataBoundary q={orders}>
            {orders.data?.length ? (
              <Table headers={["Order", "Placed", "Status", "Value"]}>
                {orders.data.slice(0, 6).map((o: any) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.id.slice(0, 8)}</strong>
                    </td>
                    <td>{date(o.createdAt || o.order?.createdAt)}</td>
                    <td>
                      <Badge value={o.status} />
                    </td>
                    <td>
                      {money(
                        o.total ?? o.merchandise - o.discount + o.shipping,
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty
                title="Ready for the first order."
                body="New orders appear here after customer checkout."
              />
            )}
          </DataBoundary>
        </section>
        <section className="panel next-steps">
          <div className="eyebrow">KEEP THINGS MOVING</div>
          <h2>
            A little care.
            <br />A better experience.
          </h2>
          {[
            [
              "products",
              "Review your collection",
              "Keep prices, images and stock up to date.",
            ],
            [
              mode === "seller" ? "profile" : "sellers",
              mode === "seller"
                ? "Complete your profile"
                : "Welcome your sellers",
              "Check the details that build trust.",
            ],
            [
              "support",
              "Be there for your customers",
              "A thoughtful reply goes a long way.",
            ],
          ].map(([url, title, body]) => (
            <Link to={"/" + url} key={url}>
              <span className="step-icon">
                <ArrowUpRight size={18} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </Link>
          ))}
        </section>
      </div>
      <div className="notice-panel">
        <Shield size={22} />
        <div>
          <strong>Operational control. Financial accountability.</strong>
          <p>
            Super Admin can review payments. Only independently provisioned
            Finance users can authorize refunds and weekly settlements.
          </p>
        </div>
      </div>
    </>
  );
}
function Products({ mode }: { mode: string }) {
  const q = useData(mode === "seller" ? "/seller/products" : "/admin/products");
  const [editing, setEditing] = useState<any>(undefined),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const { run } = useSession();
  return (
    <>
      <PageHead
        title={mode === "seller" ? "Your collection." : "Catalog & approvals."}
        body={
          mode === "seller"
            ? "Keep your sarees beautifully presented and ready to find their people."
            : "Review the details. Protect the standard. Publish with confidence."
        }
      >
        {mode === "seller" && (
          <button className="button" onClick={() => setEditing(null)}>
            <Plus size={17} /> Add a saree
          </button>
        )}
      </PageHead>
      <div className="panel">
        <div className="toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              placeholder="Search name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter product status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {["APPROVED", "PENDING", "REJECTED", "DISABLED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <DataBoundary q={q}>
          <Table
            headers={[
              "Product",
              "Price / MRP",
              "Available stock",
              "Status",
              "Actions",
            ]}
          >
            {q.data
              ?.filter(
                (p: any) =>
                  (p.name + " " + p.sku)
                    .toLowerCase()
                    .includes(search.toLowerCase()) &&
                  (!status || p.status === status),
              )
              .map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-product">
                      <img src={p.images[0]} alt="" />
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {p.sku} · {p.color}
                        </small>
                        {p.seller && <small>{p.seller.businessName}</small>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{money(p.price)}</strong>
                    <small>
                      <del>{money(p.mrp)}</del>
                    </small>
                  </td>
                  <td>
                    <strong
                      className={p.stock - p.reserved < 5 ? "danger" : ""}
                    >
                      {p.stock - p.reserved}
                    </strong>
                    <small>{p.reserved} reserved</small>
                  </td>
                  <td>
                    <Badge value={p.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {mode === "seller" ? (
                        <>
                          <button onClick={() => setEditing(p)}>Edit</button>
                          <button
                            onClick={() => {
                              const stock = window.prompt(
                                "New total stock, including reserved units",
                                String(p.stock),
                              );
                              if (stock === null) return;
                              const reason = window.prompt(
                                "Reason for adjustment",
                              );
                              if (reason)
                                run(
                                  () =>
                                    api(
                                      "/seller/products/" + p.id + "/stock",
                                      "POST",
                                      { stock: Number(stock), reason },
                                    ),
                                  "Stock updated with audit log",
                                );
                            }}
                          >
                            Stock
                          </button>
                          <button
                            onClick={() => {
                              const price = window.prompt(
                                "Proposed price in rupees",
                                String(p.price / 100),
                              );
                              if (price === null) return;
                              const mrp = window.prompt(
                                "Proposed MRP in rupees",
                                String(p.mrp / 100),
                              );
                              if (mrp)
                                run(
                                  () =>
                                    api(
                                      "/seller/products/" + p.id + "/price",
                                      "POST",
                                      {
                                        price: Math.round(Number(price) * 100),
                                        mrp: Math.round(Number(mrp) * 100),
                                      },
                                    ),
                                  "Price submitted for approval",
                                );
                            }}
                          >
                            Price request
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              run(
                                () =>
                                  api(
                                    "/admin/products/" + p.id + "/decision",
                                    "POST",
                                    {
                                      decision: "APPROVED",
                                      reason:
                                        "Reviewed product information and seller eligibility",
                                    },
                                  ),
                                "Product approved",
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = window.prompt(
                                "Reason for rejection",
                              );
                              if (reason)
                                run(
                                  () =>
                                    api(
                                      "/admin/products/" + p.id + "/decision",
                                      "POST",
                                      { decision: "REJECTED", reason },
                                    ),
                                  "Product rejected",
                                );
                            }}
                          >
                            Reject
                          </button>
                          <button
                            onClick={() =>
                              run(
                                () =>
                                  api(
                                    "/admin/products/" + p.id + "/decision",
                                    "POST",
                                    {
                                      decision: "DISABLED",
                                      reason: "Listing hidden by operations",
                                    },
                                  ),
                                "Listing disabled",
                              )
                            }
                          >
                            Hide
                          </button>
                          <button
                            onClick={() => {
                              const percent = window.prompt(
                                "Promotional discount percentage (0–90)",
                                String(p.promoBps / 100),
                              );
                              if (percent !== null)
                                run(
                                  () =>
                                    api(
                                      "/admin/products/" + p.id + "/promotion",
                                      "POST",
                                      {
                                        bps: Math.round(Number(percent) * 100),
                                      },
                                    ),
                                  "Promotion updated",
                                );
                            }}
                          >
                            Promotion
                          </button>
                        </>
                      )}
                    </div>
                    {p.priceRequests
                      ?.filter((r: any) => r.status === "PENDING")
                      .map((r: any) => (
                        <div className="pending-request" key={r.id}>
                          Price proposal: {money(r.proposedPrice)}
                          {mode === "admin" && (
                            <>
                              <button
                                onClick={() =>
                                  run(
                                    () =>
                                      api(
                                        "/admin/prices/" + r.id + "/decision",
                                        "POST",
                                        {
                                          approve: true,
                                          reason: "Price reviewed",
                                        },
                                      ),
                                    "Price approved",
                                  )
                                }
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  run(
                                    () =>
                                      api(
                                        "/admin/prices/" + r.id + "/decision",
                                        "POST",
                                        {
                                          approve: false,
                                          reason: "Price change declined",
                                        },
                                      ),
                                    "Price rejected",
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    {p.revisions
                      ?.filter((r: any) => r.status === "PENDING")
                      .map((r: any) => (
                        <div className="pending-request" key={r.id}>
                          Revision: {r.data.name}
                          {mode === "admin" && (
                            <>
                              <button
                                onClick={() =>
                                  run(
                                    () =>
                                      api(
                                        "/admin/revisions/" +
                                          r.id +
                                          "/decision",
                                        "POST",
                                        {
                                          approve: true,
                                          reason: "Content reviewed",
                                        },
                                      ),
                                    "Revision approved",
                                  )
                                }
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  run(
                                    () =>
                                      api(
                                        "/admin/revisions/" +
                                          r.id +
                                          "/decision",
                                        "POST",
                                        {
                                          approve: false,
                                          reason:
                                            "Please review product content",
                                        },
                                      ),
                                    "Revision rejected",
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                  </td>
                </tr>
              ))}
          </Table>
          {q.data?.length === 0 && (
            <Empty
              title="A fresh canvas."
              body="Add your first saree to start building the collection."
            />
          )}
        </DataBoundary>
      </div>
      {editing !== undefined && (
        <ProductEditor value={editing} close={() => setEditing(undefined)} />
      )}
    </>
  );
}
function ProductEditor({ value, close }: { value: any; close: () => void }) {
  const meta = useData("/catalog/meta"),
    { run } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={value ? "Propose a product revision" : "Add a saree"}
      onClose={close}
    >
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const d: any = Object.fromEntries(new FormData(e.currentTarget));
          d.images = d.images
            .split("\n")
            .map((s: string) => s.trim())
            .filter(Boolean);
          d.price = Math.round(Number(d.price) * 100);
          d.mrp = Math.round(Number(d.mrp) * 100);
          d.attributes = {
            length: d.length,
            blouseIncluded: d.blouseIncluded === "yes",
            washCare: d.washCare,
          };
          delete d.length;
          delete d.blouseIncluded;
          delete d.washCare;
          setBusy(true);
          const result = await run(
            () =>
              api(
                "/seller/products" +
                  (value ? "/" + value.id + "/revisions" : ""),
                "POST",
                d,
              ),
            "Submitted for product review",
          );
          setBusy(false);
          if (result) close();
        }}
      >
        <Field
          label="Saree name"
          name="name"
          defaultValue={value?.name}
          required
          minLength={5}
        />
        <Field
          label="Unique SKU"
          name="sku"
          defaultValue={value?.sku}
          required
        />
        {[
          ["categoryId", "CATEGORY", "Category"],
          ["brandId", "BRAND", "Brand"],
          ["fabricId", "FABRIC", "Fabric"],
        ].map(([name, kind, label]) => (
          <label className="field" key={name}>
            <span>{label}</span>
            <select name={name} required defaultValue={value?.[name] || ""}>
              <option value="">Select {label.toLowerCase()}</option>
              {meta.data
                ?.filter((t: any) => t.kind === kind)
                .map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
        ))}
        <Field
          label="Colour"
          name="color"
          defaultValue={value?.color}
          required
        />
        <Field
          label="Occasion"
          name="occasion"
          defaultValue={value?.occasion || "Everyday"}
          required
        />
        <Field
          label="Selling price (₹)"
          name="price"
          type="number"
          min="1"
          step="0.01"
          defaultValue={value ? value.price / 100 : ""}
          required
        />
        <Field
          label="MRP (₹)"
          name="mrp"
          type="number"
          min="1"
          step="0.01"
          defaultValue={value ? value.mrp / 100 : ""}
          required
        />
        <Field
          label="Saree length"
          name="length"
          defaultValue={value?.attributes?.length || "5.5 metres"}
          required
        />
        <label className="field">
          <span>Blouse included</span>
          <select name="blouseIncluded">
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <Field
          label="Wash care"
          name="washCare"
          defaultValue={value?.attributes?.washCare || "Dry clean"}
          required
        />
        <label className="field span-two">
          <span>Description</span>
          <textarea
            name="description"
            defaultValue={value?.description}
            rows={3}
            minLength={20}
            required
          />
        </label>
        <label className="field span-two">
          <span>Product image HTTPS URLs — one per line</span>
          <textarea
            name="images"
            defaultValue={value?.images?.join("\n")}
            rows={3}
            required
          />
          <small>
            Use verified hosted product images. Direct media upload is not
            connected.
          </small>
        </label>
        <button className="button span-two" disabled={busy}>
          {busy ? "Submitting…" : "Submit for approval"}
        </button>
      </form>
    </Modal>
  );
}
function Sellers() {
  const q = useData("/admin/sellers"),
    { run } = useSession();
  return (
    <>
      <PageHead
        title="The people behind the weave."
        body="Review businesses, verify details and manage seller eligibility."
      />
      <DataBoundary q={q}>
        <div className="panel">
          <Table headers={["Seller", "Verification", "Status", "Actions"]}>
            {q.data?.map((s: any) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.businessName}</strong>
                  <small>
                    {s.user.name} · {s.user.email}
                  </small>
                  <details>
                    <summary>Business details</summary>
                    <p>
                      {s.profile.businessAddress ||
                        "No business address submitted"}
                    </p>
                    <p>
                      {s.profile.phone} {s.profile.gstin}
                    </p>
                  </details>
                </td>
                <td>
                  <Badge value={s.verification} />
                </td>
                <td>
                  <Badge value={s.status} />
                </td>
                <td>
                  <select
                    aria-label={"Change status for " + s.businessName}
                    value=""
                    onChange={(e) => {
                      const status = e.target.value;
                      const reason = window.prompt(
                        "Reason for " + status.toLowerCase(),
                      );
                      if (reason)
                        run(
                          () =>
                            api("/admin/sellers/" + s.id + "/status", "POST", {
                              status,
                              reason,
                              verified: status === "ACTIVE",
                            }),
                          "Seller status updated",
                        );
                    }}
                  >
                    <option value="">Choose action…</option>
                    {[
                      "ACTIVE",
                      "INACTIVE",
                      "SUSPENDED",
                      "REJECTED",
                      "BLOCKED",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </DataBoundary>
    </>
  );
}
function Customers() {
  const q = useData("/admin/customers"),
    { run } = useSession();
  return (
    <>
      <PageHead
        title="Your customers."
        body="Manage customer access while preserving order history."
      />
      <DataBoundary q={q}>
        <Table headers={["Name", "Email", "Joined", "Access"]}>
          {q.data?.map((u: any) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{date(u.createdAt)}</td>
              <td>
                <button
                  onClick={() => {
                    const reason = window.prompt("Reason for access change");
                    if (reason)
                      run(
                        () =>
                          api("/admin/customers/" + u.id + "/status", "POST", {
                            active: !u.active,
                            reason,
                          }),
                        "Customer access updated",
                      );
                  }}
                >
                  {u.active ? "Deactivate" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </DataBoundary>
    </>
  );
}
function Orders({ mode }: { mode: string }) {
  const q = useData(mode === "seller" ? "/seller/orders" : "/admin/orders"),
    { run } = useSession();
  return (
    <>
      <PageHead
        title={
          mode === "seller"
            ? "From your loom to their door."
            : "Every order, in one place."
        }
        body="Follow fulfillment and review the payment record without changing gateway facts."
      />
      <DataBoundary q={q}>
        {q.data?.length === 0 && <Empty title="No orders yet." />}
        {q.data?.map((o: any) => (
          <div className="panel order-panel" key={o.id}>
            <div className="panel-heading">
              <div>
                <h3>#{o.id.slice(0, 8)}</h3>
                <small>{date(o.createdAt || o.order.createdAt)}</small>
              </div>
              <div>
                <Badge value={o.status} />
                {o.paymentStatus && <Badge value={o.paymentStatus} />}
              </div>
              <strong>
                {money(o.total ?? o.merchandise - o.discount + o.shipping)}
              </strong>
            </div>
            {(o.suborders || [o]).map((s: any) => (
              <div className="workspace-suborder" key={s.id}>
                <div className="section-row">
                  <strong>
                    {s.seller?.businessName || "Your fulfillment group"}
                  </strong>
                  <Badge value={s.status} />
                </div>
                {s.items.map((i: any) => (
                  <div className="order-item" key={i.id}>
                    <img src={i.snapshot.image} alt="" />
                    <div>
                      <strong>{i.snapshot.name}</strong>
                      <small>
                        {i.quantity} × {money(i.unitPrice)}
                      </small>
                    </div>
                  </div>
                ))}
                {s.awb && <p>AWB: {s.awb}</p>}
                {mode === "seller" && (
                  <div className="actions">
                    {(
                      {
                        CONFIRMED: "PROCESSING",
                        PROCESSING: "PACKED",
                        PACKED: "SHIPPED",
                        SHIPPED: "OUT_FOR_DELIVERY",
                        OUT_FOR_DELIVERY: "DELIVERED",
                      } as any
                    )[s.status] && (
                      <button
                        className="button secondary"
                        onClick={() => {
                          const status = (
                            {
                              CONFIRMED: "PROCESSING",
                              PROCESSING: "PACKED",
                              PACKED: "SHIPPED",
                              SHIPPED: "OUT_FOR_DELIVERY",
                              OUT_FOR_DELIVERY: "DELIVERED",
                            } as any
                          )[s.status];
                          const awb =
                            status === "SHIPPED"
                              ? window.prompt(
                                  "Enter the actual carrier tracking reference",
                                )
                              : undefined;
                          if (status === "SHIPPED" && !awb) return;
                          run(
                            () =>
                              api(
                                "/seller/orders/" + s.id + "/status",
                                "POST",
                                { status, awb },
                              ),
                            "Fulfillment updated",
                          );
                        }}
                      >
                        Move to{" "}
                        {
                          (
                            {
                              CONFIRMED: "processing",
                              PROCESSING: "packed",
                              PACKED: "shipped",
                              SHIPPED: "out for delivery",
                              OUT_FOR_DELIVERY: "delivered",
                            } as any
                          )[s.status]
                        }
                      </button>
                    )}
                    <p className="fine">
                      Seller-reported tracking. Courier integration is not
                      connected.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </DataBoundary>
    </>
  );
}
type Spec = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
  value?: any;
};
const configurations: Record<
  string,
  { title: string; body: string; fields: Spec[] }
> = {
  taxons: {
    title: "The building blocks.",
    body: "Only Super Admin can create brands, categories, fabrics and collections.",
    fields: [
      {
        name: "kind",
        label: "Record type",
        options: ["BRAND", "CATEGORY", "FABRIC", "COLLECTION"],
      },
      { name: "name", label: "Name" },
      { name: "slug", label: "URL slug" },
      { name: "active", label: "Active", type: "checkbox", value: true },
    ],
  },
  banners: {
    title: "Set the scene.",
    body: "Create, schedule and arrange storefront banners.",
    fields: [
      { name: "title", label: "Headline" },
      { name: "subtitle", label: "Supporting text" },
      { name: "image", label: "Desktop image HTTPS URL", type: "url" },
      {
        name: "mobileImage",
        label: "Mobile image HTTPS URL",
        type: "url",
        required: false,
      },
      { name: "cta", label: "Button text", value: "Explore the collection" },
      { name: "destination", label: "Destination path", value: "/shop" },
      {
        name: "position",
        label: "Position",
        options: ["HERO", "PROMO", "CATEGORY"],
      },
      { name: "sort", label: "Display order", type: "number", value: 0 },
      {
        name: "startAt",
        label: "Start date (optional)",
        type: "datetime-local",
        required: false,
      },
      {
        name: "endAt",
        label: "End date (optional)",
        type: "datetime-local",
        required: false,
      },
      { name: "active", label: "Active", type: "checkbox", value: true },
    ],
  },
  coupons: {
    title: "A little something extra.",
    body: "Create offers with clear eligibility, dates and redemption limits.",
    fields: [
      { name: "code", label: "Coupon code" },
      { name: "kind", label: "Discount type", options: ["PERCENT", "FIXED"] },
      { name: "value", label: "Discount value (% or ₹)", type: "number" },
      {
        name: "minSpend",
        label: "Minimum spend (₹)",
        type: "number",
        value: 0,
      },
      {
        name: "maxDiscount",
        label: "Discount cap (₹)",
        type: "number",
        required: false,
      },
      { name: "limit", label: "Total usage limit", type: "number", value: 100 },
      { name: "perUser", label: "Uses per customer", type: "number", value: 1 },
      { name: "startsAt", label: "Starts", type: "datetime-local" },
      { name: "endsAt", label: "Ends", type: "datetime-local" },
      { name: "firstOrder", label: "First order only", type: "checkbox" },
      { name: "active", label: "Active", type: "checkbox", value: true },
    ],
  },
  commissions: {
    title: "A fair share.",
    body: "Versioned rules use seller + category, seller, category, then platform precedence.",
    fields: [
      {
        name: "sellerId",
        label: "Seller ID (leave empty for all)",
        required: false,
      },
      {
        name: "categoryId",
        label: "Category ID (leave empty for all)",
        required: false,
      },
      { name: "kind", label: "Commission type", options: ["PERCENT", "FIXED"] },
      {
        name: "value",
        label: "Commission value (% or ₹)",
        type: "number",
        value: 1000,
      },
      { name: "active", label: "Active", type: "checkbox", value: true },
    ],
  },
};
function Configuration({ kind }: { kind: string }) {
  const q = useData("/admin/" + kind),
    [editing, setEditing] = useState<any>(undefined),
    { run } = useSession(),
    config = configurations[kind];
  return (
    <>
      <PageHead title={config.title} body={config.body}>
        <button className="button" onClick={() => setEditing(null)}>
          <Plus size={17} /> Create{" "}
          {kind === "taxons" ? "record" : kind.slice(0, -1)}
        </button>
      </PageHead>
      <DataBoundary q={q}>
        <div className="config-grid">
          {q.data?.map((r: any) => (
            <article className="panel config-card" key={r.id}>
              {r.image && (
                <img className="banner-thumb" src={r.image} alt={r.title} />
              )}
              <div className="section-row">
                <span className="eyebrow">
                  {r.kind || r.position || "COMMISSION"}
                </span>
                <Badge value={r.active ? "ACTIVE" : "INACTIVE"} />
              </div>
              <h3>
                {r.name ||
                  r.title ||
                  r.code ||
                  (r.kind === "PERCENT" ? r.value / 100 + "%" : money(r.value))}
              </h3>
              {r.subtitle && <p>{r.subtitle}</p>}
              {r.code && (
                <p>
                  {r.used} of {r.limit} redeemed · {r.perUser} per customer
                </p>
              )}
              {r.endsAt && <p className="fine">Ends {date(r.endsAt)}</p>}
              {r.slug && <p className="fine">/{r.slug}</p>}
              {kind === "commissions" && (
                <p className="fine">
                  {r.sellerId ? "Seller-specific" : "All sellers"} ·{" "}
                  {r.categoryId ? "Category-specific" : "All categories"}
                </p>
              )}
              <button className="text-link" onClick={() => setEditing(r)}>
                Edit <ArrowUpRight size={15} />
              </button>
            </article>
          ))}
        </div>
        {q.data?.length === 0 && (
          <Empty
            title="Room for something good."
            body="Create your first record."
          />
        )}
      </DataBoundary>
      {editing !== undefined && (
        <Modal
          title={(editing ? "Edit " : "Create ") + kind}
          onClose={() => setEditing(undefined)}
        >
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget),
                d: any = {};
              for (const f of config.fields) {
                const v = fd.get(f.name);
                d[f.name] =
                  f.type === "checkbox"
                    ? v === "on"
                    : f.type === "number"
                      ? v === ""
                        ? null
                        : Number(v)
                      : f.type === "datetime-local"
                        ? v
                          ? new Date(String(v)).toISOString()
                          : null
                        : v || null;
              }
              if (kind === "taxons") d.metadata = editing?.metadata || {};
              if (["coupons", "commissions"].includes(kind)) {
                for (const k of ["value", "minSpend", "maxDiscount"])
                  if (d[k] != null) d[k] = Math.round(d[k] * 100);
              }
              const result = await run(() =>
                api(
                  "/admin/" + kind + (editing ? "/" + editing.id : ""),
                  editing ? "PATCH" : "POST",
                  d,
                ),
              );
              if (result) setEditing(undefined);
            }}
          >
            {config.fields.map((f) => (
              <label
                className={
                  "field " + (f.type === "checkbox" ? "check-field" : "")
                }
                key={f.name}
              >
                <span>{f.label}</span>
                {f.options ? (
                  <select
                    name={f.name}
                    defaultValue={editing?.[f.name] ?? f.value ?? f.options[0]}
                  >
                    {f.options.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : f.type === "checkbox" ? (
                  <input
                    name={f.name}
                    type="checkbox"
                    defaultChecked={editing?.[f.name] ?? f.value ?? false}
                  />
                ) : (
                  <input
                    name={f.name}
                    type={f.type || "text"}
                    required={f.required !== false}
                    defaultValue={
                      f.type === "datetime-local"
                        ? editing?.[f.name]
                          ? new Date(editing[f.name]).toISOString().slice(0, 16)
                          : ""
                        : ["coupons", "commissions"].includes(kind) &&
                            ["value", "minSpend", "maxDiscount"].includes(
                              f.name,
                            )
                          ? (editing?.[f.name] ?? f.value) != null
                            ? (editing?.[f.name] ?? f.value) / 100
                            : ""
                          : (editing?.[f.name] ?? f.value ?? "")
                    }
                  />
                )}
              </label>
            ))}
            <button className="button span-two">Save changes</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Pages() {
  const q = useData("/admin/pages"),
    [edit, setEdit] = useState<any>(undefined),
    { run } = useSession();
  return (
    <>
      <PageHead
        title="Words that feel like Climo."
        body="Publish clear, approved policies and useful customer information."
      >
        <button className="button" onClick={() => setEdit(null)}>
          <Plus size={17} /> Add a page
        </button>
      </PageHead>
      <DataBoundary q={q}>
        <div className="config-grid">
          {q.data?.map((p: any) => (
            <article className="panel config-card" key={p.slug}>
              <Badge value={p.published ? "PUBLISHED" : "DRAFT"} />
              <h3>{p.title}</h3>
              <p>{p.body.slice(0, 140)}…</p>
              <button className="text-link" onClick={() => setEdit(p)}>
                Edit page <ArrowUpRight size={15} />
              </button>
            </article>
          ))}
        </div>
      </DataBoundary>
      {edit !== undefined && (
        <Modal title="Edit content page" onClose={() => setEdit(undefined)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const result = await run(() =>
                api("/admin/pages/" + f.get("slug"), "PUT", {
                  title: f.get("title"),
                  body: f.get("body"),
                  published: f.get("published") === "on",
                }),
              );
              if (result) setEdit(undefined);
            }}
          >
            <Field
              name="slug"
              label="URL slug"
              defaultValue={edit?.slug}
              readOnly={!!edit}
              required
            />
            <Field
              name="title"
              label="Page title"
              defaultValue={edit?.title}
              required
            />
            <label className="field">
              <span>Page content</span>
              <textarea
                name="body"
                rows={12}
                defaultValue={edit?.body}
                required
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                name="published"
                defaultChecked={edit?.published}
              />
              Publish this page
            </label>
            <button className="button">Save page</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function SellerProfile() {
  const q = useData("/seller/profile"),
    { run } = useSession();
  return (
    <>
      <PageHead
        title="Your business, thoughtfully presented."
        body="Maintain the details operations needs to verify and support your business."
      />
      <DataBoundary q={q}>
        {q.data && (
          <form
            className="panel form-grid padded"
            onSubmit={(e) => {
              e.preventDefault();
              const f: any = Object.fromEntries(new FormData(e.currentTarget));
              run(() =>
                api("/seller/profile", "PATCH", {
                  businessName: f.businessName,
                  vacation: f.vacation === "on",
                  profile: {
                    phone: f.phone,
                    businessAddress: f.businessAddress,
                    pickupAddress: f.pickupAddress,
                    returnAddress: f.returnAddress,
                    gstin: f.gstin,
                  },
                }),
              );
            }}
          >
            <div className="span-two">
              <Badge value={q.data.status} />
              <Badge value={q.data.verification} />
              {q.data.reason && <p>{q.data.reason}</p>}
            </div>
            <Field
              name="businessName"
              label="Business name"
              defaultValue={q.data.businessName}
              required
            />
            <Field
              name="phone"
              label="Mobile"
              defaultValue={q.data.profile.phone}
              required
            />
            {["businessAddress", "pickupAddress", "returnAddress"].map(
              (name) => (
                <Field
                  key={name}
                  name={name}
                  label={name.replace(/([A-Z])/g, " $1")}
                  defaultValue={q.data.profile[name]}
                  required
                />
              ),
            )}
            <Field
              name="gstin"
              label="GSTIN (if applicable)"
              defaultValue={q.data.profile.gstin}
            />
            <label className="field check-field">
              <input
                name="vacation"
                type="checkbox"
                defaultChecked={q.data.vacation}
              />
              <span>Vacation mode — pause new sales</span>
            </label>
            <button className="button span-two">Save business details</button>
          </form>
        )}
      </DataBoundary>
    </>
  );
}
function SettingsPage() {
  const q = useData("/admin/settings"),
    { run } = useSession();
  return (
    <>
      <PageHead
        title="The way your marketplace works."
        body="Set shipping and return rules. Financial execution remains separately controlled."
      />
      <DataBoundary q={q}>
        {q.data && (
          <form
            className="panel form-grid padded"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() =>
                api(
                  "/admin/settings",
                  "PUT",
                  Object.fromEntries(
                    [...fd.entries()].map(([k, v]) => [
                      k,
                      ["freeShipping", "shippingFee"].includes(k)
                        ? Math.round(Number(v) * 100)
                        : Number(v),
                    ]),
                  ),
                ),
              );
            }}
          >
            {[
              ["freeShipping", "Free shipping threshold (₹)"],
              ["shippingFee", "Shipping fee per seller group (₹)"],
              ["returnDays", "Return window (days)"],
              ["holdDays", "Settlement hold (days)"],
            ].map(([name, label]) => (
              <Field
                key={name}
                name={name}
                label={label}
                type="number"
                defaultValue={
                  ["freeShipping", "shippingFee"].includes(name)
                    ? q.data[name] / 100
                    : q.data[name]
                }
                required
              />
            ))}
            <button className="button span-two">Save settings</button>
          </form>
        )}
      </DataBoundary>
    </>
  );
}
function Stock() {
  const q = useData("/stock-requests"),
    { user, run } = useSession();
  return (
    <>
      <PageHead
        title="A saree worth waiting for."
        body="Customer → Admin → Seller → Admin → Customer. Requests never create orders automatically."
      />
      <DataBoundary q={q}>
        <Table
          headers={["Request", "Quantity", "Status", "Response", "Next step"]}
        >
          {q.data?.map((r: any) => (
            <tr key={r.id}>
              <td>
                #{r.id.slice(0, 8)}
                <small>{date(r.createdAt)}</small>
              </td>
              <td>{r.quantity}</td>
              <td>
                <Badge value={r.status} />
              </td>
              <td>
                {r.response?.remarks || "—"}
                <small>{r.response?.eta}</small>
              </td>
              <td>
                {((user.role === "ADMIN" &&
                  ["REQUESTED", "RESPONDED"].includes(r.status)) ||
                  (user.role === "SELLER" && r.status === "FORWARDED")) && (
                  <button
                    onClick={() => {
                      const status =
                        r.status === "REQUESTED"
                          ? "FORWARDED"
                          : r.status === "FORWARDED"
                            ? "RESPONDED"
                            : "NOTIFIED";
                      const remarks = window.prompt("Message or response");
                      if (!remarks) return;
                      const quantity =
                        status === "RESPONDED"
                          ? Number(window.prompt("Available quantity", "0"))
                          : undefined;
                      const eta =
                        status === "RESPONDED"
                          ? window.prompt("Expected restock date") || undefined
                          : undefined;
                      run(
                        () =>
                          api(
                            "/stock-requests/" + r.id + "/transition",
                            "POST",
                            { status, remarks, quantity, eta },
                          ),
                        "Stock request updated",
                      );
                    }}
                  >
                    {r.status === "REQUESTED"
                      ? "Forward to seller"
                      : r.status === "FORWARDED"
                        ? "Respond"
                        : "Notify customer"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {q.data?.length === 0 && (
          <Empty title="No availability requests yet." />
        )}
      </DataBoundary>
    </>
  );
}
function AfterSales() {
  const q = useData("/admin/after-sales"),
    { run } = useSession();
  return (
    <>
      <PageHead
        title="Care beyond the purchase."
        body="Review eligibility, record inspection, and route eligible refunds to Finance."
      />
      <DataBoundary q={q}>
        <Table headers={["Request", "Item", "Reason", "Status", "Action"]}>
          {q.data?.map((a: any) => (
            <tr key={a.id}>
              <td>
                {a.kind}
                <small>#{a.id.slice(0, 8)}</small>
              </td>
              <td>{a.item.snapshot.name}</td>
              <td>{a.reason}</td>
              <td>
                <Badge value={a.status} />
              </td>
              <td>
                <select
                  aria-label="After sales transition"
                  value=""
                  onChange={(e) => {
                    const status = e.target.value,
                      remarks = window.prompt(
                        "Record your review or inspection notes",
                      );
                    if (remarks)
                      run(() =>
                        api(
                          "/admin/after-sales/" + a.id + "/decision",
                          "POST",
                          { status, remarks },
                        ),
                      );
                  }}
                >
                  <option value="">Update…</option>
                  {(a.status === "REQUESTED"
                    ? ["APPROVED", "REJECTED"]
                    : a.status === "APPROVED"
                      ? ["PICKED_UP"]
                      : a.status === "PICKED_UP"
                        ? ["INSPECTED", "REJECTED"]
                        : a.status === "INSPECTED" && a.kind === "EXCHANGE"
                          ? ["REPLACEMENT_SENT"]
                          : []
                  ).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </Table>
      </DataBoundary>
    </>
  );
}
function Refunds() {
  const q = useData("/finance/refunds"),
    { user, run } = useSession();
  return (
    <>
      <PageHead
        title="Refunds, with accountability."
        body={
          user.role === "ADMIN"
            ? "Read-only financial visibility. Finance independently authorizes and executes refunds."
            : "Authorize only eligible refunds. Unknown provider outcomes stay pending until reconciliation."
        }
      />
      <DataBoundary q={q}>
        <Table headers={["Refund", "Order", "Amount", "Status", "Action"]}>
          {q.data?.map((r: any) => (
            <tr key={r.id}>
              <td>
                #{r.id.slice(0, 8)}
                <small>{date(r.createdAt)}</small>
              </td>
              <td>#{r.orderId.slice(0, 8)}</td>
              <td>{money(r.amount)}</td>
              <td>
                <Badge value={r.status} />
              </td>
              <td>
                {user.role === "FINANCE" &&
                ["ELIGIBLE", "AUTHORIZED", "PROCESSING"].includes(r.status) ? (
                  <button
                    onClick={() =>
                      run(
                        () =>
                          api(
                            "/finance/refunds/" +
                              r.id +
                              "/" +
                              (
                                {
                                  ELIGIBLE: "authorize",
                                  AUTHORIZED: "execute",
                                  PROCESSING: "reconcile",
                                } as any
                              )[r.status],
                            "POST",
                          ),
                        "Refund action recorded",
                      )
                    }
                  >
                    {
                      (
                        {
                          ELIGIBLE: "Authorize",
                          AUTHORIZED: "Execute with gateway",
                          PROCESSING: "Reconcile",
                        } as any
                      )[r.status]
                    }
                  </button>
                ) : (
                  <span className="muted">Read only</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {q.data?.length === 0 && <Empty title="No refunds to review." />}
      </DataBoundary>
    </>
  );
}
function Settlements() {
  const q = useData("/finance/settlements"),
    { user, run } = useSession();
  return (
    <>
      <PageHead
        title="A fair week’s work."
        body="Delivered orders become eligible after the configured return hold. Finance authorization is required."
      >
        {user.role === "FINANCE" && (
          <button
            className="button"
            onClick={() =>
              run(
                () => api("/finance/settlements/build", "POST"),
                "Eligible weekly batches prepared",
              )
            }
          >
            Prepare weekly batches
          </button>
        )}
      </PageHead>
      <DataBoundary q={q}>
        <Table
          headers={["Batch", "Seller", "Week", "Amount", "Status", "Action"]}
        >
          {q.data?.map((s: any) => (
            <tr key={s.id}>
              <td>#{s.id.slice(0, 8)}</td>
              <td>#{s.sellerId.slice(0, 8)}</td>
              <td>{s.week}</td>
              <td>{money(s.amount)}</td>
              <td>
                <Badge value={s.status} />
              </td>
              <td>
                {user.role === "FINANCE" &&
                  ["PENDING", "AUTHORIZED"].includes(s.status) && (
                    <button
                      onClick={() =>
                        run(
                          () =>
                            api(
                              "/finance/settlements/" +
                                s.id +
                                "/" +
                                (s.status === "PENDING"
                                  ? "authorize"
                                  : "execute"),
                              "POST",
                            ),
                          "Settlement action recorded",
                        )
                      }
                    >
                      {s.status === "PENDING" ? "Authorize" : "Execute payout"}
                    </button>
                  )}
              </td>
            </tr>
          ))}
        </Table>
        {q.data?.length === 0 && (
          <Empty title="Nothing ready for settlement yet." />
        )}
      </DataBoundary>
      <div className="notice-panel">
        <Shield />
        <p>
          Payout execution requires a configured provider and verified
          beneficiary accounts. Unconfigured actions cannot transfer funds.
        </p>
      </div>
    </>
  );
}
function Earnings() {
  const q = useData("/seller/earnings");
  return (
    <>
      <PageHead
        title="The value of your craft."
        body="View the immutable earnings ledger and weekly settlement progress."
      />
      <DataBoundary q={q}>
        <Table headers={["Entry", "From", "To", "Amount", "Date"]}>
          {q.data?.ledger.map((e: any) => (
            <tr key={e.id}>
              <td>#{e.suborderId.slice(0, 8)}</td>
              <td>{e.debit}</td>
              <td>{e.credit}</td>
              <td>{money(e.amount)}</td>
              <td>{date(e.createdAt)}</td>
            </tr>
          ))}
        </Table>
        <h2>Weekly settlements</h2>
        {q.data?.settlements.map((s: any) => (
          <div className="card" key={s.id}>
            {s.week} · {money(s.amount)} <Badge value={s.status} />
          </div>
        ))}
      </DataBoundary>
    </>
  );
}
function Reviews() {
  const q = useData("/admin/reviews"),
    { run } = useSession();
  return (
    <>
      <PageHead
        title="Honest stories, thoughtfully moderated."
        body="Reviews require a delivered purchase. Moderation does not alter customer ratings."
      />
      <DataBoundary q={q}>
        <div className="config-grid">
          {q.data?.map((r: any) => (
            <div className="panel config-card" key={r.id}>
              <span>{"★".repeat(r.rating)}</span>
              <p>{r.body}</p>
              <Badge value={r.status} />
              <div className="row-actions">
                {["APPROVED", "REJECTED"].map((status) => (
                  <button
                    key={status}
                    onClick={() =>
                      run(() =>
                        api("/admin/reviews/" + r.id + "/decision", "POST", {
                          status,
                        }),
                      )
                    }
                  >
                    {status === "APPROVED" ? "Approve" : "Reject"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DataBoundary>
    </>
  );
}
function Audit() {
  const q = useData("/admin/audit");
  return (
    <>
      <PageHead
        title="A clear record of every decision."
        body="Append-only operational and financial events. No editing or deletion controls."
      />
      <DataBoundary q={q}>
        <Table headers={["Action", "Actor", "Target", "Time"]}>
          {q.data?.map((e: any) => (
            <tr key={e.id}>
              <td>{e.action.replaceAll("_", " ")}</td>
              <td>{e.actorId.slice(0, 12)}</td>
              <td>{e.targetId.slice(0, 12)}</td>
              <td>{new Date(e.createdAt).toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </Table>
      </DataBoundary>
    </>
  );
}
