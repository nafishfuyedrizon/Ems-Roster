import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { doctorFetch } from "@/lib/doctor-api";
import { withApiPath } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";

export function DoctorStatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-primary">{value}</div>
        {subtext ? <p className="mt-2 text-xs text-muted-foreground">{subtext}</p> : null}
      </CardContent>
    </Card>
  );
}

export function PrintVersionsPanel({ documentType, documentId }: { documentType: string; documentId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [externalImageUrl, setExternalImageUrl] = useState("");
  const [latestGeneratedUrl, setLatestGeneratedUrl] = useState<string | null>(null);
  const [latestPageLinks, setLatestPageLinks] = useState<Array<{ page: number; url: string }>>([]);

  const { data } = useQuery<any[]>({
    queryKey: ["print-versions", documentType, documentId],
    queryFn: () => doctorFetch(`/documents/${documentType}/${documentId}/print-versions`),
  });

  const generateVersion = async () => {
    try {
      const response = await doctorFetch<{ directUrl: string; persisted?: boolean; pageLinks?: Array<{ page: number; url: string }> }>(`/documents/${documentType}/${documentId}/print-version`, {
        method: "POST",
        body: JSON.stringify({ externalImageUrl: externalImageUrl || null }),
      });
      setLatestGeneratedUrl(response.directUrl);
      setLatestPageLinks(response.pageLinks ?? []);
      await queryClient.invalidateQueries({ queryKey: ["print-versions", documentType, documentId] });
      toast({
        title: response.persisted === false ? "Direct print link generated" : "Print version generated",
        description: response.directUrl,
      });
    } catch (error) {
      toast({ title: "Failed to generate print version", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  const buildPageDownloadUrl = (page: number) =>
    `${withApiPath(`/documents/${documentType}/${documentId}/page/${page}.png`)}?download=1`;

  const buildCombinedDownloadUrl = () =>
    `${withApiPath(`/documents/${documentType}/${documentId}/image.png`)}?download=1`;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-base uppercase tracking-wider">Printer Links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="external-image-url" className="text-xs font-mono uppercase tracking-[0.28em] text-muted-foreground">External Image URL (optional)</Label>
          <Input id="external-image-url" value={externalImageUrl} onChange={(event) => setExternalImageUrl(event.target.value)} placeholder="https://..." className="font-mono" />
        </div>
        <Button onClick={() => void generateVersion()} className="font-mono uppercase tracking-widest">
          Generate Print Version
        </Button>
        {documentType === "mfc" ? (
          <div className="grid gap-2">
            <Button asChild variant="outline" className="font-mono uppercase tracking-widest">
              <a href={buildPageDownloadUrl(1)}>Download Page 1</a>
            </Button>
            <Button asChild variant="outline" className="font-mono uppercase tracking-widest">
              <a href={buildPageDownloadUrl(2)}>Download Page 2</a>
            </Button>
          </div>
        ) : (
          <Button asChild variant="outline" className="font-mono uppercase tracking-widest">
            <a href={buildCombinedDownloadUrl()}>Download File</a>
          </Button>
        )}
        {latestGeneratedUrl ? (
          <div className="rounded-lg border border-border/40 bg-background/40 p-3">
            <p className="text-sm font-semibold">Latest generated link</p>
            <a href={latestGeneratedUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-primary underline">
              {latestGeneratedUrl}
            </a>
            {latestPageLinks.length > 0 ? (
              <div className="mt-3 space-y-2">
                {latestPageLinks.map((link) => (
                  <a key={link.page} href={link.url} target="_blank" rel="noreferrer" className="block break-all text-xs text-cyan-400 underline">
                    {`Page ${link.page} link: ${link.url}`}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-3">
          {(data ?? []).map((version) => (
            <div key={version.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
              <p className="text-sm font-semibold">Version {version.versionNumber}</p>
              <a href={version.directUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-primary underline">
                {version.directUrl}
              </a>
              {version.externalImageUrl ? (
                <a href={version.externalImageUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-cyan-400 underline">
                  {version.externalImageUrl}
                </a>
              ) : null}
              {Array.isArray(version.pageLinks) && version.pageLinks.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {version.pageLinks.map((link: { page: number; url: string }) => (
                    <a key={link.page} href={link.url} target="_blank" rel="noreferrer" className="block break-all text-xs text-cyan-400 underline">
                      {`Page ${link.page} link: ${link.url}`}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
