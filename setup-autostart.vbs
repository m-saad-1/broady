' Broady Windows Task Scheduler Setup Script
' Run this script manually or right-click -> Run as Administrator

Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objShell = CreateObject("WScript.Shell")

TaskName = "Broady-AutoStartup"
ScriptPath = "D:\WEB DEVELOPMENT\Broady\start-broady.bat"

' Check if running as admin
If Not objFSO.FolderExists("C:\Windows\Temp") Then
    MsgBox "This script must be run as Administrator. Please right-click this file and select 'Run as Administrator'.", vbCritical, "Broady Setup"
    WScript.Quit 1
End If

' Delete existing task if it exists
On Error Resume Next
objShell.Run "schtasks /delete /tn " & Chr(34) & TaskName & Chr(34) & " /f", 0, True
On Error GoTo 0

' Create new task
CommandLine = "schtasks /create /tn " & Chr(34) & TaskName & Chr(34) & " /tr " & Chr(34) & "cmd.exe /c " & ScriptPath & Chr(34) & " /sc onstart /rl highest /f"
ExitCode = objShell.Run(CommandLine, 0, True)

If ExitCode = 0 Then
    MsgBox "✓ Broady auto-startup task created successfully!" & vbCrLf & vbCrLf & _
           "The application will now start automatically on Windows boot." & vbCrLf & _
           "PM2 will restore API and Web services.", vbInformation, "Broady Setup Complete"
Else
    MsgBox "✗ Failed to create scheduled task. Exit code: " & ExitCode & vbCrLf & vbCrLf & _
           "Make sure you ran this script as Administrator.", vbCritical, "Broady Setup Failed"
End If

WScript.Quit ExitCode
