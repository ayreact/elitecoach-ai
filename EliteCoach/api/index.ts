// @ts-expect-error
import app from "../dist/server/server.js";
import { Buffer } from "node:buffer";

export const config = {
  runtime: "nodejs",
  // FIX 1: Disable automatic body parsing so the raw stream can be read correctly.
  // (Crucial for Vercel / Next.js API routes)
  api: {
    bodyParser: false,
  },
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

  // FIX 2: If the environment forcefully pre-parsed the body into a JSON object,
  // stringify it so it can still be passed to the Fetch Request.
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return JSON.stringify(req.body);
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
    // FIX 3: Cast body to BodyInit to satisfy strict TypeScript DOM checks
    body: body as BodyInit | null | undefined,
    // @ts-expect-error - duplex is required when body is a stream in some environments
    duplex: body ? "half" : undefined,
  });

  const response = await app.fetch(request);

  res.statusCode = response.status;
  
  // FIX 4: Handle Set-Cookie safely. Node.js requires an array of strings for 
  // multiple cookies, but Fetch Headers merge them. getSetCookie() prevents this.
  if (typeof response.headers.getSetCookie === "function") {
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      res.setHeader("set-cookie", setCookies);
    }
  }

  response.headers.forEach((value: string, key: string) => {
    if (key.toLowerCase() !== "set-cookie") {
      res.setHeader(key, value);
    }
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}