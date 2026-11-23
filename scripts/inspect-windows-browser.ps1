param(
  [int]$BrowserProcess,
  [string]$Label,
  [switch]$Invoke,
  [string]$Shortcut,
  [string]$Profile,
  [ValidateSet('chrome.exe', 'firefox.exe')] [string]$Executable,
  [string]$AppArgument,
  [ValidateSet('Button', 'Edit', 'Text')] [string]$ControlType = 'Button',
  [string]$Ancestor,
  [switch]$ReadValue,
  [switch]$Close
)

$ErrorActionPreference = 'Stop'
if ($Shortcut) {
  $link = (New-Object -ComObject WScript.Shell).CreateShortcut($Shortcut)
  @{ target = $link.TargetPath; arguments = $link.Arguments } | ConvertTo-Json -Compress
  exit
}
if ($Profile) {
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = '$Executable'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf($Profile, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $_.CommandLine.IndexOf($AppArgument, [StringComparison]::Ordinal) -ge 0
  })
  if ($processes.Count -gt 1) { throw 'More than one process matched the registered app and test profile' }
  @{ pid = if ($processes.Count -eq 1) { $processes[0].ProcessId } else { 0 } } | ConvertTo-Json -Compress
  exit
}

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$process = Get-Process -Id $BrowserProcess
if ($Close) {
  if (!$process.CloseMainWindow()) { throw 'Could not close the registered test app window' }
  @{ closed = $process.WaitForExit(8000) } | ConvertTo-Json -Compress
  exit
}
if (!$process.MainWindowHandle) {
  if ($Invoke) { throw 'Browser window is unavailable' }
  @{ matches = 0; title = ''; value = $null } | ConvertTo-Json -Compress
  exit
}
$window = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
$scope = [System.Windows.Automation.TreeScope]::Descendants
$all = $window.FindAll($scope, [System.Windows.Automation.Condition]::TrueCondition)
$kind = [System.Windows.Automation.ControlType]::Button
if ($ControlType -eq 'Edit') { $kind = [System.Windows.Automation.ControlType]::Edit }
if ($ControlType -eq 'Text') { $kind = [System.Windows.Automation.ControlType]::Text }
function In-Region($element) {
  if (!$Ancestor) { return $true }
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  for ($parent = $walker.GetParent($element); $parent; $parent = $walker.GetParent($parent)) {
    if ($parent.Current.Name -eq $Ancestor) { return $true }
    if ($parent.Equals($window)) { break }
  }
  return $false
}
$matches = @($all | Where-Object {
  !$_.Current.IsOffscreen -and
    $_.Current.ControlType -eq $kind -and
    (@($_.Current.Name, $_.Current.HelpText, $_.Current.AutomationId) -contains $Label) -and (In-Region $_)
})

if ($Invoke) {
  if ($matches.Count -ne 1) { throw "Expected one native browser control for '$Label', found $($matches.Count)" }
  $pattern = $null
  if (!$matches[0].TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    throw 'Native browser control does not support Invoke'
  }
  $pattern.Invoke()
}
$value = $null
if ($ReadValue -and $matches.Count -eq 1) {
  $pattern = $null
  if ($matches[0].TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
    $value = $pattern.Current.Value
  } elseif ($matches[0].TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) {
    $value = $pattern.DocumentRange.GetText(-1)
  }
}
@{ matches = $matches.Count; title = $window.Current.Name; value = $value } | ConvertTo-Json -Compress
