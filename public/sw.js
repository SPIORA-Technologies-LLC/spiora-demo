const CACHE_VERSION = "spiora-pwa-v8";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/icon-maskable-512x512.png",
];

function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  );
}

function isNextAssetRequest(url) {
  return (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js"
  );
}

function isStaticAssetRequest(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".woff2")
  );
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkPromise;
    return cached;
  }

  const response = await networkPromise;
  if (response) {
    return response;
  }

  return new Response("Offline", { status: 503, statusText: "Offline" });
}

async function applyBadge(count) {
  const safe = Math.max(0, Math.floor(Number(count) || 0));
  try {
    if (safe <= 0 && typeof self.registration.clearAppBadge === "function") {
      await self.registration.clearAppBadge();
      return;
    }
    if (typeof self.registration.setAppBadge === "function") {
      await self.registration.setAppBadge(safe);
    }
  } catch {
    // Badging may be unsupported.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn("[sw] precache skipped:", url, error);
          }
        }),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "SPIORA_SET_BADGE") {
    event.waitUntil(applyBadge(data.count));
    return;
  }

  if (data.type === "SPIORA_SHOW_NOTIFICATION") {
    const title = String(data.title || "Spiora");
    const options = {
      body: String(data.body || ""),
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: data.tag || `spiora-${Date.now()}`,
      renotify: true,
      requireInteraction: false,
      silent: false,
      data: {
        url: data.url || "/",
        notificationId: data.notificationId || null,
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Spiora",
    body: "",
    url: "/",
    tag: `spiora-push-${Date.now()}`,
    count: null,
  };

  try {
    if (event.data) {
      const json = event.data.json();
      payload = {
        title: String(json.title || payload.title),
        body: String(json.body || ""),
        url: String(json.url || "/"),
        tag: String(json.tag || payload.tag),
        count: json.count == null ? null : Number(json.count),
      };
    }
  } catch {
    try {
      payload.body = event.data ? event.data.text() : "";
    } catch {
      // ignore
    }
  }

  event.waitUntil(
    (async () => {
      if (payload.count != null && !Number.isNaN(payload.count)) {
        await applyBadge(payload.count);
      }
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag: payload.tag,
        renotify: true,
        data: { url: payload.url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && targetUrl) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // ignore navigate failures
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isNavigationRequest(event.request) || isNextAssetRequest(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isStaticAssetRequest(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
