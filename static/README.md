# SCH2JN 🚀

[![Rust](https://img.shields.io/badge/rust-stable-brightgreen.svg)](https://www.rust-lang.org/)
[![Actix Web](https://img.shields.io/badge/actix--web-4.0-blue.svg)](https://actix.rs/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight bridge server that forwards requests from Subcontractor Hub to Job Nimbus via API.

## Features ✨

- 🔄 Simple API endpoint for forwarding payloads
- 🔒 API key authentication
- 📊 Web-based dashboard for monitoring
- 📝 Log viewing and management
- 🧪 Integrated test suite

## Setup ⚙️

1. Clone the repository
2. Copy `example.env` to `.env` and configure your environment variables
3. Run `cargo build --release` to compile
4. Execute the binary from the `target/release` directory

## Configuration 🛠️

The following environment variables are required:

- `JOB_NIMBUS_API_KEY`: **Required** - Your JobNimbus API key

Optional configuration:

- `PORT`: Server port (default: 8787)
- `API_SECURITY`: Enable API security (default: false)
- `API_KEY_HEADER`: Header key for API authentication (default: x-api-key)
- `SUBCONTRACTOR_API_KEY`: Subcontractor API key
- `USE_JOB_NIMBUS_AS_SUBCONTRACTOR_KEY`: Use Job Nimbus API key as subcontractor key (default: false)
- `GUI_AUTH_REQUIRED`: Toggle GUI authentication (default: false)
- `GUI_PASSWORD`: Password for GUI access
- `TEST_MODE`: Toggle test mode for simulated requests (default: false)

## Usage 📬

Send POST requests to the root endpoint with your payload in the following format:

```json
{
  "data": {
    "first_name": "John",
    "status_name": "Job Sold",
    "record_type_name": "East Customers"
  }
}
```

## Development 👩‍💻

Run tests: `cargo test`  
Start server: `cargo run`

## Icons 🖼️

The project includes several icon variations located in `static/images`:

- `android-chrome-192x192.png` & `android-chrome-512x512.png` 📱
- `apple-touch-icon.png` 🍎
- `favicon-16x16.png`, `favicon-32x32.png` & `favicon.ico` 🌐

These assets provide a simple yet flexible set of icons for different platforms.
