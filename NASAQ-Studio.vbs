' NASAQ Studio+ launcher - opens the app as a normal program (no black cmd window).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
exe = dir & "\node_modules\electron\dist\electron.exe"
If Not fso.FileExists(exe) Then
  MsgBox "First run: installing components. This can take a few minutes, please wait.", 64, "NASAQ Studio+"
  sh.Run "cmd /c npm install", 1, True
End If
If fso.FileExists(exe) Then
  sh.Run """" & exe & """ .", 1, False
Else
  MsgBox "Install failed. Make sure Node.js is installed, then run the old .bat once.", 16, "NASAQ Studio+"
End If
