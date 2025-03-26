use actix_web::{test, App};
use sch2jn::handlers::{post_handler, logs_handler};
use chrono::{Local, Duration};
use std::env;
use std::fs::{remove_file, write, create_dir_all};
use std::path::Path;

const LOG_FILE_PATH: &str = "logs/log.txt";

fn clear_log() {
    let _ = remove_file(LOG_FILE_PATH);
}

fn ensure_log_directory() {
    // Make sure the logs directory exists
    if let Some(parent) = Path::new(LOG_FILE_PATH).parent() {
        let _ = create_dir_all(parent);
    }
}

#[actix_web::test]
async fn test_missing_payload() {
    ensure_log_directory();
    let app = test::init_service(App::new().route("/", actix_web::web::post().to(post_handler))).await;
    let payload = serde_json::json!({
        "event": "project.updated"
    });
    let req = test::TestRequest::post().set_json(&payload).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

#[actix_web::test]
async fn test_valid_payload_direct_data() {
    ensure_log_directory();
    env::set_var("TEST_MODE", "true");
    env::set_var("JOB_NIMBUS_API_KEY", "dummy");

    let app = test::init_service(App::new().route("/", actix_web::web::post().to(post_handler))).await;
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
    assert!(response_text.contains("ok") || response_text.contains("success"),
            "Response should indicate success");

    env::remove_var("TEST_MODE");
    env::remove_var("JOB_NIMBUS_API_KEY");
}

