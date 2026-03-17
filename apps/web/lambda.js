/**
 * AWS Lambda Adapter for Next.js Standalone Build
 * Handles API Gateway HTTP API events and forwards to Next.js server
 * Supports full SSR, Server Components, API Routes, and Middleware
 */

const path = require('path');
const { createServer } = require('http');
const { parse } = require('url');

// Initialize Next.js app in standalone mode
let app;
let server;
let appPrepared = false;

async function initNextApp() {
  if (!app) {
    // Require Next.js from standalone build
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
 * Convert API Gateway HTTP API event to Node.js http request format
 */
function eventToRequest(event) {
  const {
    requestContext,
    headers = {},
    body,
    isBase64Encoded,
  } = event;

  const method = requestContext.http.method;
  const path = requestContext.http.path;
  const queryString = event.rawQueryString || '';
  const url = queryString ? `${path}?${queryString}` : path;

  return {
    method,
    url,
    headers: {
      ...headers,
      'x-forwarded-for': requestContext.http.sourceIp,
      'x-forwarded-proto': headers['x-forwarded-proto'] || 'https',
      'x-forwarded-host': headers.host || headers.Host,
    },
    body: body ? (isBase64Encoded ? Buffer.from(body, 'base64') : body) : undefined,
  };
}

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  // Enable connection reuse for better performance
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Initialize Next.js app
    const nextApp = await initNextApp();
    const requestHandler = nextApp.getRequestHandler();

    // Convert API Gateway event to request
    const request = eventToRequest(event);
    const parsedUrl = parse(request.url, true);

    // Create mock request/response objects
    const mockReq = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      connection: { remoteAddress: request.headers['x-forwarded-for'] },
    };

    let responseBody = '';
    let responseHeaders = {};
    let statusCode = 200;

    const mockRes = {
      statusCode: 200,
      headers: {},
      finished: false,

      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },

      getHeader(name) {
        return this.headers[name.toLowerCase()];
      },

      removeHeader(name) {
        delete this.headers[name.toLowerCase()];
      },

      writeHead(code, headers) {
        this.statusCode = code;
        if (headers) {
          Object.keys(headers).forEach(key => {
            this.setHeader(key, headers[key]);
          });
        }
      },

      write(chunk) {
        responseBody += chunk;
      },

      end(chunk) {
        if (chunk) {
          responseBody += chunk;
        }
        this.finished = true;
        statusCode = this.statusCode;
        responseHeaders = this.headers;
      },
    };

    // Handle request with Next.js
    await requestHandler(mockReq, mockRes, parsedUrl);

    // Wait for response to finish
    await new Promise((resolve) => {
      const checkFinished = setInterval(() => {
        if (mockRes.finished) {
          clearInterval(checkFinished);
          resolve();
        }
      }, 10);
    });

    // Return API Gateway response
    return {
      statusCode,
      headers: responseHeaders,
      body: responseBody,
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
      }),
    };
  }
};
