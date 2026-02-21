"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmbeddedAuthForm, useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { provisionBufferWallet } from "@redi/api-client";

export function LoginPage() {
  const router = useRouter();
  const { status: authStatus, user, logout } = useAuth();
  const { wallet } = useWallet();
  const isProvisioning = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (authStatus !== "logged-in") return;
      if (isProvisioning.current) return;
      const email = user?.email;
      if (!email) return;

      isProvisioning.current = true;
      try {
        const serverWallet = await provisionBufferWallet(email);
        const walletAddress = wallet?.address ?? serverWallet.address;

        localStorage.setItem(
          "redi_user",
          JSON.stringify({ email, walletAddress, loginDate: new Date().toISOString() }),
        );

        router.push("/wallet");
      } catch {
        setError("Unable to initialize wallet session");
        isProvisioning.current = false;
      }
    };

    void run();
  }, [authStatus, user?.email, wallet?.address, router]);

  const handleSignOut = async () => {
    isProvisioning.current = false;
    setError(null);
    localStorage.removeItem("redi_user");
    await logout();
  };

  if (authStatus === "logged-in") {
    return (
      <main className="relative mx-auto grid min-h-[100svh] w-full place-items-center overflow-hidden px-4 py-10">
        <div className="absolute inset-0 -z-10 opacity-70 [background:radial-gradient(circle_at_20%_20%,#bfdbfe_0,transparent_40%),radial-gradient(circle_at_85%_75%,#bbf7d0_0,transparent_35%)]" />
        <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.32)] backdrop-blur-md">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Wallet bootstrap
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Initializing wallet session
            </h1>
            <p className="text-sm text-slate-600">Please wait while we prepare your wallet.</p>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex w-fit items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative mx-auto grid min-h-[100svh] w-full place-items-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 -z-10 opacity-70 [background:radial-gradient(circle_at_15%_18%,#bfdbfe_0,transparent_40%),radial-gradient(circle_at_88%_72%,#bbf7d0_0,transparent_36%)]" />
      <div className="absolute -left-28 top-16 -z-10 h-72 w-72 rounded-full bg-sky-200/45 blur-3xl" />
      <div className="absolute -right-24 bottom-10 -z-10 h-72 w-72 rounded-full bg-emerald-200/45 blur-3xl" />

      <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.32)] backdrop-blur-md">
        <div className="mb-6 space-y-3">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Secure account access
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in to Redi</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Use your email to receive a one-time verification code and connect your wallet.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <EmbeddedAuthForm />
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
