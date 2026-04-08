/**
 * React 19 + @react-three/fiber type compatibility shim
 *
 * React 19 removed the global `JSX` namespace in favor of `React.JSX`.
 * @react-three/fiber v8 (transitive dep) still uses the deprecated global JSX approach.
 * This file patches the JSX IntrinsicElements to include Three.js fiber elements.
 */
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
