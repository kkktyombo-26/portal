'use client'

// lib/polyfills/uint8array.ts
//
// Polyfills for newer TC39 proposals that pdf.js 6.x depends on. Each
// patch is wrapped independently so a failure in one doesn't block the
// others, and a window marker is set so we can verify from devtools
// that this module actually executed (rather than being tree-shaken
// or silently failing mid-script).
//
// IMPORTANT: this file needs 'use client' at the top. Without it,
// when imported from a Server Component (e.g. app/layout.tsx with no
// 'use client' directive), Next.js's RSC compiler can prune this
// side-effect-only module out of the client bundle entirely, since it
// has no client-facing exports and isn't otherwise detected as
// client-required code. With 'use client' present, Next.js correctly
// includes it in the client JS sent to the browser.

declare global {
  interface Window {
    __polyfillsApplied?: string[]
  }
}

type Uint8ArrayPolyfilled = Uint8Array & {
  toHex?: () => string
  toBase64?: () => string
}

type Uint8ArrayCtorPolyfilled = Uint8ArrayConstructor & {
  fromHex?: (hex: string) => Uint8Array
  fromBase64?: (base64: string) => Uint8Array
}

type MapPolyfilled = Map<unknown, unknown> & {
  getOrInsertComputed?: (key: unknown, callbackFn: (key: unknown) => unknown) => unknown
}

type WeakMapPolyfilled = WeakMap<WeakKey, unknown> & {
  getOrInsertComputed?: (key: WeakKey, callbackFn: (key: WeakKey) => unknown) => unknown
}

if (typeof window !== 'undefined') {
  window.__polyfillsApplied = []

  const u8proto = Uint8Array.prototype as Uint8ArrayPolyfilled
  const u8ctor = Uint8Array as unknown as Uint8ArrayCtorPolyfilled
  const mapProto = Map.prototype as MapPolyfilled
  const weakMapProto = WeakMap.prototype as WeakMapPolyfilled

  try {
    if (!u8proto.toHex) {
      u8proto.toHex = function (this: Uint8Array) {
        return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('')
      }
      window.__polyfillsApplied.push('toHex')
    }
  } catch (e) {
    console.error('[polyfill] toHex failed:', e)
  }

  try {
    if (!u8ctor.fromHex) {
      u8ctor.fromHex = function (hex: string) {
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
        }
        return bytes
      }
      window.__polyfillsApplied.push('fromHex')
    }
  } catch (e) {
    console.error('[polyfill] fromHex failed:', e)
  }

  try {
    if (!u8proto.toBase64) {
      u8proto.toBase64 = function (this: Uint8Array) {
        let binary = ''
        for (let i = 0; i < this.length; i++) binary += String.fromCharCode(this[i])
        return btoa(binary)
      }
      window.__polyfillsApplied.push('toBase64')
    }
  } catch (e) {
    console.error('[polyfill] toBase64 failed:', e)
  }

  try {
    if (!u8ctor.fromBase64) {
      u8ctor.fromBase64 = function (base64: string) {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return bytes
      }
      window.__polyfillsApplied.push('fromBase64')
    }
  } catch (e) {
    console.error('[polyfill] fromBase64 failed:', e)
  }

  try {
    if (!mapProto.getOrInsertComputed) {
      mapProto.getOrInsertComputed = function (this: Map<unknown, unknown>, key, callbackFn) {
        if (this.has(key)) return this.get(key)
        const value = callbackFn(key)
        this.set(key, value)
        return value
      }
      window.__polyfillsApplied.push('Map.getOrInsertComputed')
    }
  } catch (e) {
    console.error('[polyfill] Map.getOrInsertComputed failed:', e)
  }

  try {
    if (!weakMapProto.getOrInsertComputed) {
      weakMapProto.getOrInsertComputed = function (this: WeakMap<WeakKey, unknown>, key, callbackFn) {
        if (this.has(key)) return this.get(key)
        const value = callbackFn(key)
        this.set(key, value)
        return value
      }
      window.__polyfillsApplied.push('WeakMap.getOrInsertComputed')
    }
  } catch (e) {
    console.error('[polyfill] WeakMap.getOrInsertComputed failed:', e)
  }
}

export {}