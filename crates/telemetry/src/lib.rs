use std::error::Error;
use std::path::PathBuf;
use std::sync::OnceLock;

use tracing_subscriber::EnvFilter;

static INIT: OnceLock<Result<tracing_appender::non_blocking::WorkerGuard, String>> =
    OnceLock::new();

pub fn init() -> Result<(), Box<dyn Error + Send + Sync>> {
    INIT.get_or_init(|| {
        let filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new("fileoctopus=debug,info"));
        let log_dir = default_log_dir();

        std::fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;

        let file_appender = tracing_appender::rolling::daily(log_dir, "fileoctopus.log");
        let (writer, guard) = tracing_appender::non_blocking(file_appender);

        tracing_subscriber::fmt()
            .with_env_filter(filter)
            .with_writer(writer)
            .with_ansi(false)
            .try_init()
            .map_err(|error| error.to_string())?;

        Ok(guard)
    })
    .as_ref()
    .map(|_| ())
    .map_err(|error| error.clone().into())
}

pub fn default_log_dir() -> PathBuf {
    home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".fileoctopus")
        .join("logs")
}

pub fn info(message: &str) {
    tracing::info!("{}", message);
}

pub fn debug(message: &str) {
    tracing::debug!("{}", message);
}

pub fn error(message: &str) {
    tracing::error!("{}", message);
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}
