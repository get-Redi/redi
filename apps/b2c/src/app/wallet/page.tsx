"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { onboardUser, getBufferBalance } from "@redi/api-client";

interface UserSession {
  email: string;
  walletAddress: string;
  userId: string;
}

export default function WalletPage() {
  const router = useRouter();
  const { status: authStatus, user } = useAuth();
  const { wallet } = useWallet();
  const isOnboarding = useRef(false);

  const [session, setSession] = useState<UserSession | null>(null);
  const [balance, setBalance] = useState<{ shares: string; assets: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "logged-out") {
      router.replace("/");
    }
  }, [authStatus, router]);

  useEffect(() => {
    const run = async () => {
      if (authStatus !== "logged-in") return;
      if (isOnboarding.current) return;

      const email = user?.email;
      const userId = user?.id;
      if (!email || !userId) return;

      isOnboarding.current = true;
      setError(null);

      try {
        const onboarding = await onboardUser(userId, email);

        const walletAddress = wallet?.address ?? onboarding.stellarAddress ?? "";

        setSession({ email, walletAddress, userId });

        if (onboarding.status === "READY") {
          const bufferBalance = await getBufferBalance(userId);
          setBalance(bufferBalance.balance);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[WalletPage] onboarding/balance error:", message);
        setError("Unable to load wallet data. Please try again.");
      } finally {
        isOnboarding.current = false;
      }
    };

    void run();
  }, [authStatus, user?.email, user?.id, wallet?.address]);

  if (authStatus !== "logged-in" && authStatus !== "logged-out") {
    return (
      <main className="relative mx-auto grid min-h-svh w-full place-items-center px-4 py-10">
        <div className="absolute inset-0 -z-10 opacity-70 [background:radial-gradient(circle_at_20%_20%,#bfdbfe_0,transparent_40%),radial-gradient(circle_at_85%_75%,#bbf7d0_0,transparent_35%)]" />
        <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.32)] backdrop-blur-md">
          <p className="text-sm text-slate-600">Loading your wallet...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative mx-auto grid min-h-svh w-full place-items-center px-4 py-10">
      <div className="absolute inset-0 -z-10 opacity-70 [background:radial-gradient(circle_at_20%_20%,#bfdbfe_0,transparent_40%),radial-gradient(circle_at_85%_75%,#bbf7d0_0,transparent_35%)]" />

      <section className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.32)] backdrop-blur-md">
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          Buffer
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your Wallet</h1>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {session ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Email</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{session.email}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Wallet address</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">
                {session.walletAddress}
              </p>
            </div>

            {balance ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Buffer balance</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900">{balance.assets} XLM</p>
                <p className="text-xs text-emerald-600">{balance.shares} shares</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Buffer balance</p>
                <p className="mt-1 text-sm text-slate-600">
                  No deposits yet. Deposit XLM to start earning yield.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
