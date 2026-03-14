#!/bin/bash
# Migration script for Computerzentrale
# Run this on the server to apply database migrations

set -e

CONTAINER_NAME="${1:-privatzentrale-computerzentrale-1}"

echo "Running database migrations in container: $CONTAINER_NAME"

# Run the compiled migration script (not tsx)
docker exec "$CONTAINER_NAME" node dist/database/migrate.js

echo "Migration completed successfully!"
