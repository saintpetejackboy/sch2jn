use actix_web::{App, HttpServer, HttpResponse, HttpRequest, web};
use dotenv::dotenv;
use std::env;
use std::fs::create_dir_all;
use sch2jn::log_msg;
use sch2jn::handlers::{
    index_handler, logs_handler, post_handler, run_tests_handler, clear_logs_handler, static_file_handler,
};
use std::io::Write;

async fn config_handler(_req: HttpRequest) -> HttpResponse {
    let expected_configs = vec![
        ("PORT", Some("8787"), "Port on which the server listens", "port"),
        ("API_SECURITY", Some("false"), "Enable API security for incoming requests", "boolean"),
        ("API_KEY_HEADER", Some("x-api-key"), "Header key for API authentication", "string"),
        ("SUBCONTRACTOR_API_KEY", None, "Subcontractor API key if applicable", "string"),
        ("USE_JOB_NIMBUS_AS_SUBCONTRACTOR_KEY", Some("false"), "Use Job Nimbus API key as subcontractor key", "boolean"),
        ("JOB_NIMBUS_API_KEY", None, "Job Nimbus API key for integration", "string"),
        ("GUI_AUTH_REQUIRED", Some("false"), "Toggle GUI authentication", "boolean"),
        ("GUI_PASSWORD", None, "Password for GUI access", "string"),
        ("TEST_MODE", Some("false"), "Toggle test mode for simulated requests", "boolean"),
    ];

    let sensitive_keys = ["SUBCONTRACTOR_API_KEY", "JOB_NIMBUS_API_KEY", "GUI_PASSWORD"];
    let mut config_data = Vec::new();

    for (key, default, description, value_type) in expected_configs {
        let env_value = std::env::var(key).ok();
        let value = env_value.unwrap_or_else(|| default.unwrap_or("").to_string());
        let display_value = if sensitive_keys.contains(&key) {
            "********".to_string()
        } else {
            value
        };

        config_data.push(serde_json::json!({
            "key": key,
            "value": display_value,
            "description": description,
            "type": value_type
        }));
    }

    HttpResponse::Ok()
        .content_type("application/json")
        .json(config_data)
}

#[cfg(unix)]
async fn shutdown_signal() {
    use tokio::signal::unix::{signal, SignalKind};

    let mut sigint = signal(SignalKind::interrupt()).expect("Unable to create SIGINT handler");
    let mut sigterm = signal(SignalKind::terminate()).expect("Unable to create SIGTERM handler");

    tokio::select! {
        _ = sigint.recv() => {
            println!("Received SIGINT, starting graceful shutdown");
        }
        _ = sigterm.recv() => {
            println!("Received SIGTERM, starting graceful shutdown");
        }
    }
}

fn check_single_instance() {
    use std::fs::OpenOptions;
    use std::io::ErrorKind;
    let lock_file_path = "sch2jn.lock";
    match OpenOptions::new().write(true).create_new(true).open(lock_file_path) {
        Ok(mut file) => {
            let pid = std::process::id();
            let _ = writeln!(file, "{}", pid);
        }
        Err(e) if e.kind() == ErrorKind::AlreadyExists => {
            eprintln!("Another instance is already running.");
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("Error creating lock file: {}", e);
            std::process::exit(1);
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Create required directories and load .env variables.
    create_dir_all("logs").expect("Failed to create logs directory");
    create_dir_all("static").expect("Failed to create static directory");
    create_dir_all("static/css").expect("Failed to create static/css directory");
    create_dir_all("static/js").expect("Failed to create static/js directory");
    create_dir_all("static/images").expect("Failed to create static/images directory");
    dotenv().ok();
    
    // Ensure README.md is available in static directory
    if let Ok(readme_content) = std::fs::read_to_string("README.md") {
        let _ = std::fs::write("static/README.md", readme_content);
    }

    // Check for a single instance and create the lock file.
    check_single_instance();
    log_msg("Starting server", "🚀");

    let port_env = env::var("PORT").unwrap_or_else(|_| "8787".to_string());
    let mut port: u16 = port_env.parse().unwrap_or(8787);
    let mut bind_success = false;
    let mut server_builder = None;

    // Try binding to ports until success.
    for _ in 0..5 {
        let bind_addr = format!("0.0.0.0:{}", port);
        // Store the result of `.bind()` in a variable.
        let bind_result = HttpServer::new(|| {
            App::new()
                .route("/", web::get().to(index_handler))
                .route("/logs", web::get().to(logs_handler))
                .route("/run_tests", web::post().to(run_tests_handler))
                .route("/clear_logs", web::post().to(clear_logs_handler))
                .route("/config", web::get().to(config_handler))
                .route("/static/{filename:.*}", web::get().to(static_file_handler))
                .route("/", web::post().to(post_handler))
        })
        .bind(&bind_addr);
        
        match bind_result {
            Ok(srv) => {
                log_msg(&format!("Server bound to {}", bind_addr), "✅");
                server_builder = Some(srv);
                bind_success = true;
                break;
            }
            Err(e) => {
                log_msg(
                    &format!("Failed to bind to {}: {}. Trying next port...", bind_addr, e),
                    "⚠️",
                );
                port += 1;
            }
        }
    }

    if !bind_success {
        eprintln!("Could not bind to any port. Exiting.");
        std::process::exit(1);
    }

    // Start the server.
    let server = server_builder.unwrap().run();
    let srv_handle = server.handle();

    // Spawn a task to listen for termination signals (only on unix).
    #[cfg(unix)]
    tokio::spawn(async move {
        shutdown_signal().await;
        srv_handle.stop(true).await;
    });

    // Await the server future.
    let result = server.await;

    // Cleanup: remove the lock file.
    std::fs::remove_file("sch2jn.lock").ok();

    result
}