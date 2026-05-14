use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use vfs::{DirectoryBatch, FileEntry, FileKind, VfsError};

pub const DIRECTORY_BATCH_EVENT: &str = "directory.batch";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatResponse {
    pub entry: FileEntryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStartRequest {
    pub uri: String,
    pub batch_size: Option<usize>,
    pub include_hidden: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStartResponse {
    pub session_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntryDto {
    pub uri: String,
    pub name: String,
    pub extension: Option<String>,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub provider_id: String,
    pub can_read: bool,
    pub can_list: bool,
    pub can_write: bool,
    pub can_delete: bool,
    pub can_rename: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryBatchEventDto {
    pub session_id: String,
    pub uri: String,
    pub entries: Vec<FileEntryDto>,
    pub batch_index: u64,
    pub is_complete: bool,
    pub total_hint: Option<u64>,
    pub error: Option<IpcError>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub code: String,
    pub message: String,
}

impl From<FileEntry> for FileEntryDto {
    fn from(entry: FileEntry) -> Self {
        Self {
            uri: entry.uri.as_str().to_string(),
            name: entry.name,
            extension: entry.extension,
            kind: entry.kind,
            size: entry.size,
            modified_at: entry.modified_at,
            created_at: entry.created_at,
            accessed_at: entry.accessed_at,
            is_hidden: entry.is_hidden,
            is_symlink: entry.is_symlink,
            symlink_target: entry.symlink_target.map(|uri| uri.as_str().to_string()),
            provider_id: entry.provider_id.as_str().to_string(),
            can_read: entry.capabilities.can_read,
            can_list: entry.capabilities.can_list,
            can_write: entry.capabilities.can_write,
            can_delete: entry.capabilities.can_delete,
            can_rename: entry.capabilities.can_rename,
        }
    }
}

impl From<DirectoryBatch> for DirectoryBatchEventDto {
    fn from(batch: DirectoryBatch) -> Self {
        Self {
            session_id: batch.session_id.as_str().to_string(),
            uri: batch.uri.as_str().to_string(),
            entries: batch.entries.into_iter().map(Into::into).collect(),
            batch_index: batch.batch_index,
            is_complete: batch.is_complete,
            total_hint: batch.total_hint,
            error: None,
        }
    }
}

impl From<VfsError> for IpcError {
    fn from(error: VfsError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

impl IpcError {
    pub fn internal(message: &str) -> Self {
        Self {
            code: "internal".to_string(),
            message: message.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vfs::{EntryCapabilities, ProviderId, ResourceUri};

    #[test]
    fn serializes_stat_response() {
        let response = StatResponse {
            entry: FileEntryDto::from(FileEntry {
                uri: ResourceUri::parse("local:///tmp/file.txt").unwrap(),
                name: "file.txt".to_string(),
                extension: Some("txt".to_string()),
                kind: FileKind::File,
                size: Some(42),
                modified_at: None,
                created_at: None,
                accessed_at: None,
                is_hidden: false,
                is_symlink: false,
                symlink_target: None,
                provider_id: ProviderId::new("local"),
                capabilities: EntryCapabilities::read_only_file(),
            }),
        };

        let encoded = serde_json::to_string(&response).unwrap();
        let decoded: StatResponse = serde_json::from_str(&encoded).unwrap();

        assert_eq!(decoded.entry.uri, "local:///tmp/file.txt");
        assert_eq!(decoded.entry.kind, FileKind::File);
    }

    #[test]
    fn serializes_directory_batch_event() {
        let event = DirectoryBatchEventDto {
            session_id: "session-1".to_string(),
            uri: "local:///tmp".to_string(),
            entries: Vec::new(),
            batch_index: 0,
            is_complete: true,
            total_hint: None,
            error: None,
        };

        let encoded = serde_json::to_string(&event).unwrap();
        let decoded: DirectoryBatchEventDto = serde_json::from_str(&encoded).unwrap();

        assert_eq!(decoded.session_id, "session-1");
        assert!(decoded.is_complete);
    }

    #[test]
    fn maps_vfs_error_to_ipc_error() {
        let error = IpcError::from(VfsError::invalid_uri("bad", "missing scheme"));

        assert_eq!(error.code, "invalid_uri");
        assert!(error.message.contains("missing scheme"));
    }
}
