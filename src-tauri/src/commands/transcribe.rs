use reqwest;
use serde_json;

#[tauri::command]
pub async fn transcribe(path: String, token: String, user_agent: String) -> Result<String, String> {
    if token.trim().is_empty() {
        return Err("Token is empty".into());
    }

    let token = token.trim();
    let cookie_string = if token.contains('=') {
        token.to_string()
    } else {
        format!("__Secure-next-auth.session-token={}", token)
    };

    let client = reqwest::Client::builder()
        .user_agent(user_agent)
        .build()
        .map_err(|e| e.to_string())?;

    let session_url = "https://chatgpt.com/api/auth/session";
    let resp = client
        .get(session_url)
        .header("Cookie", &cookie_string)
        .header("Accept", "*/*")
        .header("Referer", "https://chatgpt.com/")
        .header("Origin", "https://chatgpt.com")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status() != 200 {
        return Err(format!("Session failed: {}. Check your token.", resp.status()));
    }

    let session_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let access_token = session_json["accessToken"]
        .as_str()
        .ok_or("No access token in session")?;

    let url = "https://chatgpt.com/backend-api/transcribe";
    let file_bytes = std::fs::read(&path).map_err(|e| e.to_string())?;

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name("whisper.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new().part("file", part);

    let trans_resp = client
        .post(url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Cookie", &cookie_string)
        .header("oai-device-id", "be84a72f-879ad3082e807495ed")
        .header("Origin", "https://chatgpt.com")
        .header("Referer", "https://chatgpt.com/")
        .header("Accept", "*/*")
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if trans_resp.status() != 200 {
        return Err(format!("Transcription failed: {}", trans_resp.status()));
    }

    let data: serde_json::Value = trans_resp.json().await.map_err(|e| e.to_string())?;
    let text = data["text"].as_str().unwrap_or("").to_string();

    Ok(text)
}
