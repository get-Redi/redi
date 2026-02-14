"use client";

import {
  CrossmintAuthProvider,
  CrossmintProvider,
  CrossmintWalletProvider,
} from "@crossmint/client-sdk-react-ui";
import { getPublicEnv } from "@redi/config";

const env = getPublicEnv({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_CROSSMINT_API_KEY: process.env.NEXT_PUBLIC_CROSSMINT_API_KEY,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CrossmintProvider apiKey={env.NEXT_PUBLIC_CROSSMINT_API_KEY}>
      <CrossmintAuthProvider
        loginMethods={["email"]}
        authModalTitle="Sign in to Redi"
        termsOfServiceText={
          <p>
            By continuing, you agree to our <a href="/terms">Terms of Service</a> and{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>
        }
        appearance={{
          spacingUnit: "8px",
          borderRadius: "12px",
          colors: {
            inputBackground: "#fffdf9",
            buttonBackground: "#fffaf2",
            border: "#835911",
            background: "#FAF5EC",
            textPrimary: "#5f2c1b",
            textSecondary: "#835911",
            textLink: "#1400cb",
            danger: "#ff3333",
            accent: "#602C1B",
          },
        }}
      >
        <CrossmintWalletProvider
          createOnLogin={{
            chain: "stellar",
            signer: { type: "email" },
          }}
        >
          {children}
        </CrossmintWalletProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  );
}
