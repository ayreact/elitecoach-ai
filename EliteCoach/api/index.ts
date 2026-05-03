import app from "../dist/server/server.js";

export const config = {
  runtime: "nodejs",
};

function toHeaders(headers: Record<string, string | string[] | undefined>) {
  const result = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        result.append(key, item);
      }
      continue;
    }

    result.set(key, value);
  }

  return result;
}

async function readRequestBody(req: {
  method?: string;
  body?: unknown;
  readable?: boolean;
  on?: (event: string, listener: (chunk: Buffer) => void) => void;
}) {
  const method = req.method?.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }

  if (typeof req.body === "string" || req.body instanceof Buffer) {
    return req.body;
  }

  if (!req.readable || typeof req.on !== "function") {
    return undefined;
  }

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on?.("data", (chunk: Buffer) => chunks.push(chunk));
    req.on?.("end", () => resolve(Buffer.concat(chunks)));
    req.on?.("error", reject);
  });
}

export default async function handler(req: any, res: any) {
  const protocol =
    req.headers["x-forwarded-proto"] ??
    (req.headers.host?.includes("localhost") ? "http" : "https");
  const url = new URL(req.url ?? "/", `${protocol}://${req.headers.host}`);
  const body = await readRequestBody(req);

  const request = new Request(url.toString(), {
    method: req.method,
    headers: toHeaders(req.headers),
    body,
    duplex: body ? "half" : undefined,
  });

  const response = await app.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
