import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/api-base";
const CHECK_INTERVAL_MS = 30_000;

interface Props {
  isAuthenticated: boolean;
  adminIdentity: string | null;
  onRevoked: () => void;
}

export function useAccessValidator({ isAuthenticated, adminIdentity, onRevoked }: Props) {
  const onRevokedRef = useRef(onRevoked);
  onRevokedRef.current = onRevoked;

  useEffect(() => {
    if (!isAuthenticated || !adminIdentity) return;
    // Master Key users are never auto-logged out
    if (adminIdentity === "Master Key") return;

    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/validate-access`, {
          headers: { "X-Admin-Identity": adminIdentity },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.valid === false) {
          onRevokedRef.current();
        }
      } catch {
        // Network error — don't force logout
      }
    };

    // First check after 5 seconds, then every 30s
    const initial = setTimeout(check, 5_000);
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [isAuthenticated, adminIdentity]);
}
