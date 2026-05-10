import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DoctorLayout } from "@/components/doctor-layout";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { doctorFetch } from "@/lib/doctor-api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function useDoctorGuard() {
  const { checked, doctor, refresh } = useDoctorAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    void refresh().then((session) => {
      if (!session) setLocation("/doctor/login");
    });
  }, [refresh, setLocation]);

  return { checked, doctor };
}

export function DoctorPageShell({ children }: { children: React.ReactNode }) {
  const { checked, doctor } = useDoctorGuard();

  if (!checked) {
    return (
      <DoctorLayout>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </DoctorLayout>
    );
  }

  if (!doctor) return null;
  return <DoctorLayout>{children}</DoctorLayout>;
}

export function useDoctorQuery<T>(key: string, path: string) {
  return useQuery<T>({
    queryKey: [key],
    queryFn: () => doctorFetch<T>(path),
  });
}
