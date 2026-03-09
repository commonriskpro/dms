"use client";

import * as React from "react";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { VehiclePhotoListResponse } from "../types";
import { MediaStatsCard } from "./MediaStatsCard";
import { MediaUploadCard } from "./MediaUploadCard";
import { PhotoGalleryCard } from "./PhotoGalleryCard";
import { VideoGalleryCard, type MediaVideoItem } from "./VideoGalleryCard";

const MAX_PHOTOS = 20;
const MAX_VIDEOS = 8;
const PHOTOS_API = (id: string) => `/api/inventory/${id}/photos`;

export type MediaTabContentProps = {
  vehicleId: string;
  className?: string;
  onPhotosChange?: () => void;
};

export function MediaTabContent({ vehicleId, className, onPhotosChange }: MediaTabContentProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const canReadInventory = hasPermission("inventory.read");
  const canWriteInventory = hasPermission("inventory.write");
  const canReadDocs = hasPermission("documents.read");
  const canWriteDocs = hasPermission("documents.write");
  const canManagePhotos = canWriteInventory && canWriteDocs;
  const canManageVideos = canWriteInventory;

  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const createdVideoUrls = React.useRef<Set<string>>(new Set());

  const [photos, setPhotos] = React.useState<VehiclePhotoListResponse[]>([]);
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoUploadError, setPhotoUploadError] = React.useState<string | null>(null);

  const [videos, setVideos] = React.useState<MediaVideoItem[]>([]);
  const [videoUploading, setVideoUploading] = React.useState(false);
  const [videoUploadError, setVideoUploadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      for (const url of createdVideoUrls.current) {
        URL.revokeObjectURL(url);
      }
      createdVideoUrls.current.clear();
    };
  }, []);

  const fetchPhotos = React.useCallback(async () => {
    if (!canReadInventory || !canReadDocs) {
      setPhotos([]);
      return;
    }
    const res = await apiFetch<{ data: VehiclePhotoListResponse[] }>(PHOTOS_API(vehicleId));
    const sorted = (res.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    setPhotos(sorted);
  }, [vehicleId, canReadInventory, canReadDocs]);

  const fetchPhotoUrls = React.useCallback(
    async (list: VehiclePhotoListResponse[]) => {
      if (!canReadDocs || list.length === 0) {
        setPhotoUrls({});
        return;
      }
      const nextMap: Record<string, string> = {};
      await Promise.all(
        list.map(async (photo) => {
          try {
            const res = await apiFetch<{ url: string }>(
              `/api/files/signed-url?fileId=${encodeURIComponent(photo.id)}`
            );
            if (res.url) nextMap[photo.id] = res.url;
          } catch {
            // Ignore missing signed URL and keep other images loading.
          }
        })
      );
      setPhotoUrls(nextMap);
    },
    [canReadDocs]
  );

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchPhotos();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fetchPhotos]);

  React.useEffect(() => {
    if (!canReadInventory) {
      setLoading(false);
      return;
    }
    void loadAll();
  }, [canReadInventory, loadAll]);

  React.useEffect(() => {
    void fetchPhotoUrls(photos);
  }, [photos, fetchPhotoUrls]);

  const uploadPhotoFiles = React.useCallback(
    async (incoming: File[]) => {
      if (!canManagePhotos || incoming.length === 0) return;
      setPhotoUploadError(null);
      const imageFiles = incoming.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        setPhotoUploadError("Only image files can be uploaded as photos.");
        return;
      }
      const remaining = Math.max(0, MAX_PHOTOS - photos.length);
      const files = imageFiles.slice(0, remaining);
      if (files.length === 0) {
        setPhotoUploadError("Photo limit reached.");
        return;
      }
      setPhotoUploading(true);
      try {
        for (const file of files) {
          const formData = new FormData();
          formData.set("file", file);
          await apiFetch(PHOTOS_API(vehicleId), {
            method: "POST",
            body: formData,
          });
        }
        addToast("success", files.length === 1 ? "Photo uploaded." : "Photos uploaded.");
        await fetchPhotos();
        onPhotosChange?.();
      } catch (err) {
        setPhotoUploadError(getApiErrorMessage(err));
      } finally {
        setPhotoUploading(false);
      }
    },
    [addToast, canManagePhotos, fetchPhotos, onPhotosChange, photos.length, vehicleId]
  );

  const uploadVideoFiles = React.useCallback(
    async (incoming: File[]) => {
      if (!canManageVideos || incoming.length === 0) return;
      setVideoUploadError(null);
      const videoFiles = incoming.filter((file) => file.type.startsWith("video/"));
      if (videoFiles.length === 0) {
        setVideoUploadError("Only video files are allowed in the video section.");
        return;
      }
      const remaining = Math.max(0, MAX_VIDEOS - videos.length);
      const files = videoFiles.slice(0, remaining);
      if (files.length === 0) {
        setVideoUploadError("Video limit reached.");
        return;
      }
      setVideoUploading(true);
      try {
        const nextVideos = files.map((file) => {
          const url = URL.createObjectURL(file);
          createdVideoUrls.current.add(url);
          return {
            id: crypto.randomUUID(),
            name: file.name,
            sizeBytes: file.size,
            url,
            createdAt: new Date().toISOString(),
            isPrimary: false,
          } satisfies MediaVideoItem;
        });
        setVideos((prev) => {
          const merged = [...prev, ...nextVideos];
          return merged.map((video, idx) => ({ ...video, isPrimary: idx === 0 }));
        });
        addToast("success", files.length === 1 ? "Video added." : "Videos added.");
      } catch (err) {
        setVideoUploadError(getApiErrorMessage(err));
      } finally {
        setVideoUploading(false);
      }
    },
    [addToast, canManageVideos, videos.length]
  );

  const handleSetPrimaryPhoto = React.useCallback(
    async (photoId: string) => {
      if (!canManagePhotos) return;
      const selected = photos.find((photo) => photo.id === photoId);
      if (!selected) return;
      const reordered = [selected.id, ...photos.filter((photo) => photo.id !== photoId).map((photo) => photo.id)];
      const optimistic = [selected, ...photos.filter((photo) => photo.id !== photoId)].map((photo, index) => ({
        ...photo,
        isPrimary: index === 0,
      }));
      const previous = photos;
      setPhotos(optimistic);
      try {
        await apiFetch(`${PHOTOS_API(vehicleId)}/primary`, {
          method: "PATCH",
          body: JSON.stringify({ fileId: photoId }),
        });
        await apiFetch(`${PHOTOS_API(vehicleId)}/reorder`, {
          method: "PATCH",
          body: JSON.stringify({ fileIds: reordered }),
        });
        addToast("success", "Primary photo updated.");
        onPhotosChange?.();
      } catch (err) {
        setPhotos(previous);
        addToast("error", getApiErrorMessage(err));
      }
    },
    [addToast, canManagePhotos, onPhotosChange, photos, vehicleId]
  );

  const handleDeletePhoto = React.useCallback(
    async (photoId: string) => {
      if (!canManagePhotos) return;
      const ok = await confirm({
        title: "Delete photo?",
        description: "This action cannot be undone.",
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
      });
      if (!ok) return;
      try {
        await apiFetch(`${PHOTOS_API(vehicleId)}/${photoId}`, {
          method: "DELETE",
          expectNoContent: true,
        });
        addToast("success", "Photo deleted.");
        await fetchPhotos();
        onPhotosChange?.();
      } catch (err) {
        addToast("error", getApiErrorMessage(err));
      }
    },
    [addToast, canManagePhotos, confirm, fetchPhotos, onPhotosChange, vehicleId]
  );

  const handleReorderPhoto = React.useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!canManagePhotos || fromIndex === toIndex) return;
      const current = [...photos];
      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);
      const optimistic = current.map((photo, index) => ({ ...photo, isPrimary: index === 0 }));
      const previous = photos;
      setPhotos(optimistic);
      try {
        await apiFetch(`${PHOTOS_API(vehicleId)}/reorder`, {
          method: "PATCH",
          body: JSON.stringify({ fileIds: current.map((photo) => photo.id) }),
        });
        addToast("success", "Photo order updated.");
        onPhotosChange?.();
      } catch (err) {
        setPhotos(previous);
        addToast("error", getApiErrorMessage(err));
      }
    },
    [addToast, canManagePhotos, onPhotosChange, photos, vehicleId]
  );

  const handleDeleteVideo = React.useCallback(
    async (videoId: string) => {
      if (!canManageVideos) return;
      const ok = await confirm({
        title: "Delete video?",
        description: "This removes the video from this session.",
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
      });
      if (!ok) return;

      setVideos((prev) => {
        const target = prev.find((video) => video.id === videoId);
        if (target) {
          URL.revokeObjectURL(target.url);
          createdVideoUrls.current.delete(target.url);
        }
        const next = prev.filter((video) => video.id !== videoId);
        return next.map((video, index) => ({ ...video, isPrimary: index === 0 }));
      });
    },
    [canManageVideos, confirm]
  );

  const handleSetPrimaryVideo = React.useCallback((videoId: string) => {
    setVideos((prev) => {
      const target = prev.find((video) => video.id === videoId);
      if (!target) return prev;
      const reordered = [target, ...prev.filter((video) => video.id !== videoId)];
      return reordered.map((video, index) => ({ ...video, isPrimary: index === 0 }));
    });
  }, []);

  const handleReorderVideo = React.useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setVideos((prev) => {
      const reordered = [...prev];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered.map((video, index) => ({ ...video, isPrimary: index === 0 }));
    });
  }, []);

  if (!canReadInventory) return null;

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-3 min-w-0 lg:grid-cols-[1fr_300px] ${className ?? ""}`}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[280px]" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[240px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  const primaryPhoto = photos[0] ?? null;
  const primaryPhotoUrl = primaryPhoto ? photoUrls[primaryPhoto.id] ?? null : null;
  const primaryVideo = videos[0] ?? null;

  return (
    <div className={`grid grid-cols-1 gap-3 min-w-0 lg:grid-cols-[1fr_300px] ${className ?? ""}`}>
      <input
        ref={photoInputRef}
        type="file"
        className="sr-only"
        accept="image/*"
        multiple
        disabled={!canManagePhotos || photoUploading || photos.length >= MAX_PHOTOS}
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) void uploadPhotoFiles(Array.from(files));
          event.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        className="sr-only"
        accept="video/*"
        multiple
        disabled={!canManageVideos || videoUploading || videos.length >= MAX_VIDEOS}
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) void uploadVideoFiles(Array.from(files));
          event.target.value = "";
        }}
      />

      <div className="flex flex-col gap-3 min-w-0">
        <PhotoGalleryCard
          photos={photos}
          photoUrls={photoUrls}
          canReadDocs={canReadDocs}
          canManage={canManagePhotos}
          photoUploading={photoUploading}
          photoUploadError={photoUploadError}
          isAtLimit={photos.length >= MAX_PHOTOS}
          onRequestUpload={() => photoInputRef.current?.click()}
          onSetPrimary={(photoId) => void handleSetPrimaryPhoto(photoId)}
          onDelete={(photoId) => void handleDeletePhoto(photoId)}
          onReorder={(from, to) => void handleReorderPhoto(from, to)}
        />
        <VideoGalleryCard
          videos={videos}
          canManage={canManageVideos}
          videoUploading={videoUploading}
          videoUploadError={videoUploadError}
          isAtLimit={videos.length >= MAX_VIDEOS}
          onRequestUpload={() => videoInputRef.current?.click()}
          onSetPrimary={handleSetPrimaryVideo}
          onDelete={(videoId) => void handleDeleteVideo(videoId)}
          onReorder={handleReorderVideo}
        />
      </div>

      <aside className="flex flex-col gap-3 min-w-0" role="complementary">
        <MediaUploadCard
          canManage={canManagePhotos || canManageVideos}
          photoCount={photos.length}
          photoLimit={MAX_PHOTOS}
          videoCount={videos.length}
          videoLimit={MAX_VIDEOS}
          photoUploading={photoUploading}
          videoUploading={videoUploading}
          photoUploadError={photoUploadError}
          videoUploadError={videoUploadError}
          onUploadPhotos={() => photoInputRef.current?.click()}
          onUploadVideos={() => videoInputRef.current?.click()}
          onDropFiles={(files) => {
            const images = files.filter((file) => file.type.startsWith("image/"));
            const videosOnly = files.filter((file) => file.type.startsWith("video/"));
            if (images.length) void uploadPhotoFiles(images);
            if (videosOnly.length) void uploadVideoFiles(videosOnly);
          }}
        />
        <MediaStatsCard
          photoCount={photos.length}
          videoCount={videos.length}
          photoLimit={MAX_PHOTOS}
          videoLimit={MAX_VIDEOS}
          primaryPhotoUrl={primaryPhotoUrl}
          primaryPhotoName={primaryPhoto?.filename ?? null}
          primaryVideoName={primaryVideo?.name ?? null}
        />
      </aside>
    </div>
  );
}
