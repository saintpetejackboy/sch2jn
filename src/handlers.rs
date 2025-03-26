use actix_web::{web, HttpResponse, HttpRequest};
use serde::Deserialize;
use reqwest::Client;
use std::env;
use std::fs::{read_to_string, write, create_dir_all};
use chrono::{Local, DateTime, Duration};
use std::collections::HashMap;

use crate::log_msg;
use crate::LOG_FILE_PATH;

#[derive(Deserialize, Debug)]
pub struct Payload {
    #[serde(default)]
    pub data: Option<serde_json::Value>,
    #[serde(flatten)]
    pub _extra: HashMap<String, serde_json::Value>,
}

pub async fn post_handler(req: HttpRequest, payload: web::Json<Payload>) -> HttpResponse {
    // Check API security if enabled
    if env::var("API_SECURITY").unwrap_or_else(|_| "false".into()) == "true" {
        let header_key = env::var("API_KEY_HEADER").unwrap_or_else(|_| "x-api-key".to_string());
        let expected_api_key = if let Ok(key) = env::var("SUBCONTRACTOR_API_KEY") {
            key
        } else if env::var("USE_JOB_NIMBUS_AS_SUBCONTRACTOR_KEY").unwrap_or_else(|_| "false".into()) == "true" {
            env::var("JOB_NIMBUS_API_KEY").unwrap_or_default()
        } else {
            env::var("JOB_NIMBUS_API_KEY").unwrap_or_default()
        };

        match req.headers().get(&header_key) {
            Some(val) if val.to_str().unwrap_or("") == expected_api_key => { /* OK */ }
            _ => {
                log_msg("Unauthorized API access attempt.", "❌");
                return HttpResponse::Unauthorized().json(serde_json::json!({
                    "error": "Unauthorized"
                }));
            }
        }
    }

    log_msg(&format!("Received payload: {:?}", payload), "📥");

    if payload.data.is_none() {
        log_msg("Missing 'data' in input payload.", "❌");
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Missing 'data' in payload"
        }));
    }

    let forward_payload = payload.data.clone().unwrap();
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

    if env::var("TEST_MODE").unwrap_or_default() == "true" {
        log_msg("Simulated forwarding in test mode.", "🧪");
        return HttpResponse::Ok().json(serde_json::json!({
            "status": "ok",
            "message": "Test forward successful"
        }));
    }

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

    let res = client.post(api_url)
        .header("Authorization", format!("bearer {}", api_key))
        .header("Content-Type", "application/json")
        .body(json_payload.clone())
        .send()
        .await;

    let (response_text, status_code) = match res {
        Ok(response) => {
            let status_code = response.status().as_u16();
            let text = match response.text().await {
                Ok(text) => text,
                Err(e) => {
                    log_msg(&format!("Failed to read response: {}", e), "❌");
                    return HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to read response"
                    }));
                }
            };
            (text, status_code)
        }
        Err(e) => {
            log_msg(&format!("HTTP request error: {}", e), "❌");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to forward payload"
            }));
        }
    };

    log_msg(&format!("Received response from Job Nimbus (HTTP {})", status_code), "📬");
    log_msg(&format!("Response: {}", response_text), "📬");

    HttpResponse::Ok()
        .content_type("application/json")
        .body(response_text)
}

