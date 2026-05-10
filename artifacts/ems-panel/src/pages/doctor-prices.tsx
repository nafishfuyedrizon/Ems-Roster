import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DoctorPrices() {
  const { data } = useDoctorQuery<any[]>("doctor-prices", "/prices");
  const grouped = (data ?? []).reduce<Record<string, any[]>>((acc, row) => {
    acc[row.category] ??= [];
    acc[row.category].push(row);
    return acc;
  }, {});

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">EMS Price Catalog</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Reference + auto-fill billing rules for medical operations</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(grouped).map(([category, items]) => (
            <Card key={category} className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="capitalize">{category}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between rounded-lg border border-border/40 bg-background/40 p-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description || "No description"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">${item.amount}</p>
                      <p className="text-[11px] text-muted-foreground">{item.requiredRank || "No rank gate"}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
