#!/usr/bin/env node
/**
 * Phase 1.5 Performance Test Script
 *
 * Tests real-time conversation system performance:
 * - WebSocket connection latency
 * - STT -> AI -> TTS pipeline response time
 * - Concurrent connection load test
 *
 * Usage:
 *   npm run perf:test              # Single session test
 *   npm run perf:test -- --load 10 # Load test with 10 concurrent sessions
 *   npm run perf:test -- --verbose # Detailed logging
 *
 * Target metrics (Phase 1.5 completion criteria):
 * - Average response time: < 4 seconds
 * - 95th percentile: < 6 seconds
 * - Success rate: > 95%
 */

import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceMetrics {
  connectionTime: number;
  sttStartTime?: number;
  sttEndTime?: number;
  aiStartTime?: number;
  aiEndTime?: number;
  ttsStartTime?: number;
  ttsEndTime?: number;
  totalResponseTime?: number;
  success: boolean;
  error?: string;
}

interface TestResult {
  sessionId: string;
  metrics: PerformanceMetrics;
  timestamp: string;
}

class PerformanceTest {
  private wsUrl: string;
  private authToken: string;
  private results: TestResult[] = [];
  private verbose: boolean;

  constructor(wsUrl: string, authToken: string, verbose = false) {
    this.wsUrl = wsUrl;
    this.authToken = authToken;
    this.verbose = verbose;
  }

