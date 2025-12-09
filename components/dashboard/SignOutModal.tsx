'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface SignOutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isLoading?: boolean
}

export function SignOutModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false
}: SignOutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader className="text-center">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Sign Out
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-2">
            Are you sure you want to sign out?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="flex-1 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-red-500 hover:bg-red-600"
          >
            {isLoading ? 'Signing out...' : 'Sign Out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
