#!/bin/sh

scripts/cleanup.sh

rm -rf demo/ docs/ node_modules/ scripts/ src/ test/ .* *.md *.sh package-lock.json cache.extra Dockerfile postcss.config.js server.js
