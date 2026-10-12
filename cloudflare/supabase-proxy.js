const SUPABASE_ORIGIN = "https://fqcltmxiarohfpfnghjn.supabase.co";
const WORKSTATION_ORIGIN = "https://hub.jam-balance.ru";
const CHECK_PATH = "/__supabase_proxy_check";
const ALLOWED_API_PREFIXES = [
  "/auth/v1",
  "/rest/v1",
  "/storage/v1",
  "/functions/v1",
  "/realtime/v1",
  "/graphql/v1"
];

function json(message, status) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function isAllowedApiPath(path) {
  return ALLOWED_API_PREFIXES.some(function (prefix) {
    return path === prefix || path.startsWith(prefix + "/");
  });
}

function relayWebSocket(source, destination) {
  source.addEventListener("message", function (event) {
    if (destination.readyState === WebSocket.OPEN) {
      try {
        destination.send(event.data);
      } catch (_) {
        destination.close(1011, "WebSocket relay error");
      }
    }
  });

  source.addEventListener("close", function (event) {
    if (destination.readyState < WebSocket.CLOSING) {
      try {
        destination.close(event.code, event.reason);
      } catch (_) {}
    }
  });

  source.addEventListener("error", function () {
    if (destination.readyState < WebSocket.CLOSING) {
      try {
        destination.close(1011, "WebSocket relay error");
      } catch (_) {}
    }
  });
}

async function proxyWebSocket(request, target) {
  const upstreamResponse = await fetch(new Request(target.toString(), request));
  const upstreamSocket = upstreamResponse.webSocket;

  if (!upstreamSocket) {
    if (upstreamResponse.status >= 400 && upstreamResponse.status <= 599) {
      return upstreamResponse;
    }
    return json("Supabase did not accept the WebSocket connection", 502);
  }

  const pair = new WebSocketPair();
  const clientSocket = pair[0];
  const workerSocket = pair[1];

  workerSocket.accept({ allowHalfOpen: true });
  upstreamSocket.accept({ allowHalfOpen: true });

  relayWebSocket(workerSocket, upstreamSocket);
  relayWebSocket(upstreamSocket, workerSocket);

  return new Response(null, {
    status: 101,
    webSocket: clientSocket
  });
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);

    if (incoming.pathname === CHECK_PATH && request.method === "GET") {
      const target = new URL("/auth/v1/health", SUPABASE_ORIGIN);
      const probe = await fetch(target.toString(), {
        method: "GET",
        headers: { "cache-control": "no-cache" }
      });

      return new Response(probe.body, {
        status: probe.status,
        headers: {
          "content-type": probe.headers.get("content-type") || "application/json",
          "cache-control": "no-store"
        }
      });
    }

    if (!isAllowedApiPath(incoming.pathname)) {
      return json("Path is not allowed", 404);
    }

    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST" &&
        request.method !== "PUT" && request.method !== "PATCH" && request.method !== "DELETE" &&
        request.method !== "OPTIONS") {
      return json("Method is not allowed", 405);
    }

    const origin = request.headers.get("origin");
    if (origin !== WORKSTATION_ORIGIN) {
      return json("Origin is not allowed", 403);
    }

    const target = new URL(incoming.pathname + incoming.search, SUPABASE_ORIGIN);
    const upgrade = request.headers.get("upgrade");

    try {
      if (upgrade && upgrade.toLowerCase() === "websocket") {
        if (!incoming.pathname.startsWith("/realtime/v1/")) {
          return json("WebSocket path is not allowed", 404);
        }
        return await proxyWebSocket(request, target);
      }

      return await fetch(new Request(target.toString(), request));
    } catch (_) {
      return json("Could not reach Supabase from the proxy", 502);
    }
  }
};
