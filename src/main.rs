use actix_web::{web, App, HttpServer, HttpResponse, Responder, HttpRequest};
use serde::Deserialize;
use reqwest::Client;
use std::env;
use std::fs::{OpenOptions, read_to_string, write};
use std::io::Write;
use chrono::{Utc, DateTime, Duration};
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    // Mutex used to ensure safe appending to the log file.
    static ref LOG_LOCK: Mutex<()> = Mutex::new(());
}

const LOG_FILE_PATH: &str = "logs/log.txt";

/// Append a log message with a timestamp and an emoji.
fn log_msg(message: &str, emoji: &str) {
    let now: DateTime<Utc> = Utc::now();
    let log_entry = format!("{} {} {}\n", now.to_rfc3339(), emoji, message);
    let _lock = LOG_LOCK.lock().unwrap();
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(LOG_FILE_PATH)
        .expect("Failed to open log file");
    file.write_all(log_entry.as_bytes()).expect("Failed to write log entry");
    // Also print to stdout for real-time monitoring.
    println!("{} {}", emoji, message);
}

#[derive(Deserialize, Debug)]
struct Payload {
    /// The main data field we are looking for
    #[serde(default)]
    data: Option<serde_json::Value>,
    // Other fields could be present but are ignored
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

/// POST handler: Extract and forward the data payload to Job Nimbus.
async fn post_handler(payload: web::Json<Payload>) -> impl Responder {
    log_msg(&format!("Received payload: {:?}", payload), "📥");

    // Check if data field exists in the payload
    if payload.data.is_none() {
        log_msg("Missing 'data' in input payload.", "❌");
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Missing 'data' in payload"
        }));
    }

    // Get the data field
    let forward_payload = payload.data.clone().unwrap();

    // Encode as JSON with pretty printing
    let json_payload = match serde_json::to_string_pretty(&forward_payload) {
        Ok(json) => json,
        Err(e) => {
            log_msg(&format!("Error encoding forward payload to JSON: {}", e), "❌");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to encode payload"
            }));
        }
    };

    log_msg("Forwarding payload to Job Nimbus...", "📤");

    // If running in test mode, simulate a successful response.
    if env::var("TEST_MODE").unwrap_or_default() == "true" {
        log_msg("Simulated forwarding in test mode.", "🧪");
        return HttpResponse::Ok().json(serde_json::json!({
            "status": "ok",
            "message": "Test forward successful"
        }));
    }

    // Get API key from the environment.
    let api_key = match env::var("JOB_NIMBUS_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            log_msg("JOB_NIMBUS_API_KEY not set in environment.", "❌");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Server configuration error"
            }));
        }
    };

    let client = Client::new();
    let api_url = "https://app.jobnimbus.com/api1/contacts";

    // Forward the payload.
    let res = client.post(api_url)
        .header("Authorization", format!("bearer {}", api_key))
        .header("Content-Type", "application/json")
        .body(json_payload.clone())
        .send()
        .await;

    let response_text;
    let status_code;
    match res {
        Ok(response) => {
            status_code = response.status().as_u16();
            response_text = match response.text().await {
                Ok(text) => text,
                Err(e) => {
                    log_msg(&format!("Failed to read response: {}", e), "❌");
                    return HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to read response"
                    }));
                }
            };
        },
        Err(e) => {
            log_msg(&format!("HTTP request error: {}", e), "❌");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to forward payload"
            }));
        }
    };

    log_msg(&format!("Received response from Job Nimbus (HTTP {})", status_code), "📬");
    log_msg(&format!("Response: {}", response_text), "📬");

    // Return the response as-is, with appropriate content type
    HttpResponse::Ok()
        .content_type("application/json")
        .body(response_text)
}

