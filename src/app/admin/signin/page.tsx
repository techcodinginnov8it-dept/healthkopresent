"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/app/actions/auth";

export default function AdminSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginAdmin({ email, password });
      setLoading(false);

      if (!res.success) {
        setError(res.error || "Invalid admin credentials");
        return;
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setLoading(false);
      setError("A network error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/40">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-teal">ADMIN PORTAL</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Sign in to Admin Dashboard</h1>
          <p className="mt-3 text-sm text-slate-400">Use the demo admin account to view the admin workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-brand-red/20 bg-brand-red/10 p-3 text-sm font-semibold text-brand-red">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@healthko.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-0 focus:border-brand-teal"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-10 text-sm text-white outline-none focus:border-brand-teal"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-teal px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-brand-teal-hover disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Access Admin Dashboard"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="font-semibold text-brand-teal hover:text-brand-teal-hover">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
