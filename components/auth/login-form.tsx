"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localAuthBypassEnabled } from "@/lib/auth-mode";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/dashboard";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (localAuthBypassEnabled) {
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const response = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl
    });

    setLoading(false);

    if (!response || response.error) {
      setError("Credenciais invalidas. Verifique o e-mail e a senha.");
      return;
    }

    router.push(response.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {localAuthBypassEnabled ? (
        <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Ambiente local com autenticação liberada. Clique em entrar para acessar o sistema.
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">E-mail</label>
        <Input name="email" type="email" placeholder="seu@email.com" required={!localAuthBypassEnabled} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Senha</label>
        <Input name="password" type="password" placeholder="Sua senha" required={!localAuthBypassEnabled} />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" className="w-full" variant="primary" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
