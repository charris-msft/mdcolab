# Copilot Instructions

## Docker

When a command requires Docker (e.g., `azd deploy`, `docker build`), start Docker Desktop automatically if it's not running:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
# Wait for the Docker daemon to be ready
while (-not (docker info 2>$null)) { Start-Sleep -Seconds 2 }
```

Do not ask the user to start Docker manually — just start it.
