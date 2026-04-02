#!/bin/bash

# This script ensures that a .env file exists in the project root, and if not, creates one from .env.example.

set -euo pipefail

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
  else
    touch .env
  fi
fi

