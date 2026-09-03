$c = Get-Content -LiteralPath 'frontend/src/modules/pos-repair/pages/_check.txt'
$i = 0
foreach ($l in $c) {
  $i++
  $p =  0; $b =  0; $inStr = $false
  for ($j =  0; $j -lt $l.Length; $j++) {
    $ch = $l[$j]
    if ($inStr) {
      if ($ch -eq '\') { $j++ }
      elseif ($ch -eq '"') { $inStr = $false; continue }
      continue
    }
    if ($ch -eq '"') { $inStr = $true; continue }
    if ($ch -eq '(') { $p++ }
    elseif ($ch -eq ')') { $p-- }
    elseif ($ch -eq '{') { $b++ }
    elseif ($ch -eq '}') { $b-- }
  }
  if ($p -ne 0 -or $b -ne 0) {
    Write-Output ("LINE ${i} paren=${p} brace=${b} : ${l}")
  }
}