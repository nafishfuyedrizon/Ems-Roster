import { useCallback, useState } from "react";
import { doctorFetch } from "@/lib/doctor-api";

export type DoctorSession = {
  doctorAccountId: number;
  memberId: number;
  username: string;
  callSign: string;
  rank: string;
  name: string;
  issuedAt: number;
};

export function useDoctorAuth() {
  const [doctor, setDoctor] = useState<DoctorSession | null>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await doctorFetch<{ doctor: DoctorSession }>("/doctor-auth/session");
      setDoctor(response.doctor);
      setChecked(true);
      return response.doctor;
    } catch {
      setDoctor(null);
      setChecked(true);
      return null;
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await doctorFetch<{ doctor: DoctorSession }>("/doctor-auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setDoctor(response.doctor);
    setChecked(true);
    return response.doctor;
  }, []);

  const logout = useCallback(async () => {
    await doctorFetch("/doctor-auth/logout", { method: "POST" });
    setDoctor(null);
    setChecked(true);
  }, []);

  return {
    doctor,
    checked,
    isAuthenticated: Boolean(doctor),
    refresh,
    login,
    logout,
  };
}