pub async fn logs_handler(req: HttpRequest) -> HttpResponse {
    if env::var("GUI_AUTH_REQUIRED").unwrap_or_else(|_| "false".into()) == "true" {
        // Check for password in header "x-gui-password" or as query parameter "password"
        let provided = req.headers().get("x-gui-password")
            .and_then(|v| v.to_str().ok())
            .or_else(|| {
                req.uri().query().and_then(|q| {
                    q.split('&')
                     .find_map(|param| {
                         let mut parts = param.splitn(2, '=');
                         if parts.next()? == "password" {
                             return parts.next();
                         }
                         None
                     })
                })
            });
        if provided != Some(env::var("GUI_PASSWORD").unwrap_or_default().as_str()) {
            return HttpResponse::Unauthorized()
                .content_type("text/plain; charset=utf-8")
                .body("Unauthorized");
        }
    }
    let _lock = crate::LOG_LOCK.lock().unwrap();
    let file_path = std::path::Path::new(LOG_FILE_PATH);
    if !file_path.exists() {
        return HttpResponse::Ok()
            .content_type("text/plain; charset=utf-8")
            .body(String::new());
    }

    let content = match read_to_string(LOG_FILE_PATH) {
        Ok(content) => content,
        Err(_) => return HttpResponse::Ok()
            .content_type("text/plain; charset=utf-8")
            .body(String::new()),
    };

    let now = Local::now();
    let mut new_content = String::new();
    for line in content.lines() {
        if let Some(idx) = line.find(' ') {
            let ts = &line[0..idx];
            match DateTime::parse_from_rfc3339(ts) {
                Ok(entry_time) => {
                    let age = now.signed_duration_since(entry_time.with_timezone(&Local));
                    if age < Duration::days(7) {
                        new_content.push_str(line);
                        new_content.push('\n');
                    }
                }
                Err(_) => {
                    new_content.push_str(line);
                    new_content.push('\n');
                }
            }
        } else {
            new_content.push_str(line);
            new_content.push('\n');
        }
    }
    if let Err(_) = write(LOG_FILE_PATH, &new_content) {
        return HttpResponse::InternalServerError()
            .content_type("text/plain; charset=utf-8")
            .body("Failed to write pruned logs");
    }
    
    // Ensure proper UTF-8 encoding for correct emoji display
    HttpResponse::Ok()
        .content_type("text/plain; charset=utf-8")
        .append_header(("Cache-Control", "no-cache, no-store, must-revalidate"))
        .append_header(("X-Content-Type-Options", "nosniff"))
        .body(new_content)
}

pub async fn static_file_handler(req: HttpRequest) -> HttpResponse {
    let path = req.match_info().query("filename").to_string();
    let file_path = format!("static/{}", path);
    
    // Special case for README.md - check both project root and static directory
    if file_path == "static/README.md" {
        // Try to read from static directory first
        if let Ok(content) = std::fs::read_to_string(&file_path) {
            return HttpResponse::Ok()
                .content_type("text/markdown; charset=utf-8")
                .body(content);
        }
        
        // Fall back to project root if not found in static
        if let Ok(content) = std::fs::read_to_string("README.md") {
            return HttpResponse::Ok()
                .content_type("text/markdown; charset=utf-8")
                .body(content);
        }
        
        // If neither location has the file, return 404
        return HttpResponse::NotFound().body("README.md not found");
    }
    
    match std::fs::read(&file_path) {
        Ok(content) => {
            let content_type = match file_path.split('.').last() {
                Some("css") => "text/css",
                Some("js") => "application/javascript",
                Some("json") => "application/json",
                Some("ico") => "image/x-icon",
                Some("png") => "image/png",
                Some("jpg") | Some("jpeg") => "image/jpeg",
                Some("svg") => "image/svg+xml",
                Some("webp") => "image/webp",
                Some("md") => "text/markdown; charset=utf-8",
                _ => "application/octet-stream",
            };
            HttpResponse::Ok().content_type(content_type).body(content)
        },
        Err(_) => HttpResponse::NotFound().body(format!("File not found: {}", file_path)),
    }
}

pub async fn index_handler(req: HttpRequest) -> HttpResponse {
    if env::var("GUI_AUTH_REQUIRED").unwrap_or_else(|_| "false".into()) == "true" {
        // Check for password in header "x-gui-password" or as query parameter "password"
        let provided = req.headers().get("x-gui-password")
            .and_then(|v| v.to_str().ok())
            .or_else(|| {
                req.uri().query().and_then(|q| {
                    q.split('&')
                     .find_map(|param| {
                         let mut parts = param.splitn(2, '=');
                         if parts.next()? == "password" {
                             return parts.next();
                         }
                         None
                     })
                })
            });
        if provided != Some(env::var("GUI_PASSWORD").unwrap_or_default().as_str()) {
            return HttpResponse::Unauthorized().body("Unauthorized");
        }
    }
    match std::fs::read_to_string("static/index.html") {
        Ok(content) => HttpResponse::Ok().content_type("text/html").body(content),
        Err(_) => HttpResponse::InternalServerError().body("Failed to load index.html"),
    }
}

