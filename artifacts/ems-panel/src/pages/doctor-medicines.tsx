import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DoctorMedicines() {
  const { data } = useDoctorQuery<any[]>("doctor-medicines", "/medicines");

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Medicine Catalog</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Catalog-linked prescription items and permission rules</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((item) => (
            <Card key={item.id} className="border-border/50 bg-card/50">
              <CardHeader><CardTitle>{item.name}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">Form: {item.dosageForm || "N/A"}</p>
                <p className="text-muted-foreground">Price: ${item.defaultPrice}</p>
                <p className={item.allowedForCurrentDoctor ? "text-emerald-400" : "text-amber-400"}>{item.allowedForCurrentDoctor ? "Allowed for your rank" : item.restrictionNote}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
