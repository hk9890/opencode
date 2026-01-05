oc#!/bin/bash
# Start opencode in development mode

cd "$(dirname "$0")/../packages/opencode" || exit 1
bun dev "$@"
