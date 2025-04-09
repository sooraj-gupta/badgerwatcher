on run {messageText, recipientNumber}
    tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy recipientNumber of targetService
        send messageText to targetBuddy
    end tell
end run
