// SCAFFOLD — Cloudflare Worker stub for the Omega Platform.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
// Only a health check exists. No bindings, no secrets, no real services yet.

const worker: ExportedHandler = {
  fetch(request: Request): Response {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return Response.json({
        status: "ok",
        service: "omega-worker",
        scaffold: true,
      });
    }

    return Response.json(
      { status: "not_found", service: "omega-worker", scaffold: true },
      { status: 404 },
    );
  },
};

export default worker;
