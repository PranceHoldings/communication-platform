/**
 * Audio Recorder Logger
 * Structured logging system for MediaRecorder lifecycle tracking
 */

export enum LogLevel {
  DEBUG = 'DEBUG', // Detailed debug info (development only)
  INFO = 'INFO', // Normal operation info
  WARN = 'WARN', // Warnings (operation continues)
  ERROR = 'ERROR', // Errors (operation stops)
}

export enum LogPhase {
  INIT = 'Init',
  RECORDING = 'Recording',
  RESTART_PHASE1 = 'Restart-Phase1',
  RESTART_PHASE2 = 'Restart-Phase2',
  RESTART_PHASE3 = 'Restart-Phase3',
  STOP = 'Stop',
  SILENCE = 'Silence',
  ERROR = 'Error',
}

interface LogContext {
  phase: LogPhase;
  timestamp: number;
  [key: string]: any;
}

export class AudioRecorderLogger {
  private sessionId: string;
  private isDevelopment: boolean;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  log(level: LogLevel, phase: LogPhase, message: string, data?: Record<string, any>) {
    const prefix = `[AudioRecorder:${phase}]`;
    const context: LogContext = {
      phase,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      ...data,
    };

    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(prefix, message, context);
        }
        break;
      case LogLevel.INFO:
        console.log(prefix, message, context);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, context);
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, context);
        break;
    }
  }

  // Convenience methods
  debug(phase: LogPhase, message: string, data?: Record<string, any>) {
    this.log(LogLevel.DEBUG, phase, message, data);
  }

  info(phase: LogPhase, message: string, data?: Record<string, any>) {
    this.log(LogLevel.INFO, phase, message, data);
  }

  warn(phase: LogPhase, message: string, data?: Record<string, any>) {
    this.log(LogLevel.WARN, phase, message, data);
  }

  error(phase: LogPhase, message: string, data?: Record<string, any>) {
    this.log(LogLevel.ERROR, phase, message, data);
  }

  // Specialized logging methods
  logChunk(sequence: number, size: number, isHeader: boolean) {
    this.debug(LogPhase.RECORDING, 'Chunk captured', {
      sequence,
      size,
      isHeader,
      expectedType: isHeader ? 'EBML (1a45dfa3)' : 'Fragment (43c38103)',
    });
  }

  logAudioLevel(level: number, threshold: number) {
    this.debug(LogPhase.RECORDING, 'Audio level', {
      level: level.toFixed(3),
      threshold,
      aboveThreshold: level > threshold,
    });
  }

  logSilenceDetected(duration: number, threshold: number) {
    this.info(LogPhase.SILENCE, 'Silence detected', {
      duration,
      threshold,
      willTriggerSpeechEnd: duration >= threshold,
    });
  }

  logRestartPhase1(oldRecorderState: RecordingState, currentSequence: number) {
    this.info(LogPhase.RESTART_PHASE1, 'Stopping old recorder', {
      state: oldRecorderState,
      bufferedSequence: currentSequence,
    });
  }

  logRestartPhase1Complete(handlersDisabled: { ondataavailable: boolean; onstop: boolean }) {
    this.info(LogPhase.RESTART_PHASE1, 'Old recorder stopped', {
      handlersDisabled,
    });
  }

  logRestartPhase2(sequenceNumber: number, speechEndSent: boolean) {
    this.info(LogPhase.RESTART_PHASE2, 'State reset', {
      sequenceNumber,
      speechEndSent,
    });
  }

  logRestartPhase3Created(mimeType: string) {
    this.info(LogPhase.RESTART_PHASE3, 'New recorder created', {
      mimeType,
    });
  }

  logRestartPhase3Started(state: RecordingState) {
    this.info(LogPhase.RESTART_PHASE3, 'New recorder started', {
      state,
    });
  }

  logEBMLHeaderVerification(isValid: boolean, expected: string, actual: string) {
    if (isValid) {
      this.info(LogPhase.RESTART_PHASE3, '✅ Valid EBML header', {
        expected,
        actual,
      });
    } else {
      this.error(LogPhase.RESTART_PHASE3, '❌ Invalid EBML header', {
        expected,
        actual,
      });
    }
  }
}

/**
 * EBML Header Verification Utility
 * Validates that the first chunk contains a valid EBML header
 */
export function verifyEBMLHeader(
  blob: Blob,
  logger: AudioRecorderLogger,
  sequence: number
): void {
  if (sequence !== 0 || process.env.NODE_ENV !== 'development') {
    return; // Only verify first chunk in development mode
  }

  const reader = new FileReader();
  reader.onload = () => {
    const buffer = new Uint8Array(reader.result as ArrayBuffer);
    const headerBytes = Array.from(buffer.slice(0, 4));
    const headerHex = headerBytes.map(b => b.toString(16).padStart(2, '0')).join(' ');

    const expectedHeader = [0x1a, 0x45, 0xdf, 0xa3];
    const isValid =
      headerBytes[0] === expectedHeader[0] &&
      headerBytes[1] === expectedHeader[1] &&
      headerBytes[2] === expectedHeader[2] &&
      headerBytes[3] === expectedHeader[3];

    logger.logEBMLHeaderVerification(isValid, '1a 45 df a3', headerHex);
  };

  reader.onerror = () => {
    logger.error(LogPhase.ERROR, 'Failed to read chunk for header verification', {
      sequence,
      blobSize: blob.size,
    });
  };

  reader.readAsArrayBuffer(blob);
}
