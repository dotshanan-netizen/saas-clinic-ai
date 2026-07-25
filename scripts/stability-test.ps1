$durationMinutes = 30
$endTime = (Get-Date).AddMinutes($durationMinutes)
$logFile = "stability_test_log.txt"

$routes = @(
    "http://localhost:3000/dashboard",
    "http://localhost:3000/dashboard/settings",
    "http://localhost:3000/dashboard/knowledge",
    "http://localhost:3000/dashboard/appointments",
    "http://localhost:3000/api/health"
)

"Starting 30-minute Stability Run at $(Get-Date)" | Out-File $logFile

while ((Get-Date) -lt $endTime) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    
    # 1. Hit Routes
    $routeLogs = ""
    foreach ($route in $routes) {
        try {
            $res = Invoke-WebRequest -Uri $route -UseBasicParsing -TimeoutSec 5
            $routeLogs += "[$($res.StatusCode)] "
        } catch {
            $routeLogs += "[ERR:$($_.Exception.Message)] "
        }
    }

    # 2. Monitor Node.js Process
    $nodeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Sort-Object CPU -Descending | Select-Object -First 1
    if ($nodeProcess) {
        $memMB = [math]::Round($nodeProcess.WorkingSet64 / 1MB, 2)
        $cpu = [math]::Round($nodeProcess.CPU, 2)
        $handles = $nodeProcess.HandleCount
        $metrics = "Mem: ${memMB}MB, CPU: ${cpu}s, Handles: $handles"
    } else {
        $metrics = "Node process not found! Server might have crashed."
    }

    # 3. Log
    $logEntry = "[$timestamp] Routes: $routeLogs | Metrics: $metrics"
    $logEntry | Out-File $logFile -Append

    # Wait 10 seconds before next iteration to avoid spamming too fast, but fast enough to test stability
    Start-Sleep -Seconds 10
}

"Stability Run Completed at $(Get-Date)" | Out-File $logFile -Append
