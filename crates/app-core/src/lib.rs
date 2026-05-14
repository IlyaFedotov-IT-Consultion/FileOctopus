use std::sync::Arc;

use fs_core::LocalFsProvider;
use thiserror::Error;
use vfs::VfsRegistry;

#[derive(Debug, Error)]
pub enum AppCoreError {
    #[error("failed to initialize telemetry: {0}")]
    Telemetry(String),
    #[error("failed to initialize VFS: {0}")]
    Vfs(String),
}

#[derive(Clone)]
pub struct AppState {
    vfs: Arc<VfsRegistry>,
}

impl AppState {
    pub fn vfs(&self) -> Arc<VfsRegistry> {
        self.vfs.clone()
    }
}

pub struct AppCore;

impl AppCore {
    pub fn boot() -> Result<Arc<AppState>, AppCoreError> {
        telemetry::init().map_err(|error| AppCoreError::Telemetry(error.to_string()))?;

        let vfs = Arc::new(VfsRegistry::new());

        vfs.register(Arc::new(LocalFsProvider::new()))
            .map_err(|error| AppCoreError::Vfs(error.to_string()))?;

        telemetry::info("FileOctopus app core booted");

        Ok(Arc::new(AppState { vfs }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vfs::ResourceUri;

    #[test]
    fn boot_registers_local_provider() {
        let state = AppCore::boot().unwrap();
        let uri = ResourceUri::parse("local:///Users").unwrap();
        let provider = state.vfs().provider_for(&uri).unwrap();

        assert_eq!(provider.id().as_str(), "local");
    }
}
