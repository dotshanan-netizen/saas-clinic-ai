# Dependency Failure Matrix Test

$logFile = "matrix_test_log.txt"
"Starting Matrix Test at $(Get-Date)" | Out-File $logFile

function Check-Route {
    param($url, $name)
    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
        "[$name] Success (200)" | Out-File $logFile -Append
    } catch {
        "[$name] Failed ($($_.Exception.Message))" | Out-File $logFile -Append
    }
}

function Check-Health {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
        "[Health] Status 200" | Out-File $logFile -Append
    } catch {
        "[Health] Failed ($($_.Exception.Message))" | Out-File $logFile -Append
    }
}

# 1. Baseline Test
"--- BASELINE ---" | Out-File $logFile -Append
Check-Route "http://localhost:3000/dashboard" "Dashboard"
Check-Health

# 2. Redis Down Test (Simulated by stopping the container or port blocking)
# In this environment, we just assume Redis is stopped manually by the orchestrator, 
# or we can test it if we can kill redis-server.
"--- REDIS DOWN ---" | Out-File $logFile -Append
# Kill redis if running locally:
Get-Process -Name "redis-server" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Check-Route "http://localhost:3000/dashboard" "Dashboard"
Check-Health

# 3. PostgreSQL Down Test
"--- DB DOWN ---" | Out-File $logFile -Append
# Stop postgres service if running locally
Stop-Service -Name "postgresql*" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Check-Route "http://localhost:3000/dashboard" "Dashboard"
Check-Health

"Matrix Test Completed at $(Get-Date)" | Out-File $logFile -Append
