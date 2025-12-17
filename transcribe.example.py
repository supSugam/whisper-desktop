from curl_cffi import requests, CurlMime
import os
import browser_cookie3
import subprocess
import signal
import sys
import json
import datetime

def get_chatgpt_credentials():
    print("Loading cookies from Chrome...")
    
    # Explicitly target the user's Default profile cookie file if possible, otherwise auto-detect
    cookie_file = os.path.expanduser("~/.config/google-chrome/Default/Cookies")
    if os.path.exists(cookie_file):
        print(f"Using cookie file: {cookie_file}")
        cj = browser_cookie3.chrome(domain_name='chatgpt.com', cookie_file=cookie_file)
    else:
        print("Default cookie file not found, attempting auto-detection...")
        cj = browser_cookie3.chrome(domain_name='chatgpt.com')
        
    print(f"Loaded {len(cj)} cookies.")
    print("Cookie names found:", [c.name for c in cj])
    
    # Check for critical session cookie
    if not any(c.name.startswith('__Secure-next-auth.session-token') for c in cj):
        print("WARNING: No session token cookie found! Login might act as logged out.")
    
    print("Fetching new access token...")
    # Get the session to find the access token
    session_url = "https://chatgpt.com/api/auth/session"
    
    # Mimic browser headers more closely to avoid 403
    session_headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://chatgpt.com/",
        "Sec-Ch-Ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": "\"Linux\"",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Priority": "u=1, i"
    }
    
    session_resp = requests.get(session_url, cookies=cj, headers=session_headers, impersonate="chrome")
    
    if session_resp.status_code != 200:
        raise Exception(f"Failed to get session. Status: {session_resp.status_code}")
        
    token = session_resp.json().get('accessToken')
    if not token:
        raise Exception("Could not find accessToken in session response")
        
    print("Successfully retrieved credentials.")
    return cj, token

def record_audio(filename):
    print("\n--- Audio Recording ---")
    input("Press Enter to START recording (using default microphone)...")
    
    print("Recording... Press Enter to STOP.")
    
    # Start ffmpeg process
    # -y: overwrite output files
    # -f alsa -i default: use ALSA default input
    # -ac 1: mono audio
    # -c:a libopus: encode to opus (good for speech)
    cmd = ["ffmpeg", "-y", "-f", "alsa", "-i", "default", "-ac", "1", "-c:a", "libopus", filename]
    
    process = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    try:
        input() # Wait for Enter
    except KeyboardInterrupt:
        pass # Handle Ctrl+C gracefully
    finally:
        print("Stopping recording...")
        process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
    
    print(f"Saved to {filename}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-record", action="store_true", help="Skip recording and prompt, just transcribe existing file")
    args = parser.parse_args()

    url = "https://chatgpt.com/backend-api/transcribe"
    file_path = "whisper.webm"

    # Handle recording
    if not args.no_record:
        if not os.path.exists(file_path):
            print(f"File '{file_path}' not found.")
            if input("Do you want to record a new clip? (y/n) [y]: ").lower().strip() in ('', 'y'):
                record_audio(file_path)
            else:
                print("Aborted.")
                exit(1)
        else:
            if input(f"File '{file_path}' exists. Record new? (y/n) [n]: ").lower().strip() == 'y':
                record_audio(file_path)

    try:
        cookies, access_token = get_chatgpt_credentials()
        print(cookies)
        print(access_token)
        
        headers = {
            "authorization": f"Bearer {access_token}",
            "oai-client-version": "prod-6b4285d9fac6acbe84a72f879ad3082e807495ed",
            "oai-device-id": "24044dbb-1f1c-43de-8b37-60d2ae0de8b1",
            "oai-language": "en-US",
            "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Linux\"",
            "referrer": "https://chatgpt.com/",
            # Request specific headers that might be needed, mimicking browser
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
        }

        print("Uploading file for transcription...")
        
        # Create CurlMime object for multipart upload
        mp = CurlMime()
        mp.addpart(
            name="file",
            content_type="audio/webm;codecs=opus",
            filename="whisper.webm",
            local_path=file_path
        )
        
        try:
            response = requests.post(url, headers=headers, cookies=cookies, multipart=mp, impersonate="chrome")
            
            print(f"Status Code: {response.status_code}")
            # print("Response:")
            # print(response.text)
            
            if response.status_code == 200:
                data = response.json()
                text = data.get("text", "")
                
                print("\n--- Transcription ---")
                print(text)
                print("---------------------")
                
                # Save to history
                history_file = "history.json"
                timestamp = datetime.datetime.now().isoformat()
                
                history_entry = {
                    "timestamp": timestamp,
                    "text": text
                }
                
                history_data = []
                if os.path.exists(history_file):
                    try:
                        with open(history_file, 'r') as hf:
                            history_data = json.load(hf)
                    except json.JSONDecodeError:
                        pass
                
                history_data.append(history_entry)
                
                with open(history_file, 'w') as hf:
                    json.dump(history_data, hf, indent=2)
                print(f"Saved to {history_file}")
                
                # Copy to clipboard
                try:
                    # Try xclip first
                    p = subprocess.Popen(['xclip', '-selection', 'clipboard'], stdin=subprocess.PIPE)
                    p.communicate(input=text.encode('utf-8'))
                    print("Copied to clipboard (xclip).")
                except FileNotFoundError:
                    try:
                        # Try wl-copy as fallback
                        p = subprocess.Popen(['wl-copy'], stdin=subprocess.PIPE)
                        p.communicate(input=text.encode('utf-8'))
                        print("Copied to clipboard (wl-copy).")
                    except FileNotFoundError:
                        print("Clipboard tool not found (tried xclip, wl-copy).")

        finally:
            mp.close()
            
    except Exception as e:
        print(f"An error occurred: {e}")