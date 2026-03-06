#!/bin/bash
# Kill process on specified port

PORT=$1

if [ -z "$PORT" ]; then
  echo "Usage: ./kill-port.sh <port>"
  exit 1
fi

echo "Checking for processes on port $PORT..."

# Find and kill process using the port
PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
  echo "No process found on port $PORT"
else
  echo "Killing process $PID on port $PORT..."
  kill -9 $PID
  echo "Process killed successfully"
fi
