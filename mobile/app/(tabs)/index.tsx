// Map tab. The actual map component lives in components/NativeMap.tsx
// with a web stub in components/NativeMap.web.tsx — Metro picks the
// right one based on the bundle target, so this route file is the
// same on every platform.

import NativeMap from '@/components/NativeMap';

export default function MapScreen() {
  return <NativeMap />;
}
