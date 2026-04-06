#!/bin/bash

ollama serve &

until ollama list > /dev/null 2>&1; do
  echo "Waiting for Ollama..."
  sleep 2
done

echo "Checking model..."

if ollama list | grep -q mamay; then
  echo "Mamay already installed"
else
  echo "Installing Mamay..."
  ollama create mamay -f /models/Modelfile
fi

wait

# run "ollama rm mamay" to remove the model