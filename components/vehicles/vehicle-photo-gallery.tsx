"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Images } from "lucide-react";
import { Button } from "@/components/ui/button";

type GalleryPhoto = {
  id?: string;
  publicUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string | null;
  sequenceNumber?: number | null;
  imageType?: string | null;
};

type VehiclePhotoGalleryProps = {
  photos?: GalleryPhoto[];
  mainImageUrl?: string | null;
  vehicleTitle?: string | null;
};

function photoUrl(photo: GalleryPhoto) {
  return photo.publicUrl ?? photo.imageUrl ?? "";
}

function galleryBaseKey(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("imageType");
    parsed.searchParams.sort();
    return parsed.toString().toLowerCase();
  } catch {
    return url.replace(/[?&]imageType=[^&]+/i, "").toLowerCase();
  }
}

export function VehiclePhotoGallery({ photos = [], mainImageUrl, vehicleTitle }: VehiclePhotoGalleryProps) {
  const galleryPhotos = useMemo(() => {
    const grouped = new Map<string, Array<GalleryPhoto & { publicUrl: string; thumbnailUrl: string; sequenceNumber: number }>>();

    photos
      .map((photo, index) => ({
        ...photo,
        sequenceNumber: photo.sequenceNumber ?? index + 1,
        publicUrl: photoUrl(photo),
        thumbnailUrl: photo.thumbnailUrl ?? photoUrl(photo)
      }))
      .filter((photo): photo is GalleryPhoto & { publicUrl: string; thumbnailUrl: string; sequenceNumber: number } => Boolean(photo.publicUrl))
      .forEach((photo) => {
        const key = photo.sequenceNumber ? `seq:${photo.sequenceNumber}` : `url:${galleryBaseKey(photo.publicUrl)}`;
        const group = grouped.get(key) ?? [];
        group.push(photo);
        grouped.set(key, group);
      });

    const normalized = [...grouped.values()]
      .map((group) => group[0])
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    if (normalized.length === 0 && mainImageUrl) {
      return [
        {
          publicUrl: mainImageUrl,
          thumbnailUrl: mainImageUrl,
          sequenceNumber: 1
        }
      ];
    }

    return normalized;
  }, [mainImageUrl, photos]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const selectedPhoto = galleryPhotos[selectedIndex];
  const hasPhotos = galleryPhotos.length > 0;

  function navigate(direction: -1 | 1) {
    if (galleryPhotos.length <= 1) {
      return;
    }

    setSelectedIndex((current) => (current + direction + galleryPhotos.length) % galleryPhotos.length);
  }

  return (
    <>
      <div className="overflow-hidden rounded-[1.4rem] border border-border bg-white">
        <div className="relative aspect-[16/10] bg-background">
          {hasPhotos ? (
            <img src={selectedPhoto.publicUrl} alt={`Foto ${selectedIndex + 1} de ${vehicleTitle ?? "veículo"}`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
              <Images className="h-10 w-10" />
              <p className="text-sm font-medium">Nenhuma foto disponível</p>
            </div>
          )}

          {galleryPhotos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-primary shadow-sm transition hover:bg-white"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-primary shadow-sm transition hover:bg-white"
                aria-label="Próxima foto"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}

          {hasPhotos ? (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
              Foto {selectedIndex + 1} de {galleryPhotos.length}
            </div>
          ) : null}

          {hasPhotos ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/90 text-primary shadow-sm transition hover:bg-white"
              aria-label="Ver foto em tamanho maior"
            >
              <Expand className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {galleryPhotos.length > 1 ? (
          <div className="space-y-3 border-t border-border bg-background/45 p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {galleryPhotos.map((photo, index) => (
                <button
                  key={`${photo.publicUrl}-${index}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border bg-white transition ${
                    selectedIndex === index ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-primary/30"
                  }`}
                  aria-label={`Selecionar foto ${index + 1}`}
                >
                  <img src={photo.thumbnailUrl ?? photo.publicUrl} alt={`Miniatura ${index + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setExpanded(true)} className="gap-2">
                <Images className="h-4 w-4" />
                Ver todas as fotos
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {expanded && hasPhotos ? (
        <div className="fixed inset-0 z-50 grid bg-slate-950/88 p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar galeria" onClick={() => setExpanded(false)} />
          <div className="relative z-10 m-auto grid max-h-[92vh] w-full max-w-6xl gap-3">
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <p className="text-sm font-semibold text-primary">
                Foto {selectedIndex + 1} de {galleryPhotos.length}
              </p>
              <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
                Fechar
              </Button>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <img src={selectedPhoto.publicUrl} alt={`Foto ampliada ${selectedIndex + 1}`} className="max-h-[76vh] w-full object-contain" />
              {galleryPhotos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(1)}
                    className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary"
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
