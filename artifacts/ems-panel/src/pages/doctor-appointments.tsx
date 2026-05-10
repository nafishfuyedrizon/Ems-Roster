import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { doctorFetch } from "@/lib/doctor-api";

export default function DoctorAppointments() {
  const queryClient = useQueryClient();
  const { data } = useDoctorQuery<any[]>("doctor-appointments", "/doctor-appointments");

  const updateStatus = async (id: number, status: string) => {
    await doctorFetch(`/doctor-appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
  };

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Appointments</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Discord-imported doctor appointment queue</p>
        </div>
        <div className="grid gap-4">
          {(data ?? []).map((item) => (
            <Card key={item.id} className="border-border/50 bg-card/50">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{item.patientName}</CardTitle>
                  <p className="text-xs text-muted-foreground">{item.appointmentTypeLabel || item.appointmentRawText || "Appointment"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={item.status} onValueChange={(value) => void updateStatus(item.id, value)}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Link href={`/doctor/appointments/${item.id}`} className="text-sm text-primary underline">Open</Link>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-4">
                <p>CID: {item.cid || "N/A"}</p>
                <p>Contact: {item.contact || "N/A"}</p>
                <p>Gender: {item.gender || "N/A"}</p>
                <p>Posted: {new Date(item.postedAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
