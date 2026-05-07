"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localAuthBypassEnabled } from "@/lib/auth-mode";

export function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    if (localAuthBypassEnabled) {
      router.push("/login");
      router.refresh();
      return;
    }

    void signOut({ callbackUrl: "/login" });
  }

  return (
    <Button variant="secondary" type="button" className="gap-2 rounded-2xl" onClick={handleLogout}>
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  );
}
