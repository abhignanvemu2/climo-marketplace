import React, { createContext, useContext, useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { BrowserRouter, Link, useNavigate } from "react-router-dom";
import {
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  ArrowRight,
} from "lucide-react";
import "./styles.css";
export const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15000 } },
});
let csrf: string | null = null;
export async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/v1" + path, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Request failed");
  if (
    [
      "/auth/login",
      "/auth/register",
      "/auth/logout",
      "/auth/revoke-sessions",
    ].includes(path)
  ) {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "/auth/me" });
    if (path.includes("logout") || path.includes("revoke-sessions"))
      csrf = null;
  }
  if (data.csrf) csrf = data.csrf;
  return data;
}
export const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v / 100);
export const date = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function useData<T = any>(path: string, enabled = true) {
  return useQuery<T>({ queryKey: [path], queryFn: () => api(path), enabled });
}
const Context = createContext<any>(null);
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Session>{children}</Session>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
function Session({ children }: { children: React.ReactNode }) {
  const auth = useData("/auth/me");
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const notify = (message: string, error = false) =>
    setNotice({ message, error });
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const run = async (
    action: () => Promise<any>,
    success = "Saved successfully",
  ) => {
    try {
      const result = await action();
      await qc.invalidateQueries();
      if (success) notify(success);
      return result;
    } catch (e) {
      notify((e as Error).message, true);
      return undefined;
    }
  };
  return (
    <Context.Provider value={{ user: auth.data?.user, auth, notify, run }}>
      {children}
      {notice && (
        <div className={"toast " + (notice.error ? "error" : "")} role="status">
          {notice.error ? (
            <AlertCircle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{notice.message}</span>
          <button
            aria-label="Close notification"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" />
      <p>Loading your collection…</p>
    </div>
  );
}
export function ErrorState({ error }: { error: any }) {
  return (
    <div className="empty error">
      <AlertCircle />
      <p>{error?.message || "Could not load this page"}</p>
      <button
        className="button secondary"
        onClick={() => qc.invalidateQueries()}
      >
        Try again
      </button>
    </div>
  );
}
export function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">c.</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        ([
          "APPROVED",
          "ACTIVE",
          "VERIFIED",
          "CAPTURED",
          "DELIVERED",
          "PROCESSED",
          "CONFIRMED",
        ].includes(value)
          ? "good"
          : [
                "REJECTED",
                "BLOCKED",
                "SUSPENDED",
                "FAILED",
                "CANCELLED",
              ].includes(value)
            ? "bad"
            : "")
      }
    >
      {value.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-row">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Field({ label, ...props }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function AuthPage({ portal = "customer" }: { portal?: string }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);
  const { run } = useSession();
  const nav = useNavigate();
  return (
    <div className="auth-page">
      <div className="auth-art">
        <span className="wordmark">climo.</span>
        <h1>
          Beautiful beginnings
          <br />
          start with a thread.
        </h1>
        <p>Thoughtfully chosen. Beautifully yours.</p>
      </div>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = Object.fromEntries(new FormData(e.currentTarget));
          const result = await run(
            () =>
              api("/auth/" + (register ? "register" : "login"), "POST", {
                ...form,
                ...(register
                  ? { role: portal === "seller" ? "SELLER" : "CUSTOMER" }
                  : {}),
              }),
            "",
          );
          setBusy(false);
          if (result) nav(portal === "customer" ? "/shop" : "/");
        }}
      >
        <Link to="/" className="eyebrow">
          ← Back to Climo
        </Link>
        <h1>{register ? "Join the story." : "Welcome back."}</h1>
        <p>
          {portal === "admin"
            ? "Sign in with your provisioned Admin or Finance account."
            : "Your next favourite saree is waiting."}
        </p>
        {register && (
          <Field label="Your name" name="name" required autoComplete="name" />
        )}
        {register && portal === "seller" && (
          <Field label="Business name" name="businessName" required />
        )}
        <Field
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
        <Field
          label="Password (12+ characters)"
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete={register ? "new-password" : "current-password"}
        />
        <button className="button" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          <ArrowRight size={18} />
        </button>
        {portal !== "admin" && (
          <button
            type="button"
            className="text-button"
            onClick={() => setRegister(!register)}
          >
            {register
              ? "Already a member? Sign in"
              : "New here? Create an account"}
          </button>
        )}
        <p className="fine">
          Local demo accounts are documented in the setup guide. Use the
          password you chose during seeding.
        </p>
      </form>
    </div>
  );
}
export function Protected({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, auth } = useSession();
  if (auth.isLoading) return <Loading />;
  if (!user)
    return (
      <Empty
        title="A little introduction first."
        body="Sign in to access your account."
      >
        <Link className="button" to="/login">
          Sign in <ArrowRight size={16} />
        </Link>
      </Empty>
    );
  if (roles && !roles.includes(user.role))
    return (
      <Empty
        title="This workspace belongs to another role."
        body="Sign in with an account authorized for this portal."
      />
    );
  return <>{children}</>;
}
export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