  /**
   * Run single session performance test
   */
  async runSingleTest(sessionId: string): Promise<TestResult> {
    const metrics: PerformanceMetrics = {
      connectionTime: 0,
      success: false,
    };

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Include token in query parameters for authentication
      const url = `${this.wsUrl}?token=${encodeURIComponent(this.authToken)}`;
      const ws = new WebSocket(url);
      let connected = false;

      // Timeout after 30 seconds
      const timeout = setTimeout(() => {
        if (!connected) {
          ws.close();
          metrics.error = 'Connection timeout';
          resolve({
            sessionId,
            metrics,
            timestamp: new Date().toISOString(),
          });
        }
      }, 30000);

      ws.on('open', () => {
        connected = true;
        metrics.connectionTime = Date.now() - startTime;

        if (this.verbose) {
          console.log(`[${sessionId}] Connected in ${metrics.connectionTime}ms`);
        }

        // Send authentication message
        ws.send(
          JSON.stringify({
            type: 'authenticate',
            sessionId,
            timestamp: Date.now(),
          })
        );

        // Simulate audio chunk (1-second WebM chunk, ~5KB)
        // In real scenario, this would be actual audio data
        const mockAudioChunk = Buffer.alloc(5000).toString('base64');

        metrics.sttStartTime = Date.now();

        // Send real-time audio chunk
        ws.send(
          JSON.stringify({
            type: 'audio_chunk_realtime',
            data: mockAudioChunk,
            timestamp: Date.now(),
          })
        );

        // Send speech_end to trigger STT processing
        setTimeout(() => {
          ws.send(
            JSON.stringify({
              type: 'speech_end',
              timestamp: Date.now(),
            })
          );
        }, 100); // Wait 100ms before ending speech

        if (this.verbose) {
          console.log(`[${sessionId}] Sent audio chunk`);
        }
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());

          if (this.verbose) {
            console.log(`[${sessionId}] Received:`, message.type);
          }

          switch (message.type) {
            case 'transcript':
              metrics.sttEndTime = Date.now();
              if (metrics.sttStartTime) {
                const sttTime = metrics.sttEndTime - metrics.sttStartTime;
                if (this.verbose) {
                  console.log(`[${sessionId}] STT completed in ${sttTime}ms`);
                }
              }
              break;

            case 'ai_chunk_start':
              metrics.aiStartTime = Date.now();
              break;

            case 'ai_chunk':
              // AI response streaming
              break;

            case 'ai_chunk_end':
              metrics.aiEndTime = Date.now();
              if (metrics.aiStartTime) {
                const aiTime = metrics.aiEndTime - metrics.aiStartTime;
                if (this.verbose) {
                  console.log(`[${sessionId}] AI response completed in ${aiTime}ms`);
                }
              }
              break;

            case 'tts_chunk_start':
              metrics.ttsStartTime = Date.now();
              break;

            case 'tts_chunk':
              // TTS audio streaming
              break;

            case 'tts_chunk_end':
              metrics.ttsEndTime = Date.now();
              if (metrics.ttsStartTime) {
                const ttsTime = metrics.ttsEndTime - metrics.ttsStartTime;
                if (this.verbose) {
                  console.log(`[${sessionId}] TTS completed in ${ttsTime}ms`);
                }
              }

              // Calculate total response time
              if (metrics.sttStartTime && metrics.ttsEndTime) {
                metrics.totalResponseTime = metrics.ttsEndTime - metrics.sttStartTime;
                metrics.success = true;

                if (this.verbose) {
                  console.log(`[${sessionId}] Total pipeline time: ${metrics.totalResponseTime}ms`);
                }
              }

              // Test complete
              clearTimeout(timeout);
              ws.close();
              resolve({
                sessionId,
                metrics,
                timestamp: new Date().toISOString(),
              });
              break;

            case 'error':
              metrics.error = message.message || 'Unknown error';
              clearTimeout(timeout);
              ws.close();
              resolve({
                sessionId,
                metrics,
                timestamp: new Date().toISOString(),
              });
              break;
          }
        } catch (error) {
          console.error(`[${sessionId}] Failed to parse message:`, error);
        }
      });

      ws.on('error', error => {
        metrics.error = error.message;
        clearTimeout(timeout);
        resolve({
          sessionId,
          metrics,
          timestamp: new Date().toISOString(),
        });
      });

      ws.on('close', () => {
        if (!metrics.success && !metrics.error) {
          metrics.error = 'Connection closed prematurely';
        }
        clearTimeout(timeout);
        resolve({
          sessionId,
          metrics,
          timestamp: new Date().toISOString(),
        });
      });
    });
  }

  /**
   * Run load test with concurrent connections
   */
  async runLoadTest(concurrentSessions: number): Promise<void> {
    console.log(`\n🚀 Starting load test with ${concurrentSessions} concurrent sessions...\n`);

    const promises: Promise<TestResult>[] = [];

    for (let i = 0; i < concurrentSessions; i++) {
      const sessionId = `perf-test-${Date.now()}-${i}`;
      promises.push(this.runSingleTest(sessionId));

      // Stagger connections by 100ms to avoid thundering herd
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.results = await Promise.all(promises);
    this.printResults();
  }

  /**
   * Print performance test results
   */
  private printResults(): void {
    const successful = this.results.filter(r => r.metrics.success);
    const failed = this.results.filter(r => !r.metrics.success);

    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE TEST RESULTS');
    console.log('='.repeat(80) + '\n');

    // Success rate
    const successRate = (successful.length / this.results.length) * 100;
    console.log(
      `Success Rate: ${successRate.toFixed(1)}% (${successful.length}/${this.results.length})`
    );

    if (successful.length === 0) {
      console.log('\n❌ No successful tests. Check errors below.\n');
      failed.forEach(r => {
        console.log(`[${r.sessionId}] Error: ${r.metrics.error}`);
      });
      return;
    }

    // Response time statistics
    const responseTimes = successful
      .map(r => r.metrics.totalResponseTime!)
      .filter(t => t > 0)
      .sort((a, b) => a - b);

    if (responseTimes.length > 0) {
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const median = responseTimes[Math.floor(responseTimes.length / 2)];
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const min = responseTimes[0];
      const max = responseTimes[responseTimes.length - 1];

      console.log('\nTotal Response Time (STT → AI → TTS):');
      console.log(`  Average:  ${(avg / 1000).toFixed(2)}s`);
      console.log(`  Median:   ${(median / 1000).toFixed(2)}s`);
      console.log(`  95th %:   ${(p95 / 1000).toFixed(2)}s`);
      console.log(`  Min:      ${(min / 1000).toFixed(2)}s`);
      console.log(`  Max:      ${(max / 1000).toFixed(2)}s`);

      // Phase 1.5 completion criteria
      console.log('\n🎯 Phase 1.5 Completion Criteria:');
      const avgPass = avg < 4000;
      const p95Pass = p95 < 6000;
      const successRatePass = successRate > 95;

      console.log(
        `  ✓ Average < 4s:     ${avgPass ? '✅ PASS' : '❌ FAIL'} (${(avg / 1000).toFixed(2)}s)`
      );
      console.log(
        `  ✓ 95th % < 6s:      ${p95Pass ? '✅ PASS' : '❌ FAIL'} (${(p95 / 1000).toFixed(2)}s)`
      );
      console.log(
        `  ✓ Success rate > 95%: ${successRatePass ? '✅ PASS' : '❌ FAIL'} (${successRate.toFixed(1)}%)`
      );

      const allPass = avgPass && p95Pass && successRatePass;
      console.log(`\n${allPass ? '✅ ALL CRITERIA MET' : '❌ CRITERIA NOT MET'}`);
    }

    // Component breakdown
    console.log('\nComponent Breakdown (Average):');
    const avgConnection =
      successful.reduce((a, r) => a + r.metrics.connectionTime, 0) / successful.length;
    console.log(`  Connection:  ${avgConnection.toFixed(0)}ms`);

    const sttTimes = successful
      .map(r =>
        r.metrics.sttEndTime && r.metrics.sttStartTime
          ? r.metrics.sttEndTime - r.metrics.sttStartTime
          : 0
      )
      .filter(t => t > 0);
    if (sttTimes.length > 0) {
      const avgSTT = sttTimes.reduce((a, b) => a + b, 0) / sttTimes.length;
      console.log(`  STT:         ${avgSTT.toFixed(0)}ms`);
    }

    const aiTimes = successful
      .map(r =>
        r.metrics.aiEndTime && r.metrics.aiStartTime
          ? r.metrics.aiEndTime - r.metrics.aiStartTime
          : 0
      )
      .filter(t => t > 0);
    if (aiTimes.length > 0) {
      const avgAI = aiTimes.reduce((a, b) => a + b, 0) / aiTimes.length;
      console.log(`  AI:          ${avgAI.toFixed(0)}ms`);
    }

    const ttsTimes = successful
      .map(r =>
        r.metrics.ttsEndTime && r.metrics.ttsStartTime
          ? r.metrics.ttsEndTime - r.metrics.ttsStartTime
          : 0
      )
      .filter(t => t > 0);
    if (ttsTimes.length > 0) {
      const avgTTS = ttsTimes.reduce((a, b) => a + b, 0) / ttsTimes.length;
      console.log(`  TTS:         ${avgTTS.toFixed(0)}ms`);
    }

    // Errors
    if (failed.length > 0) {
      console.log(`\n❌ Failed Tests (${failed.length}):`);
      failed.forEach(r => {
        console.log(`  [${r.sessionId}] ${r.metrics.error}`);
      });
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Save detailed results to file
    this.saveResults();
  }

  /**
   * Save detailed results to JSON file
   */
  private saveResults(): void {
    const resultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(resultsDir, `performance-test-${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`📄 Detailed results saved to: ${filename}\n`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const loadTestIndex = args.indexOf('--load');
  const concurrentSessions = loadTestIndex >= 0 ? parseInt(args[loadTestIndex + 1], 10) : 1;
  const verbose = args.includes('--verbose');

  // Configuration
  const WS_URL =
    process.env.WEBSOCKET_URL || 'wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

  if (!AUTH_TOKEN) {
    console.error('❌ Error: AUTH_TOKEN environment variable is required');
    console.error('\nUsage:');
    console.error('  export AUTH_TOKEN="your-jwt-token"');
    console.error('  npm run perf:test');
    process.exit(1);
  }

  const test = new PerformanceTest(WS_URL, AUTH_TOKEN, verbose);

  if (concurrentSessions > 1) {
    await test.runLoadTest(concurrentSessions);
  } else {
    console.log('\n🚀 Starting single session performance test...\n');
    const result = await test.runSingleTest(`perf-test-${Date.now()}`);

    console.log('\n📊 Test Result:');
    console.log(`  Session ID: ${result.sessionId}`);
    console.log(`  Success: ${result.metrics.success ? '✅' : '❌'}`);
    if (result.metrics.totalResponseTime) {
      console.log(
        `  Total Response Time: ${(result.metrics.totalResponseTime / 1000).toFixed(2)}s`
      );
    }
    if (result.metrics.error) {
      console.log(`  Error: ${result.metrics.error}`);
    }
    console.log('');
  }
}

main().catch(console.error);
