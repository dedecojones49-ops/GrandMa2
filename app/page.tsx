'use client';

import dynamic from 'next/dynamic';

const MaRemoteClient = dynamic(() => import('./MaRemoteClient'), {
  ssr: false,
});

export default function Page() {
  return <MaRemoteClient />;
}
