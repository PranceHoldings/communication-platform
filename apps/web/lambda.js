/**
 * AWS Lambda Adapter for Next.js Standalone Build
 * Handles API Gateway HTTP API events and forwards to Next.js server
 *
 * IMPORTANT: This adapter uses buffered responses (not streaming)
 * because Lambda + API Gateway HTTP API does not support streaming responses
 */

const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

// MIME type map for static files
const MIME_TYPES = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

/**
 * Serve static files from the Lambda filesystem
 * Handles /_next/static/* and /public/* paths
 */
function serveStaticFile(urlPath) {
  let filePath;

  if (urlPath.startsWith('/_next/static/')) {
    filePath = path.join(__dirname, '.next', 'static', urlPath.slice('/_next/static/'.length));
  } else if (urlPath.startsWith('/public/')) {
    filePath = path.join(__dirname, 'public', urlPath.slice('/public/'.length));
  } else {
    // Check if file exists directly in public/
    filePath = path.join(__dirname, 'public', urlPath);
  }

  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isText = contentType.startsWith('text/') || contentType === 'application/javascript' || contentType === 'application/json';

    return {
      statusCode: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=31536000, immutable',
      },
      body: isText ? data.toString('utf-8') : data.toString('base64'),
      isBase64Encoded: !isText,
    };
  } catch (e) {
    return null;
  }
}

// Initialize Next.js app in standalone mode
let app;
let appPrepared = false;

async function initNextApp() {
  if (!app) {
    const NextServer = require('next/dist/server/next-server').default;
    const config = require('./.next/required-server-files.json').config;

    app = new NextServer({
      hostname: 'localhost',
      port: 3000,
      dir: __dirname,
      dev: false,
      customServer: true,
      conf: config,
    });

    await app.prepare();
    appPrepared = true;
    console.log('Next.js app initialized successfully');
  }
  return app;
}

/**
 * Convert API Gateway HTTP API event to Node.js IncomingMessage-compatible object
 */
function createMockRequest(event) {
  const { requestContext, headers = {}, body, isBase64Encoded } = event;

  const method = requestContext.http.method;
  const path = requestContext.http.path;
  const queryString = event.rawQueryString || '';
  const url = queryString ? `${path}?${queryString}` : path;

  // Create readable stream from body
  const bodyStream = new Readable();
  bodyStream.push(body ? (isBase64Encoded ? Buffer.from(body, 'base64') : body) : null);
  bodyStream.push(null);

  // Extend stream to be IncomingMessage-like
  bodyStream.method = method;
  bodyStream.url = url;
  bodyStream.headers = {
    ...headers,
    'x-forwarded-for': requestContext.http.sourceIp,
    'x-forwarded-proto': headers['x-forwarded-proto'] || 'https',
    'x-forwarded-host': headers.host || headers.Host,
  };
  bodyStream.httpVersion = '1.1';
  bodyStream.connection = {
    remoteAddress: requestContext.http.sourceIp,
    encrypted: true,
  };

  return bodyStream;
}

/**
 * Create mock ServerResponse that buffers output
 * Returns [response, promise] tuple where promise resolves when response finishes
 */
function createMockResponse() {
  const chunks = [];
  let statusCode = 200;
  const headers = {};
  let finished = false;
  let resolveFinished;

  // Create promise that resolves when response.end() is called
  const finishedPromise = new Promise((resolve) => {
    resolveFinished = resolve;
  });

  const response = {
    statusCode: 200,
    headers,
    headersSent: false,
    finished: false,

    // Header methods
    setHeader(name, value) {
      headers[name.toLowerCase()] = String(value);
    },

    getHeader(name) {
      return headers[name.toLowerCase()];
    },

    getHeaders() {
      return { ...headers };
    },

    hasHeader(name) {
      return name.toLowerCase() in headers;
    },

    removeHeader(name) {
      delete headers[name.toLowerCase()];
    },

    writeHead(code, headersOrReason, headersOrUndefined) {
      statusCode = code;
      this.statusCode = code;
      this.headersSent = true;

      let headersToSet = {};
      if (typeof headersOrReason === 'object') {
        headersToSet = headersOrReason;
      } else if (headersOrUndefined) {
        headersToSet = headersOrUndefined;
      }

      Object.entries(headersToSet).forEach(([key, value]) => {
        this.setHeader(key, value);
      });

      return this;
    },

    // Response body methods
    write(chunk, encoding, callback) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      if (typeof callback === 'function') {
        process.nextTick(callback);
      }
      return true;
    },

    end(chunk, encoding, callback) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }

      finished = true;
      this.finished = true;
      statusCode = this.statusCode;

      // Resolve the promise when response finishes
      if (resolveFinished) {
        process.nextTick(() => {
          if (typeof callback === 'function') {
            callback();
          }
          resolveFinished();
        });
      } else if (typeof callback === 'function') {
        process.nextTick(callback);
      }
    },

    // Helper to get buffered body
    getBody() {
      return Buffer.concat(chunks).toString('utf-8');
    },

    getStatusCode() {
      return statusCode;
    },

    // Stream-like methods (no-op for buffered responses)
    flushHeaders() {
      this.headersSent = true;
    },

    // EventEmitter-like methods (no-op for buffered responses)
    on() {},
    once() {},
    emit() {},
    removeListener() {},
  };

  return [response, finishedPromise];
}

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const urlPath = event.requestContext?.http?.path || '/';

  // Serve static files directly from filesystem (Next.js standalone does not serve these)
  if (urlPath.startsWith('/_next/static/') || urlPath.startsWith('/images/') || urlPath.startsWith('/models/') || urlPath.startsWith('/fonts/')) {
    const staticResponse = serveStaticFile(urlPath);
    if (staticResponse) return staticResponse;
  }

  try {
    const nextApp = await initNextApp();
    const requestHandler = nextApp.getRequestHandler();

    // Create mock request/response objects
    const mockReq = createMockRequest(event);
    const [mockRes, finishedPromise] = createMockResponse();

    // Handle request with Next.js (this may or may not return a promise)
    requestHandler(mockReq, mockRes);

    // Wait for response to finish with timeout
    await Promise.race([
      finishedPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Response timeout after 29s')), 29000)
      ),
    ]);

    // Return API Gateway response
    return {
      statusCode: mockRes.getStatusCode(),
      headers: mockRes.getHeaders(),
      body: mockRes.getBody(),
      isBase64Encoded: false,
    };

  } catch (error) {
    console.error('Lambda handler error:', error);

    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
    };
  }
};
