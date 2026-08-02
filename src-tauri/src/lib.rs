use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use keyring::{Entry, Error as KeyringError};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    fs::File,
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

const KEYRING_SERVICE: &str = "com.solcogito.tresh.vault";
const CURRENT_FILE: &str = "current.tresh.enc";
const BACKUP_LIMIT: usize = 20;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultScopeRequest {
    account_id: String,
    site_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveVaultRequest {
    account_id: String,
    site_id: String,
    document: Value,
    saved_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultEnvelope {
    document: Value,
    saved_at: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultStatus {
    available: bool,
    path: String,
    saved_at: Option<u64>,
    backup_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultLoadResult {
    envelope: Option<VaultEnvelope>,
    status: VaultStatus,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EncryptedVaultFile {
    version: u8,
    saved_at: u64,
    nonce: String,
    ciphertext: String,
}

fn safe_segment(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() || trimmed.len() > 128 {
        return Err(format!("{label} invalide."));
    }

    if !trimmed
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(format!("{label} contient des caractères non permis."));
    }

    Ok(trimmed.to_owned())
}

fn millis_now() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| format!("Horloge système invalide: {error}"))
}

fn vault_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .local_data_dir()
        .map(|path| path.join("Tresh").join("vaults"))
        .map_err(|error| format!("Impossible de résoudre AppData local: {error}"))
}

fn vault_dir(app: &tauri::AppHandle, account_id: &str, site_id: &str) -> Result<PathBuf, String> {
    Ok(vault_root(app)?
        .join(safe_segment(account_id, "Identifiant de compte")?)
        .join(safe_segment(site_id, "Identifiant de site")?))
}

fn current_path(directory: &Path) -> PathBuf {
    directory.join(CURRENT_FILE)
}

fn backups_dir(directory: &Path) -> PathBuf {
    directory.join("backups")
}

fn aad(account_id: &str, site_id: &str) -> String {
    format!("tresh-vault-v1:{account_id}:{site_id}")
}

fn account_key(account_id: &str) -> Result<Vec<u8>, String> {
    let account_id = safe_segment(account_id, "Identifiant de compte")?;
    let entry = Entry::new(KEYRING_SERVICE, &account_id)
        .map_err(|error| format!("Coffre Windows indisponible: {error}"))?;

    match entry.get_secret() {
        Ok(secret) if secret.len() == 32 => Ok(secret),
        Ok(_) => Err("La clé locale Tresh enregistrée dans Windows est invalide.".to_owned()),
        Err(KeyringError::NoEntry) => {
            let mut secret = vec![0_u8; 32];
            OsRng.fill_bytes(&mut secret);
            entry
                .set_secret(&secret)
                .map_err(|error| format!("Impossible de protéger la clé dans Windows: {error}"))?;
            Ok(secret)
        }
        Err(error) => Err(format!(
            "Impossible de lire la clé protégée Windows: {error}"
        )),
    }
}

fn encrypt_envelope(
    key: &[u8],
    account_id: &str,
    site_id: &str,
    envelope: &VaultEnvelope,
) -> Result<EncryptedVaultFile, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| "La clé du coffre local est invalide.".to_owned())?;
    let mut nonce_bytes = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let plaintext = serde_json::to_vec(envelope)
        .map_err(|error| format!("Impossible de sérialiser le brouillon: {error}"))?;
    let associated_data = aad(account_id, site_id);
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: &plaintext,
                aad: associated_data.as_bytes(),
            },
        )
        .map_err(|_| "Impossible de chiffrer le brouillon local.".to_owned())?;

    Ok(EncryptedVaultFile {
        version: 1,
        saved_at: envelope.saved_at,
        nonce: BASE64.encode(nonce_bytes),
        ciphertext: BASE64.encode(ciphertext),
    })
}

fn decrypt_file(
    path: &Path,
    key: &[u8],
    account_id: &str,
    site_id: &str,
) -> Result<VaultEnvelope, String> {
    let raw =
        fs::read(path).map_err(|error| format!("Impossible de lire le coffre local: {error}"))?;
    let encrypted: EncryptedVaultFile = serde_json::from_slice(&raw)
        .map_err(|error| format!("Fichier de coffre local invalide: {error}"))?;

    if encrypted.version != 1 {
        return Err(format!(
            "Version de coffre local non prise en charge: {}.",
            encrypted.version
        ));
    }

    let nonce = BASE64
        .decode(encrypted.nonce)
        .map_err(|_| "Nonce de coffre local invalide.".to_owned())?;
    let ciphertext = BASE64
        .decode(encrypted.ciphertext)
        .map_err(|_| "Contenu de coffre local invalide.".to_owned())?;

    if nonce.len() != 12 {
        return Err("Nonce de coffre local invalide.".to_owned());
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| "La clé du coffre local est invalide.".to_owned())?;
    let associated_data = aad(account_id, site_id);
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: &ciphertext,
                aad: associated_data.as_bytes(),
            },
        )
        .map_err(|_| {
            "Le coffre local ne peut pas être déchiffré pour ce compte Windows.".to_owned()
        })?;

    serde_json::from_slice(&plaintext)
        .map_err(|error| format!("Brouillon déchiffré invalide: {error}"))
}

