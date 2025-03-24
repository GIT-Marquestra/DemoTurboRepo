'use client'; 

import dynamic from 'next/dynamic';
const WebContainerIDE = dynamic(
  () => import('../components/WebContainer'),
  { ssr: false } 
);

export default function YourPage() {
  return (
    <div>
      <h1>WebContainer IDE</h1>
      <WebContainerIDE />
    </div>
  );
}