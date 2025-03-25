# SCH2JN - Subcontractor Hub to Job Nimbus Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A high-performance data transformation proxy for converting Subcontractor Hub payloads into Job Nimbus-compatible format. Written in Rust for speed, reliability, and low resource usage.

## Overview

Subcontractor Hub and Job Nimbus use incompatible payload structures in their APIs. This service acts as a bridge between the two systems, accepting webhooks from Subcontractor Hub, transforming the data, and forwarding it to Job Nimbus with the correct formatting.

## Features

- **Fast & Efficient**: Written in Rust for optimal performance
- **Robust Error Handling**: Comprehensive error checking and reporting
- **Request Logging**: All transactions are logged with timestamps and emojis for visibility
- **Log Rotation**: Automatically prunes log entries older than 7 days
- **Test Mode**: Supports a test mode for development and testing

## Requirements

- Rust 1.51+ (2021 edition recommended)
- Cargo
- A Job Nimbus API key

## Installation

### Clone the repository

```bash
git clone https://github.com/saintpetejackboy/sch2jn.git
cd sch2jn
```

### Build the project

```bash
cargo build --release
```

The compiled binary will be available at `target/release/sch2jn`.

## Configuration

Create a `.env` file in the project root with the following variables:

```
JOB_NIMBUS_API_KEY=your_api_key_here
# Optional: uncomment to enable test mode
# TEST_MODE=true
```

## Usage

### Running the Server

```bash
# Make logs directory if it doesn't exist
mkdir -p logs

# Run the server
./target/release/sch2jn
```

The server will start listening on port 8787.

### Server Endpoints

- **POST /** - Accepts webhook data from Subcontractor Hub and forwards it to Job Nimbus
- **GET /** - Returns the contents of the log file with entries older than 7 days removed

## Deployment

### Running as a Systemd Service

1. Create a systemd service file:

```bash
sudo nano /etc/systemd/system/sch2jn.service
```

2. Add the following content:

```
[Unit]
Description=SCH2JN Bridge Service
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/sch2jn
Environment="JOB_NIMBUS_API_KEY=your_api_key_here"
ExecStart=/path/to/sch2jn/target/release/sch2jn
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sch2jn
sudo systemctl start sch2jn
```

4. Check the status:

```bash
sudo systemctl status sch2jn
```

### Apache2 Proxy Setup

To proxy requests through Apache2:

1. Enable required modules:

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
```

2. Create a site configuration:

```bash
sudo nano /etc/apache2/sites-available/sch2jn.conf
```

3. Add the following content:

```apache
<VirtualHost *:80>
    ServerName webhook.yourdomain.com
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:8787/
    ProxyPassReverse / http://localhost:8787/
    
    ErrorLog ${APACHE_LOG_DIR}/sch2jn_error.log
    CustomLog ${APACHE_LOG_DIR}/sch2jn_access.log combined
</VirtualHost>
```

4. Enable the site and restart Apache:

```bash
sudo a2ensite sch2jn
sudo systemctl restart apache2
```

## Development

### Running Tests

```bash
# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name -- --nocapture
```

### Test Mode

Set the `TEST_MODE=true` environment variable to run in test mode, which simulates the Job Nimbus API without making actual HTTP requests.

## Payload Structure

### Input Format (from Subcontractor Hub)

```json
{
  "event": "project.updated",
  "data": {
    "first_name": "testmatt",
    "status_name": "Job Sold",
    "record_type_name": "East Customers"
  }
}
```

### Output Format (to Job Nimbus)

```json
{
  "first_name": "testmatt",
  "status_name": "Job Sold",
  "record_type_name": "East Customers"
}
```

## Logging

Logs are stored in `logs/log.txt` with the following format:

```
TIMESTAMP EMOJI MESSAGE
```

Example:
```
2023-03-25T12:34:56.789Z 📥 Received payload: {...}
2023-03-25T12:34:56.901Z 📤 Forwarding payload to Job Nimbus...
2023-03-25T12:34:57.123Z 📬 Received response from Job Nimbus (HTTP 200)
```

## Troubleshooting

### Common Issues

1. **Missing API Key**: Ensure the `JOB_NIMBUS_API_KEY` is set in your environment or `.env` file.
2. **Permission Denied**: Make sure the user running the service has write access to the `logs` directory.
3. **Port Already in Use**: If port 8787 is already in use, modify the code or use a proxy to remap the port.

### Viewing Logs

```bash
# View the last 50 log entries
tail -n 50 logs/log.txt

# Follow logs in real-time
tail -f logs/log.txt
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgements

- [saintpetejackboy](https://github.com/saintpetejackboy) - Creator and maintainer
- [actix-web](https://actix.rs/) - Web framework for Rust
- [reqwest](https://docs.rs/reqwest) - HTTP client for Rust
