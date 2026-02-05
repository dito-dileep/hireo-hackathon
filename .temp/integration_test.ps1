$body = @{ 
  answers = @{ 
    '1' = 1
    '2' = 0
    '3' = '45'
    '4' = 'for sum return array'
    '5' = 'We will add logs and monitoring and use feature flag for safe rollouts'
  }
  tabSwitches = 0
}
$resp = Invoke-RestMethod -Uri 'http://localhost:8000/score' -Method POST -Body ($body | ConvertTo-Json -Depth 10) -ContentType 'application/json'
$resp | ConvertTo-Json -Depth 10
Write-Host '---NEXT---'
$body.tabSwitches = 2
$resp2 = Invoke-RestMethod -Uri 'http://localhost:8000/score' -Method POST -Body ($body | ConvertTo-Json -Depth 10) -ContentType 'application/json'
$resp2 | ConvertTo-Json -Depth 10
Write-Host '---NEXT---'
$body2 = @{ score = 85; technicalScore = 90; reasoningScore = 80; tabSwitches = 0 }
$resp3 = Invoke-RestMethod -Uri 'http://localhost:8000/ai/explain' -Method POST -Body ($body2 | ConvertTo-Json -Depth 10) -ContentType 'application/json'
$resp3 | ConvertTo-Json -Depth 10