pub async fn run_tests_handler() -> HttpResponse {
    use std::process::Command;
    use std::env;

    log_msg("Running integration tests...", "🧪");
    
    // Ensure the logs directory exists before running tests
    if let Err(e) = create_dir_all("logs") {
        log_msg(&format!("Warning: Failed to create logs directory: {}", e), "⚠️");
    }
    
    // Set environment variables for testing
    if env::var("JOB_NIMBUS_API_KEY").is_err() {
        log_msg("Warning: JOB_NIMBUS_API_KEY not set for tests. Using dummy key for testing.", "⚠️");
        env::set_var("JOB_NIMBUS_API_KEY", "test_dummy_key");
    }
    
    // Ensure TEST_MODE is enabled for tests
    env::set_var("TEST_MODE", "true");
    
    // Run cargo test in a separate process with enhanced output formatting
    let test_process = Command::new("cargo")
        .args(["test", "--test", "integration_tests", "--", "--format=pretty", "--nocapture"])
        .output();
    
    match test_process {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            // Filter and format the output to remove compilation noise
            let stdout_filtered = stdout.lines()
                .filter(|line| {
                    !line.contains("Compiling") && 
                    !line.contains("Finished") && 
                    !line.contains("Fresh") &&
                    !line.contains("Checking") &&
                    !line.trim().is_empty()
                })
                .collect::<Vec<&str>>()
                .join("\n");
                
            // Collect test summary lines
            let test_summary_lines: Vec<&str> = stdout_filtered.lines()
                .filter(|line| 
                    line.contains("running") || 
                    line.contains("test result:") ||
                    line.contains("Integration Tests Summary"))
                .collect();
                
            // Collect test detail lines (everything that isn’t summary)
            let test_detail_lines: Vec<&str> = stdout_filtered.lines()
                .filter(|line| 
                    !test_summary_lines.contains(line) && 
                    !line.trim().is_empty())
                .collect();
            
            // Build the final test output with details first and summary at the bottom.
            let mut test_output = String::new();
            
            if !test_detail_lines.is_empty() {
                test_output.push_str("Test Details:\n");
                test_output.push_str(&test_detail_lines.join("\n"));
                test_output.push_str("\n\n");
            }
            
            if !test_summary_lines.is_empty() {
                test_output.push_str("Test Summary:\n");
                test_output.push_str(&test_summary_lines.join("\n"));
            }
            
            if test_output.is_empty() {
                test_output = "No test output generated.".to_string();
            }
            
            log_msg(&test_output, "🧪");
            
            // Extract relevant error information if tests failed
            if !stderr.is_empty() {
                let error_lines: Vec<&str> = stderr.lines()
                    .filter(|line| 
                        line.contains("panicked at") || 
                        line.contains("FAILED") ||
                        (line.contains("error:") && !line.contains("warnings emitted")))
                    .collect();
                
                if !error_lines.is_empty() {
                    let error_msg = error_lines.join("\n");
                    log_msg(&format!("Test failures detected: {}", error_msg), "⚠️");
                }
            }
            
            HttpResponse::Ok().json(serde_json::json!({
                "status": if output.status.success() { "ok" } else { "warning" },
                "message": test_output
            }))
        },
        Err(e) => {
            let error_msg = format!("Failed to run tests: {}", e);
            log_msg(&error_msg, "❌");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": error_msg
            }))
        }
    }
}



pub async fn clear_logs_handler() -> HttpResponse {
    use std::fs::write;
    match write(LOG_FILE_PATH, "") {
        Ok(_) => {
            log_msg("Logs cleared.", "🧹");
            HttpResponse::Ok().json(serde_json::json!({
                "status": "ok",
                "message": "Logs cleared"
            }))
        }
        Err(e) => {
            log_msg(&format!("Failed to clear logs: {}", e), "❌");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to clear logs"
            }))
        }
    }
}
