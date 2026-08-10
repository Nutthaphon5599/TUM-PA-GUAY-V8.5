"use strict";
(function () {
  const state = {
    client: null,
    refreshPromise: null,
    lastRefresh: 0,
    online: navigator.onLine,
  };

  const AUTH_HINTS = ["jwt expired", "invalid jwt", "refresh token", "not authenticated", "token is expired"];

  function isAuthError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return error?.status === 401 || AUTH_HINTS.some((hint) => message.includes(hint));
  }

  async function refresh(force = false) {
    const client = state.client;
    if (!client) return null;
    if (state.refreshPromise) return state.refreshPromise;

    if (!force && Date.now() - state.lastRefresh < 30_000) {
      const { data } = await client.auth.getSession();
      return data?.session || null;
    }

    state.refreshPromise = (async () => {
      try {
        const { data, error } = await client.auth.refreshSession();
        if (error) throw error;
        state.lastRefresh = Date.now();
        return data?.session || null;
      } finally {
        state.refreshPromise = null;
      }
    })();

    return state.refreshPromise;
  }

  async function ensureSession() {
    const client = state.client;
    if (!client) return null;

    const { data, error } = await client.auth.getSession();
    if (error && isAuthError(error)) return refresh(true);
    if (error) throw error;
    if (!data?.session) return null;

    const expiresAt = Number(data.session.expires_at || 0) * 1000;
    if (expiresAt - Date.now() < 180_000) return refresh(true);
    return data.session;
  }

  function createRetryingFetch() {
    return async function retryingFetch(input, init = {}) {
      const request = input instanceof Request ? input : new Request(input, init);
      const isAuthEndpoint = request.url.includes("/auth/v1/");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      const options = { ...init, signal: init.signal || controller.signal };

      try {
        let response = await fetch(input, options);
        if (response.status !== 401 || isAuthEndpoint) return response;

        const session = await refresh(true).catch(() => null);
        if (!session?.access_token) return response;

        const headers = new Headers(request.headers);
        new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
        headers.set("Authorization", `Bearer ${session.access_token}`);

        response = await fetch(request.url, {
          ...options,
          method: request.method,
          headers,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.clone().blob(),
        });
        return response;
      } finally {
        clearTimeout(timeout);
      }
    };
  }

  function createClient(url, key) {
    const client = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "tpg-v83-final-auth",
      },
      global: {
        headers: { "x-client-info": "tum-pa-guay-v8.3-final" },
        fetch: createRetryingFetch(),
      },
      realtime: { params: { eventsPerSecond: 5 } },
    });

    state.client = client;
    client.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") state.lastRefresh = Date.now();
    });
    return client;
  }

  async function run(operation, { retry = true } = {}) {
    try {
      await ensureSession();
      const result = await operation();
      if (result?.error && retry && isAuthError(result.error)) {
        const session = await refresh(true);
        if (session) return operation();
      }
      return result;
    } catch (error) {
      if (retry && isAuthError(error)) {
        const session = await refresh(true);
        if (session) return operation();
      }
      throw error;
    }
  }

  function friendly(error) {
    if (isAuthError(error)) return "ເຊດຊັນກຳລັງຕໍ່ອາຍຸ ກະລຸນາລອງອີກຄັ້ງ.";
    if (!navigator.onLine) return "ອິນເຕີເນັດຂາດການເຊື່ອມຕໍ່. ລະບົບຈະກັບມາເມື່ອອອນລາຍ.";
    if (error?.name === "AbortError") return "ການເຊື່ອມຕໍ່ຊ້າເກີນໄປ. ກະລຸນາກວດອິນເຕີເນັດແລ້ວລອງໃໝ່.";
    return error?.message || String(error || "ເກີດຂໍ້ຜິດພາດ");
  }

  async function resume() {
    if (document.visibilityState !== "visible" || !navigator.onLine) return;
    await ensureSession().catch((error) => console.warn("Session resume failed", error));
  }

  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("online", () => { state.online = true; resume(); });
  window.addEventListener("offline", () => { state.online = false; });
  setInterval(() => {
    if (document.visibilityState === "visible" && navigator.onLine) resume();
  }, 3 * 60 * 1000);

  window.TPG_STABILITY = { createClient, ensureSession, refresh, run, isAuthError, friendly };
})();
