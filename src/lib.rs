use std::sync::Mutex;
use chrono::Local;
use std::fs::OpenOptions;
use std::io::{Write};

pub static LOG_LOCK: Mutex<()> = Mutex::new(());

pub const LOG_FILE_PATH: &str = "logs/log.txt";

pub fn log_msg(message: &str, emoji: &str) {
    let now = Local::now();
    let log_entry = format!("{} {} {}\n", now.to_rfc3339(), emoji, message);
    let _lock = LOG_LOCK.lock().unwrap();
    
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(LOG_FILE_PATH)
        .expect("Failed to open log file");

    // Check if file is empty. If yes, write the UTF-8 BOM.
    let metadata = file.metadata().expect("Failed to read file metadata");
    if metadata.len() == 0 {
        file.write_all(b"\xEF\xBB\xBF").expect("Failed to write BOM");
    }
    
    file.write_all(log_entry.as_bytes())
        .expect("Failed to write log entry");
    println!("{} {}", emoji, message);
}

pub mod handlers;
