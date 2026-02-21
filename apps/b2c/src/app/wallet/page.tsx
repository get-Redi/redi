"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { onboardUser, getBufferBalance } from "@redi/api-client";
import type { OnboardingResponse, BufferBalanceResponse } from "@redi/api-client";

const STROOPS_PER_XLM = 10_000_000;

function stroopsToXlm(stroops: string): string {
  const n = Number(stroops);
  if (isNaN(n)) return "0";
  return (n / STROOPS_PER_XLM).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export default function WalletPage() {
  const router = useRouter();
  const { user, logout, status: authStatus } = useAuth();
  const { wallet } = useWallet();
  const [onboarding, setOnboarding] = useState<OnboardingResponse | null>(null);
  const [balance, setBalance] = useState<BufferBalanceResponse["balance"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didFetch = useRef(false);

  useEffect(() => {
    if (authStatus === "logged-out") {
      router.replace("/");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (didFetch.current) return;
    const userId = user?.id;
    const email = user?.email;
    if (!userId || !email) return;

    didFetch.current = true;

    const run = async () => {
      try {
        const ob = await onboardUser(userId, email);
        setOnboarding(ob);
        if (ob.status === "READY") {
          try {
            const bal = await getBufferBalance(userId);
            setBalance(bal.balance);
          } catch {
            // balance is optional
          }
        }
      } catch {
        setError("Unable to load wallet data.");
        console.error("[WalletPage] onboarding/balance error");
      }
    };

    void run();
  }, [user?.id, user?.email]);

  const handleSignOut = async () => {
    localStorage.removeItem("redi_user");
    await logout();
    router.replace("/");
  };

  const walletAddress = onboarding?.stellarAddress ?? wallet?.address;
  const totalShares =
    balance
      ? (BigInt(balance.availableShares) + BigInt(balance.protectedShares)).toString()
      : null;

  return (
    <main className="relative mx-auto grid min-h-svh w-full place-items-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 -z-10 opacity-70 [background:radial-gradient(circle_at_15%_18%,#bfdbfe_0,transparent_40%),radial-gradient(circle_at_88%_72%,#bbf7d0_0,transparent_36%)]" />
      <div className="absolute -left-28 top-16 -z-10 h-72 w-72 rounded-full bg-sky-200/45 blur-3xl" />
      <div className="absolute -right-24 bottom-10 -z-10 h-72 w-72 rounded-full bg-emerald-200/45 blur-3xl" />

      <section className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.32)] backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Buffer
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Buffer</h1>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Email</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{user?.email}</p>
          </div>

          {walletAddress ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Stellar address</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{walletAddress}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Stellar address</p>
              <p className="mt-1 text-sm text-slate-400">Loading...</p>
            </div>
          )}

          {balance ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div>
                <p className="text-xs text-emerald-700">Total deposited</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900">
                  {stroopsToXlm(balance.totalDeposited)} XLM
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-emerald-700">Available shares</p>
                  <p className="mt-1 text-sm font-medium text-emerald-900">
                    {stroopsToXlm(balance.availableShares)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Protected shares</p>
                  <p className="mt-1 text-sm font-medium text-emerald-900">
                    {stroopsToXlm(balance.protectedShares)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Total shares</p>
                <p className="mt-1 text-sm font-medium text-emerald-900">
                  {totalShares ? stroopsToXlm(totalShares) : "—"}
                </p>
              </div>
              {balance.lastDepositTs ? (
                <div>
                  <p className="text-xs text-emerald-700">Last deposit</p>
                  <p className="mt-1 text-xs text-emerald-800">{formatDate(balance.lastDepositTs)}</p>
                </div>
              ) : null}
            </div>
          ) : onboarding?.status === "READY" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Buffer balance</p>
              <p className="mt-1 text-sm text-slate-400">Loading balance...</p>
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
      </section>
    </main>
  );
}
