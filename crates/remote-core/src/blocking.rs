use vfs::VfsError;

/// Run a synchronous, blocking I/O closure on the blocking thread pool and flatten
/// the result. Centralises the `spawn_blocking(...).await.map_err(...)??` boilerplate
/// that every remote VFS provider repeats: a `JoinError` (panic/cancel of the blocking
/// task) is mapped to `VfsError::internal`, and the closure's own `Result` is returned
/// directly.
pub async fn run_blocking_io<T, F>(task: F) -> Result<T, VfsError>
where
    F: FnOnce() -> Result<T, VfsError> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(task)
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))?
}
