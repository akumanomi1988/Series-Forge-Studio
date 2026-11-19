# Series Forge Studio - offline Windows OneCore TTS adapter.
# Input: JSON file path (args[0]) with { ssml, voice, output, metaOutput }.
# Output: WAV file + JSON with word boundaries reported by the engine itself.
param([Parameter(Mandatory=$true)][string]$RequestPath)
$ErrorActionPreference = 'Stop'
$req = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) { $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op)); $null = $t.Wait(-1); return $t.Result }
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
try {
  if ($req.listVoices) {
    $voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { [pscustomobject]@{ id = $_.Id; name = $_.DisplayName; language = $_.Language; gender = [string]$_.Gender } }
    $voices | ConvertTo-Json -Compress | Out-File -LiteralPath $req.metaOutput -Encoding utf8
    exit 0
  }
  $voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $req.voice -or $_.Id -eq $req.voice } | Select-Object -First 1
  if (-not $voice) { throw "Voz no instalada: $($req.voice)" }
  $synth.Voice = $voice
  $synth.Options.IncludeWordBoundaryMetadata = $true
  $synth.Options.IncludeSentenceBoundaryMetadata = $false
  $stream = Await ($synth.SynthesizeSsmlToStreamAsync($req.ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $words = @()
  foreach ($track in $stream.TimedMetadataTracks) {
    foreach ($cue in $track.Cues) {
      $words += [pscustomobject]@{ text = $cue.Text; start = $cue.StartTime.TotalSeconds; duration = $cue.Duration.TotalSeconds; inputStart = $cue.StartPositionInInput; inputEnd = $cue.EndPositionInInput }
    }
  }
  $netStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
  $tmp = $req.output + '.part'
  $fs = [System.IO.File]::Create($tmp)
  try { $netStream.CopyTo($fs) } finally { $fs.Dispose(); $netStream.Dispose() }
  Move-Item -LiteralPath $tmp -Destination $req.output -Force
  [pscustomobject]@{ voice = $voice.DisplayName; voiceId = $voice.Id; language = $voice.Language; words = $words } | ConvertTo-Json -Depth 4 -Compress | Out-File -LiteralPath $req.metaOutput -Encoding utf8
} finally { $synth.Dispose() }
