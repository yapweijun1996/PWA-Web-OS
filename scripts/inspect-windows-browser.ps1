param(
  [int]$BrowserProcess,
  [string]$Label,
  [switch]$Invoke,
  [string]$Shortcut
)

$ErrorActionPreference = 'Stop'
if ($Shortcut) {
  $link = (New-Object -ComObject WScript.Shell).CreateShortcut($Shortcut)
  @{ target = $link.TargetPath; arguments = $link.Arguments } | ConvertTo-Json -Compress
  exit
}

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$process = Get-Process -Id $BrowserProcess
if (!$process.MainWindowHandle) { throw 'Browser window is unavailable' }
$window = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
$scope = [System.Windows.Automation.TreeScope]::Descendants
$all = $window.FindAll($scope, [System.Windows.Automation.Condition]::TrueCondition)
$matches = @($all | Where-Object {
  !$_.Current.IsOffscreen -and
    $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
    (@($_.Current.Name, $_.Current.HelpText, $_.Current.AutomationId) -contains $Label)
})

if ($Invoke) {
  if ($matches.Count -ne 1) { throw "Expected one native browser control for '$Label', found $($matches.Count)" }
  $pattern = $null
  if (!$matches[0].TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    throw 'Native browser control does not support Invoke'
  }
  $pattern.Invoke()
}
@{ matches = $matches.Count; title = $window.Current.Name } | ConvertTo-Json -Compress
