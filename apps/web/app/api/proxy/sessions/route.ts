/**
 * API Proxy for Sessions Endpoint
 *
 * This proxy route forwards requests to the Backend API Gateway,
 * solving CORS and Mixed Content issues in Playwright test environment.
 *
 * Usage: GET /api/proxy/sessions?limit=5&offset=0
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';
    const offset = searchParams.get('offset') || '0';
    const status = searchParams.get('status');

    // Build query string
    const params = new URLSearchParams({
      limit,
      offset,
      ...(status && { status }),
    });

    // Get authorization header from request
    const authorization = request.headers.get('authorization');

    if (!authorization) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } },
        { status: 401 }
      );
    }

    // Forward request to Backend API
    const backendUrl = `${API_BASE_URL}/sessions?${params.toString()}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[API Proxy] Sessions request failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: error instanceof Error ? error.message : 'Proxy request failed',
        },
      },
      { status: 500 }
    );
  }
}