/// GET handler: Returns the log file content and prunes entries older than 7 days.
async fn get_handler(_req: HttpRequest) -> impl Responder {
    if env::var("TEST_MODE").unwrap_or_default() != "true" {
        log_msg("GET request received for logs.", "📥");
    }
    
    // Create a mutex lock to ensure exclusive access to the log file
    let _lock = LOG_LOCK.lock().unwrap();
    
    // Check if file exists
    let file_path = std::path::Path::new(LOG_FILE_PATH);
    if !file_path.exists() {
        if env::var("TEST_MODE").unwrap_or_default() == "true" {
            println!("DEBUG: Log file does not exist: {}", LOG_FILE_PATH);
        }
        return HttpResponse::Ok().content_type("text/plain").body(String::new());
    }
    
    // Read the file content
    let content = match read_to_string(LOG_FILE_PATH) {
        Ok(content) => {
            if env::var("TEST_MODE").unwrap_or_default() == "true" {
                println!("DEBUG: Successfully read file, content length: {}", content.len());
            }
            content
        },
        Err(e) => {
            if env::var("TEST_MODE").unwrap_or_default() == "true" {
                println!("DEBUG: Error reading log file: {:?}", e);
            }
            return HttpResponse::Ok().content_type("text/plain").body(String::new());
        }
    };
    
    let now = Utc::now();
    let mut new_content = String::new();
    
    for line in content.lines() {
        if env::var("TEST_MODE").unwrap_or_default() == "true" {
            println!("DEBUG: Processing line: {}", line);
        }
        
        // Try to parse the timestamp at the beginning of the line
        if let Some(idx) = line.find(' ') {
            let ts = &line[0..idx];
            
            match DateTime::parse_from_rfc3339(ts) {
                Ok(entry_time) => {
                    let age = now.signed_duration_since(entry_time.with_timezone(&Utc));
                    
                    // Keep entries newer than 7 days
                    if age < Duration::days(7) {
                        if env::var("TEST_MODE").unwrap_or_default() == "true" {
                            println!("DEBUG: Keeping entry (less than 7 days old)");
                        }
                        new_content.push_str(line);
                        new_content.push('\n');
                    } else if env::var("TEST_MODE").unwrap_or_default() == "true" {
                        println!("DEBUG: Dropping entry (more than 7 days old)");
                    }
                },
                Err(_) => {
                    // If parsing failed, keep the line
                    new_content.push_str(line);
                    new_content.push('\n');
                }
            }
        } else {
            // If there's no space, keep the line
            new_content.push_str(line);
            new_content.push('\n');
        }
    }
    
    // Write the pruned content back to the file
    match write(LOG_FILE_PATH, &new_content) {
        Ok(_) => {
            if env::var("TEST_MODE").unwrap_or_default() == "true" {
                println!("DEBUG: Successfully wrote pruned content to file");
            }
        },
        Err(e) => {
            if env::var("TEST_MODE").unwrap_or_default() == "true" {
                println!("DEBUG: Error writing pruned content: {:?}", e);
            }
            return HttpResponse::InternalServerError().body("Failed to write pruned logs");
        }
    }
    
    // Return the pruned content
    HttpResponse::Ok().content_type("text/plain").body(new_content)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Ensure the logs directory exists
    std::fs::create_dir_all("logs")
        .expect("Failed to create logs directory");
    
    dotenv::dotenv().ok();
    log_msg("Starting server on port 8787", "🚀");

    HttpServer::new(|| {
        App::new()
            .route("/", web::post().to(post_handler))
            .route("/", web::get().to(get_handler))
    })
    .bind("0.0.0.0:8787")?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};
    use std::env;
    use std::fs::{remove_file};
    use chrono::{Utc, Duration};

    // Helper function to clear the log file before tests.
    fn clear_log() {
        let _ = remove_file(LOG_FILE_PATH);
    }

    #[actix_web::test]
    async fn test_missing_payload() {
        clear_log();
        let app = test::init_service(App::new().route("/", web::post().to(post_handler))).await;
        // No data field provided
        let payload = serde_json::json!({
            "event": "project.updated"
        });
        let req = test::TestRequest::post().set_json(&payload).to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400);
    }

    #[actix_web::test]
    async fn test_valid_payload_direct_data() {
        clear_log();
        env::set_var("TEST_MODE", "true");
        env::set_var("JOB_NIMBUS_API_KEY", "dummy");

        let app = test::init_service(App::new().route("/", web::post().to(post_handler))).await;
        let payload = serde_json::json!({
            "event": "project.updated",
            "data": {
                "first_name": "testmatt",
                "status_name": "Job Sold",
                "record_type_name": "East Customers"
            }
        });
        let req = test::TestRequest::post().set_json(&payload).to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body_bytes = test::read_body(resp).await;
        let response_text = String::from_utf8(body_bytes.to_vec()).unwrap();
        
        // Check for success indicators in the response
        assert!(response_text.contains("ok") || response_text.contains("success"), 
            "Response should indicate success");

        env::remove_var("TEST_MODE");
        env::remove_var("JOB_NIMBUS_API_KEY");
    }

    #[actix_web::test]
    async fn test_get_logs_pruning() {
        clear_log();
        env::set_var("TEST_MODE", "true");

        // Create logs directory if it doesn't exist
        std::fs::create_dir_all("logs").expect("Failed to create logs directory for test");

        // Write two log entries: one older than 7 days and one recent
        let old_time = (Utc::now() - Duration::days(8)).to_rfc3339();
        let recent_time = Utc::now().to_rfc3339();
        let test_content = format!(
            "{} ℹ️ Old log entry\n{} ℹ️ Recent log entry\n", 
            old_time, 
            recent_time
        );
        
        // Write directly to file using std::fs::write
        std::fs::write(LOG_FILE_PATH, test_content.as_bytes())
            .expect("Failed to write test log");
        
        // Verify file exists and has correct content before proceeding
        let file_content = std::fs::read_to_string(LOG_FILE_PATH)
            .expect("Failed to read test log");
        println!("FILE BEFORE GET: {}", file_content);
        assert!(file_content.contains("Recent log entry"), "Test file should contain the recent entry");
        
        // Small delay to ensure file operations complete
        std::thread::sleep(std::time::Duration::from_millis(50));
        
        // Make the request
        let app = test::init_service(App::new().route("/", web::get().to(get_handler))).await;
        let req = test::TestRequest::get().to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
        
        // Get response body
        let body_bytes = test::read_body(resp).await;
        let log_content = String::from_utf8(body_bytes.to_vec()).unwrap();
        
        // Debug output
        println!("RESPONSE CONTENT: {}", log_content);
        
        // Read file directly after request to check consistency
        let file_after = std::fs::read_to_string(LOG_FILE_PATH)
            .unwrap_or_else(|_| "Failed to read file after test".to_string());
        println!("FILE AFTER GET: {}", file_after);
        
        // Check that only the recent entry is present
        assert!(!log_content.contains("Old log entry"), "Old entry should be pruned");
        assert!(log_content.contains("Recent log entry"), "Recent entry should be kept");
        
        env::remove_var("TEST_MODE");
    }
}