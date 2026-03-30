'use client';

import { useState, useEffect } from 'react';

export default function TestWebSocketPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [wsEndpoint, setWsEndpoint] = useState<string>('');
  const [token, setToken] = useState<string>('');

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  useEffect(() => {
    // Check environment variable
    const endpoint = process.env.NEXT_PUBLIC_WS_ENDPOINT;
    setWsEndpoint(endpoint || 'NOT SET');
    addLog(`Environment: NEXT_PUBLIC_WS_ENDPOINT = ${endpoint || 'NOT SET'}`);

    // Check localStorage token
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('accessToken');
      setToken(accessToken || 'NOT FOUND');
      addLog(`LocalStorage: accessToken = ${accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT FOUND'}`);
    }
  }, []);

  const testConnection = () => {
    addLog('--- Starting WebSocket Test ---');

    if (!wsEndpoint || wsEndpoint === 'NOT SET') {
      addLog('ERROR: WebSocket endpoint not configured');
      return;
    }

    if (!token || token === 'NOT FOUND') {
      addLog('ERROR: Access token not found');
      return;
    }

    try {
      const url = `${wsEndpoint}?token=${encodeURIComponent(token)}`;
      addLog(`Attempting connection to: ${wsEndpoint}`);
      addLog(`Full URL: ${url.substring(0, 100)}...`);

      const ws = new WebSocket(url);

      ws.onopen = () => {
        addLog('✅ WebSocket OPENED');
        // Send authenticate message
        const authMsg = {
          type: 'authenticate',
          sessionId: 'test-session-id',
          scenarioPrompt: 'Test prompt',
          scenarioLanguage: 'en',
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(authMsg));
        addLog('Sent authenticate message');
      };

      ws.onerror = (event) => {
        addLog(`❌ WebSocket ERROR: ${JSON.stringify(event)}`);
        addLog(`ReadyState: ${ws.readyState}`);
      };

      ws.onclose = (event) => {
        addLog(`WebSocket CLOSED: code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}`);
      };

      ws.onmessage = (event) => {
        addLog(`Message received: ${event.data}`);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          addLog('⏱️ Connection timeout after 10 seconds');
          ws.close();
        } else if (ws.readyState === WebSocket.OPEN) {
          addLog('✅ Connection still open after 10 seconds');
          ws.close();
        }
      }, 10000);

    } catch (error) {
      addLog(`EXCEPTION: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">WebSocket Connection Test</h1>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p className="font-semibold">Configuration:</p>
        <p className="text-sm">Endpoint: <code className="bg-white px-2 py-1">{wsEndpoint}</code></p>
        <p className="text-sm">Token: <code className="bg-white px-2 py-1">{token.substring(0, 30)}...</code></p>
      </div>

      <button
        onClick={testConnection}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-4"
      >
        Test WebSocket Connection
      </button>

      <div className="bg-black text-green-400 p-4 rounded font-mono text-xs overflow-auto max-h-96">
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
        {logs.length === 0 && <div>No logs yet...</div>}
      </div>
    </div>
  );
}