fn backup_files(directory: &Path) -> Result<Vec<PathBuf>, String> {
    let backup_directory = backups_dir(directory);

    if !backup_directory.exists() {
        return Ok(Vec::new());
    }

    let mut files = fs::read_dir(&backup_directory)
        .map_err(|error| format!("Impossible de lire les sauvegardes locales: {error}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".tresh.enc"))
        })
        .collect::<Vec<_>>();

    files.sort();
    Ok(files)
}

fn trim_backups(directory: &Path) -> Result<(), String> {
    let files = backup_files(directory)?;

    if files.len() <= BACKUP_LIMIT {
        return Ok(());
    }

    for path in files.iter().take(files.len() - BACKUP_LIMIT) {
        fs::remove_file(path)
            .map_err(|error| format!("Impossible de nettoyer une ancienne sauvegarde: {error}"))?;
    }

    Ok(())
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Chemin de coffre local invalide.".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Impossible de créer le dossier du coffre: {error}"))?;

    let temporary = parent.join(format!(".current-{}.tmp", millis_now()?));
    {
        let mut file = File::create(&temporary)
            .map_err(|error| format!("Impossible de créer le fichier temporaire: {error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("Impossible d’écrire le fichier temporaire: {error}"))?;
        file.sync_all().map_err(|error| {
            format!("Impossible de synchroniser le fichier temporaire: {error}")
        })?;
    }

    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("Impossible de remplacer le coffre local: {error}"))?;
    }

    fs::rename(&temporary, path)
        .map_err(|error| format!("Impossible d’activer le nouveau coffre local: {error}"))
}

fn status_for(directory: &Path) -> Result<VaultStatus, String> {
    let current = current_path(directory);
    let saved_at = if current.exists() {
        let raw = fs::read(&current)
            .map_err(|error| format!("Impossible de lire le statut du coffre: {error}"))?;
        let encrypted: EncryptedVaultFile = serde_json::from_slice(&raw)
            .map_err(|error| format!("Statut de coffre local invalide: {error}"))?;
        Some(encrypted.saved_at)
    } else {
        None
    };

    Ok(VaultStatus {
        available: true,
        path: current.to_string_lossy().into_owned(),
        saved_at,
        backup_count: backup_files(directory)?.len(),
    })
}

#[tauri::command]
fn vault_load(
    app: tauri::AppHandle,
    request: VaultScopeRequest,
) -> Result<VaultLoadResult, String> {
    let directory = vault_dir(&app, &request.account_id, &request.site_id)?;
    let current = current_path(&directory);

    if !current.exists() {
        return Ok(VaultLoadResult {
            envelope: None,
            status: status_for(&directory)?,
        });
    }

    let key = account_key(&request.account_id)?;
    let envelope = decrypt_file(&current, &key, &request.account_id, &request.site_id)?;

    Ok(VaultLoadResult {
        envelope: Some(envelope),
        status: status_for(&directory)?,
    })
}

#[tauri::command]
fn vault_save(app: tauri::AppHandle, request: SaveVaultRequest) -> Result<VaultStatus, String> {
    let directory = vault_dir(&app, &request.account_id, &request.site_id)?;
    let current = current_path(&directory);
    let backup_directory = backups_dir(&directory);
    fs::create_dir_all(&backup_directory)
        .map_err(|error| format!("Impossible de créer le dossier de sauvegarde: {error}"))?;

    if current.exists() {
        let backup = backup_directory.join(format!("{}.tresh.enc", millis_now()?));
        fs::copy(&current, &backup)
            .map_err(|error| format!("Impossible de créer la sauvegarde versionnée: {error}"))?;
    }

    let key = account_key(&request.account_id)?;
    let encrypted = encrypt_envelope(
        &key,
        &request.account_id,
        &request.site_id,
        &VaultEnvelope {
            document: request.document,
            saved_at: request.saved_at,
        },
    )?;
    let bytes = serde_json::to_vec(&encrypted)
        .map_err(|error| format!("Impossible de préparer le coffre local: {error}"))?;

    write_atomic(&current, &bytes)?;
    trim_backups(&directory)?;
    status_for(&directory)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![vault_load, vault_save])
        .run(tauri::generate_context!())
        .expect("error while running Tresh");
}
