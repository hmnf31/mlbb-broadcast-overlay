(function (global) {
  'use strict';

  const HEARTBEAT_INTERVAL_MS = 20000;
  const PONG_TIMEOUT_MS = 10000;
  const BASE_BACKOFF_MS = 700;
  const MAX_BACKOFF_MS = 15000;
  const MAX_QUEUE = 8;
  const LOCAL_PORT_RANGE = [8765, 8784];

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function deepMerge(base, updates) {
    const result = structuredClone(base ?? {});
    for (const [key, value] of Object.entries(updates || {})) {
      if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  function buildLocalEndpoints() {
    const ports = [];
    for (let port = LOCAL_PORT_RANGE[0]; port <= LOCAL_PORT_RANGE[1]; port += 1) ports.push(port);
    ports.push(9000);
    return ports.map((port) => `ws://${global.location.hostname}:${port}`);
  }

  async function resolveEndpoints(slug) {
    // A slug only exists on the multi-profile Worker. The local Python backend has no
    // profiles and no auth handshake, so it keeps the port-scan fallback.
    if (slug && global.ProfileKit) {
      try {
        const response = await fetch('/runtime-config.json', { cache: 'no-store' });
        if (response.ok) return [global.ProfileKit.websocketUrl(slug)];
      } catch {
        /* fall through to local ports */
      }
    }

    try {
      const response = await fetch('/runtime-config.json', { cache: 'no-store' });
      if (!response.ok) return buildLocalEndpoints();
      const runtimeConfig = await response.json();
      if (runtimeConfig?.websocketUrl) return [runtimeConfig.websocketUrl];

      const ports = new Set();
      if (runtimeConfig?.websocketPort) ports.add(Number(runtimeConfig.websocketPort));
      for (let port = LOCAL_PORT_RANGE[0]; port <= LOCAL_PORT_RANGE[1]; port += 1) ports.add(port);
      ports.add(9000);
      return [...ports].map((port) => `ws://${global.location.hostname}:${port}`);
    } catch {
      return buildLocalEndpoints();
    }
  }

  class LiveSocket {
    constructor(options = {}) {
      this.role = options.role || 'client';
      this.slug = options.slug || null;
      this.ownerKey = options.ownerKey || '';
      this.onMessage = typeof options.onMessage === 'function' ? options.onMessage : () => {};
      this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
      this.heartbeatEnabled = options.heartbeat !== false;

      this.socket = null;
      this.endpoints = [];
      this.endpoint = '';
      this.endpointIndex = 0;
      this.failures = 0;
      this.attempt = 0;
      this.queue = [];
      this.started = false;
      this.stopped = false;

      // 'none' | 'pending' | 'owner' | 'viewer'. Writes stay queued until the
      // handshake resolves, otherwise an owner update can be rejected as viewer.
      this.authState = this.slug ? 'pending' : 'none';

      this.reconnectTimer = null;
      this.heartbeatTimer = null;
      this.pongTimer = null;
    }

    get isOpen() {
      return this.socket?.readyState === WebSocket.OPEN;
    }

    get canWrite() {
      return !this.slug || this.authState === 'owner';
    }

    setState(state, detail = '') {
      this.onStatus(state, {
        detail,
        endpoint: this.endpoint,
        role: this.role,
        authState: this.authState,
        canWrite: this.canWrite,
        slug: this.slug,
        queue: this.queue.length,
      });
    }

    async start() {
      if (this.started) return;
      this.started = true;
      this.stopped = false;
      this.endpoints = await resolveEndpoints(this.slug);
      this.open();

      global.addEventListener('online', () => this.reconnectNow('internet kembali online'));
      global.addEventListener('pagehide', () => this.stop());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isOpen) this.reconnectNow('tab kembali aktif');
      });
    }

    open() {
      if (this.stopped) return;
      this.clearReconnect();
      if (!this.endpoints.length) this.endpoints = buildLocalEndpoints();
      this.endpoint = this.endpoints[this.endpointIndex % this.endpoints.length];
      this.setState('connecting', this.endpoint);

      let socket;
      try {
        socket = new WebSocket(this.endpoint);
      } catch {
        this.failures += 1;
        this.scheduleReconnect();
        return;
      }

      this.socket = socket;
      let opened = false;

      socket.addEventListener('open', () => {
        if (this.socket !== socket) return;
        opened = true;
        this.failures = 0;
        this.attempt = 0;
        this.clearPong();
        this.startHeartbeat();

        if (this.slug) {
          // The server answers with hello + snapshot, then we identify ourselves.
          // The queue stays parked until auth_ok arrives.
          this.authState = 'pending';
          this.setState('connecting', 'menunggu otorisasi');
          this.rawSend({ type: 'auth', key: this.ownerKey });
        } else {
          this.authState = 'none';
          this.setState('online', this.endpoint);
          this.rawSend({ type: 'command', command: 'request_state' });
          this.flush();
        }
      });

      socket.addEventListener('message', (event) => {
        if (this.socket !== socket) return;
        let message = null;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message?.type === 'pong') {
          this.clearPong();
          return;
        }
        if (message?.type === 'auth_ok') {
          this.authState = message.role === 'owner' ? 'owner' : 'viewer';
          this.setState('online', message.message || this.endpoint);
          this.rawSend({ type: 'command', command: 'request_state' });
          this.flush();
          return;
        }
        if (message?.type === 'error' && message.code === 'forbidden') {
          this.setState('offline', message.message);
          return;
        }
        this.onMessage(message);
      });

      socket.addEventListener('close', () => {
        if (this.socket !== socket) return;
        this.socket = null;
        this.stopHeartbeat();
        if (this.stopped) return;
        if (opened) {
          this.failures = 0;
        } else {
          this.failures += 1;
        }
        this.setState('offline', this.endpoint);
        this.scheduleReconnect();
      });
    }

    scheduleReconnect() {
      this.clearReconnect();
      if (this.stopped) return;

      this.attempt += 1;
      if (this.endpoints.length > 1 && this.failures >= 1) {
        this.endpointIndex = (this.endpointIndex + 1) % this.endpoints.length;
        this.failures = 0;
      }

      const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** Math.min(this.attempt, 5)));
      const delay = Math.round(backoff * (0.7 + Math.random() * 0.6));
      this.reconnectTimer = global.setTimeout(() => {
        this.reconnectTimer = null;
        this.open();
      }, delay);
    }

    reconnectNow(reason = '') {
      if (this.stopped) return;
      this.attempt = 0;
      this.failures = 0;
      this.clearReconnect();
      if (this.socket) {
        const stale = this.socket;
        this.socket = null;
        try {
          stale.close();
        } catch {
          /* socket already dead */
        }
      }
      if (!this.isOpen) {
        this.setState('connecting', reason);
        this.open();
      }
    }

    rawSend(message) {
      if (!this.isOpen) return false;
      try {
        this.socket.send(JSON.stringify(message));
        return true;
      } catch {
        return false;
      }
    }

    send(message) {
      // Reading is always allowed; writing is refused once we know we are a viewer so
      // the control panel can surface the problem instead of silently dropping updates.
      const writeTypes = new Set(['update', 'assets']);
      const isWrite = writeTypes.has(message?.type)
        || (message?.type === 'command' && message?.command !== 'request_state');

      if (this.slug && isWrite && this.authState === 'viewer') return 'rejected';

      if (this.isOpen) {
        if (this.slug && isWrite && this.authState === 'pending') {
          this.queueMessage(message);
          return 'queued';
        }
        if (this.rawSend(message)) return 'sent';
        this.queueMessage(message);
        return 'queued';
      }
      this.queueMessage(message);
      return 'queued';
    }

    queueMessage(message) {
      const last = this.queue[this.queue.length - 1];
      if (last && last.type === 'update' && message.type === 'update') {
        last.payload = deepMerge(last.payload || {}, message.payload || {});
      } else {
        this.queue.push(message);
      }
      if (this.queue.length > MAX_QUEUE) {
        this.queue = [this.queue[this.queue.length - 1]];
      }
    }

    flush() {
      if (!this.isOpen || !this.queue.length) return;
      if (this.slug && this.authState === 'pending') return;
      const pending = this.queue;
      this.queue = [];
      for (const message of pending) {
        if (!this.rawSend(message)) this.queue.push(message);
      }
    }

    startHeartbeat() {
      this.stopHeartbeat();
      if (!this.heartbeatEnabled) return;

      this.heartbeatTimer = global.setInterval(() => {
        if (!this.isOpen || this.pongTimer) return;
        this.send({ type: 'ping' });
        this.pongTimer = global.setTimeout(() => {
          this.pongTimer = null;
          const dead = this.socket;
          this.socket = null;
          try {
            dead?.close();
          } catch {
            /* already dead */
          }
          if (!this.stopped) {
            this.stopHeartbeat();
            this.setState('offline', 'heartbeat tidak dijawab');
            this.scheduleReconnect();
          }
        }, PONG_TIMEOUT_MS);
      }, HEARTBEAT_INTERVAL_MS);
    }

    stopHeartbeat() {
      if (this.heartbeatTimer) global.clearInterval(this.heartbeatTimer);
      if (this.pongTimer) global.clearTimeout(this.pongTimer);
      this.heartbeatTimer = null;
      this.pongTimer = null;
    }

    clearPong() {
      if (this.pongTimer) global.clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }

    clearReconnect() {
      if (this.reconnectTimer) global.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    stop() {
      this.stopped = true;
      this.clearReconnect();
      this.stopHeartbeat();
      if (this.socket) {
        const active = this.socket;
        this.socket = null;
        try {
          active.close();
        } catch {
          /* already closed */
        }
      }
    }
  }

  global.LiveSocket = {
    create: (options) => new LiveSocket(options),
    deepMerge,
    resolveEndpoints,
  };
})(window);