'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DocumentQA from './document-qa';

export default function AnalystPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/signup');
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) {
    return null; // or a loader/spinner if you prefer
  }

  return (
    <div className="w-full h-screen overflow-hidden">
      <DocumentQA />
    </div>
  );
}
