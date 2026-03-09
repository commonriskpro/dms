"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { MutationButton } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell, PageHeader } from "@/components/ui/page-shell";

const BUCKETS = [
  { value: "deal-documents", label: "Deal documents" },
  { value: "inventory-photos", label: "Inventory photos" },
] as const;

export function FilesPage() {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canRead = hasPermission("documents.read");
  const canWrite = hasPermission("documents.write");

  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadBucket, setUploadBucket] = React.useState<string>(BUCKETS[0].value);
  const [uploading, setUploading] = React.useState(false);
  const [uploadResult, setUploadResult] = React.useState<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    bucket: string;
  } | null>(null);

  const [signedUrlFileId, setSignedUrlFileId] = React.useState("");
  const [signedUrlLoading, setSignedUrlLoading] = React.useState(false);
  const [signedUrlResult, setSignedUrlResult] = React.useState<{ url: string; expiresAt: string } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !uploadFile) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("bucket", uploadBucket);
      const result = await apiFetch<{
        id: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
        bucket: string;
        path: string;
        createdAt: string;
      }>("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      setUploadResult({
        id: result.id,
        filename: result.filename,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
        bucket: result.bucket,
      });
      setUploadFile(null);
      addToast("success", "File uploaded");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGetSignedUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRead || !signedUrlFileId.trim()) return;
    setSignedUrlLoading(true);
    setSignedUrlResult(null);
    try {
      const result = await apiFetch<{ url: string; expiresAt: string }>(
        `/api/files/signed-url?fileId=${encodeURIComponent(signedUrlFileId.trim())}`
      );
      setSignedUrlResult(result);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to get URL");
    } finally {
      setSignedUrlLoading(false);
    }
  };

  const openSignedUrl = () => {
    if (signedUrlResult?.url) {
      window.open(signedUrlResult.url, "_blank", "noopener,noreferrer");
    }
  };

  if (!canRead && !canWrite) {
    return (
      <PageShell>
        <PageHeader title="Files" description="Upload files and get signed download URLs." />
        <p className="mt-2 text-[var(--text-soft)]">You don’t have permission to view this page.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Files" description="Upload files and get signed download URLs." />

      {canWrite && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>Upload a file to storage. Max size and types are enforced by the server.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Bucket</label>
                <select
                  value={uploadBucket}
                  onChange={(e) => setUploadBucket(e.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 text-sm"
                  aria-label="Bucket"
                >
                  {BUCKETS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">File</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-[var(--text-soft)] file:mr-4 file:rounded file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-white"
                  aria-label="Choose file"
                />
              </div>
              <MutationButton type="submit" disabled={!uploadFile} isLoading={uploading}>
                Upload
              </MutationButton>
              {uploadResult && (
                <div className="rounded border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm">
                  <p><strong>ID:</strong> <code className="text-xs">{uploadResult.id}</code></p>
                  <p><strong>Filename:</strong> {uploadResult.filename}</p>
                  <p><strong>Size:</strong> {uploadResult.sizeBytes} bytes</p>
                  <p><strong>Bucket:</strong> {uploadResult.bucket}</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {canRead && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Signed URL</CardTitle>
            <CardDescription>Get a temporary signed URL to download a file by its ID.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGetSignedUrl} className="space-y-4 max-w-md">
              <Input
                label="File ID"
                value={signedUrlFileId}
                onChange={(e) => setSignedUrlFileId(e.target.value)}
                placeholder="UUID of the file"
              />
              <Button type="submit" isLoading={signedUrlLoading}>
                Get URL
              </Button>
              {signedUrlResult && (
                <div className="rounded border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm space-y-2">
                  <p><strong>Expires:</strong> {new Date(signedUrlResult.expiresAt).toLocaleString()}</p>
                  <Button type="button" variant="secondary" size="sm" onClick={openSignedUrl}>
                    Open link
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
