import { useState, useCallback } from "react";

export type AdminRole = "full" | "high-command" | "ftp-ems" | "ftb-qc" | null;

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/ems-panel/, "") + "/api";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("admin_auth") === "true";
  });

  const [adminIdentity, setAdminIdentity] = useState<string | null>(() => {
    return localStorage.getItem("admin_identity");
  });

  const [adminRole, setAdminRole] = useState<AdminRole>(() => {
    return (localStorage.getItem("admin_role") as AdminRole) ?? null;
  });

  const setAuth = (identity: string | null, role: AdminRole) => {
    localStorage.setItem("admin_auth", "true");
    if (identity) localStorage.setItem("admin_identity", identity);
    else localStorage.removeItem("admin_identity");
    if (role) localStorage.setItem("admin_role", role);
    else localStorage.removeItem("admin_role");
    setIsAuthenticated(true);
    setAdminIdentity(identity);
    setAdminRole(role);
  };

  const loginWithMasterPassword = async (input: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/auth/master-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: input }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !result.role) {
        return { success: false, error: result.error ?? "Invalid master key." };
      }

      setAuth(result.identity ?? "Master Key", result.role as AdminRole);
      return { success: true };
    } catch {
      return { success: false, error: "Master key verification failed." };
    }
  };

  const loginWithDiscord = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const width = 480;
      const height = 640;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        `${API_BASE}/auth/discord`,
        "discord_auth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no,status=no`
      );

      if (!popup) {
        resolve({ success: false, error: "Popup was blocked. Please allow popups for this site." });
        return;
      }

      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve({ success: false, error: "Discord login timed out. Please try again." });
      }, 5 * 60 * 1000);

      function handler(event: MessageEvent) {
        if (event.data?.type !== "DISCORD_AUTH_RESULT") return;
        clearTimeout(timeout);
        window.removeEventListener("message", handler);

        const { success, role, identity, error } = event.data;
        if (success && role) {
          setAuth(identity ?? null, role as AdminRole);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: error ?? "Discord authentication failed." });
        }
      }

      window.addEventListener("message", handler);
    });
  }, []);

  const logout = () => {
    localStorage.removeItem("admin_auth");
    localStorage.removeItem("admin_identity");
    localStorage.removeItem("admin_role");
    setIsAuthenticated(false);
    setAdminIdentity(null);
    setAdminRole(null);
  };

  return { isAuthenticated, adminIdentity, adminRole, loginWithMasterPassword, loginWithDiscord, logout };
}
