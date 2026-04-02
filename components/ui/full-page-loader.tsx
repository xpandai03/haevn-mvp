'use client'

import { HaevnLoader } from './haevn-loader'

interface FullPageLoaderProps {
  message?: string;
}

export default function FullPageLoader({ message }: FullPageLoaderProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <HaevnLoader size={160} />
      {message && (
        <p
          className="text-haevn-charcoal mt-4 text-sm"
          style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
