//! Locale detection only: no database, network, launcher or machine setting changes.
#[cfg(not(windows))]
pub fn system_locale() -> String {
    locale_from_environment(|key| std::env::var(key).ok())
}
#[cfg(not(windows))]
fn locale_from_environment(read: impl Fn(&str) -> Option<String>) -> String {
    ["LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"]
        .into_iter()
        .filter_map(read)
        .find(|value| !value.trim().is_empty())
        .map(|value| value.split(':').next().unwrap_or("en").to_owned())
        .unwrap_or_else(|| "en".into())
}
#[cfg(windows)]
pub fn system_locale() -> String {
    let mut buffer = [0u16; 85];
    // OS-owned locale name, no frontend input or user setting writes.
    let length = unsafe { windows::Win32::Globalization::GetUserDefaultLocaleName(&mut buffer) };
    if length > 1 {
        String::from_utf16_lossy(&buffer[..length as usize - 1])
    } else {
        "en".into()
    }
}
#[cfg(all(test, not(windows)))]
mod tests {
    use super::*;
    #[test]
    fn follows_os_message_locale_precedence_without_mutating_environment() {
        assert_eq!(
            locale_from_environment(|key| match key {
                "LC_MESSAGES" => Some("tr_TR.UTF-8".into()),
                "LANG" => Some("en_US.UTF-8".into()),
                _ => None,
            }),
            "tr_TR.UTF-8"
        );
        assert_eq!(
            locale_from_environment(|key| (key == "LC_ALL").then(|| "C.UTF-8".into())),
            "C.UTF-8"
        );
        assert_eq!(locale_from_environment(|_| None), "en");
        assert_eq!(
            locale_from_environment(|key| (key == "LANGUAGE").then(|| "tr:en".into())),
            "tr"
        );
    }
}
