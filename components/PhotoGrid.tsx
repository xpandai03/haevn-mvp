'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Image as ImageIcon, Lock } from 'lucide-react'
import type { PhotoMetadata } from '@/lib/types/profile'

interface PhotoGridProps {
  photos: PhotoMetadata[]
  locked?: boolean
  lockMessage?: string
}

export function PhotoGrid({ photos, locked = false, lockMessage }: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMetadata | null>(null)

  if (locked) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <div className="text-center">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Photos Locked</h3>
            <p className="text-sm text-muted-foreground">
              {lockMessage || 'Photos unlock after a handshake'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (photos.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <div className="text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No photos available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <Card
            key={photo.id}
            className="relative overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            onClick={() => setSelectedPhoto(photo)}
          >
            <CardContent className="p-0">
              <div className="aspect-square relative bg-muted">
                {photo.photo_url.startsWith('http') || photo.photo_url.startsWith('blob:') ? (
                  <img
                    src={photo.photo_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                {photo.nsfw_flag && (
                  <Badge className="absolute top-2 right-2" variant="destructive">
                    NSFW
                  </Badge>
                )}
                {photo.photo_type === 'private' && (
                  <Badge className="absolute bottom-2 left-2" variant="secondary">
                    Private
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-0">
          {selectedPhoto && (
            <div className="relative">
              <img
                src={selectedPhoto.photo_url}
                alt=""
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              {selectedPhoto.nsfw_flag && (
                <Badge className="absolute top-4 right-4" variant="destructive">
                  NSFW
                </Badge>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}