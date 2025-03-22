// In your page file
'use client'; // Mark as client component

import dynamic from 'next/dynamic';

// Dynamically import with no SSR
const WebContainerIDE = dynamic(
  () => import('../components/WebContainer'),
  { ssr: false } // This is crucial - prevents SSR
);

export default function YourPage() {
  return (
    <div>
      <h1>WebContainer IDE</h1>
      <WebContainerIDE />
    </div>
  );
}