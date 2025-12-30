'use client'

import LoadingLines from "./loading-lines";

interface FullPageLoaderProps {
  message?: string;
}

export default function FullPageLoader({ message }: FullPageLoaderProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <LoadingLines />
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
