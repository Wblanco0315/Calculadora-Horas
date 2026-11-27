//! OpenProject base URL sanitising and href resolution.

pub(crate) fn sanitize_url(url: &str) -> String {
    let mut clean = url.trim().trim_end_matches('/').to_string();
    if clean.is_empty() {
        clean = "https://openproject.wposs.com/openproject".to_string();
    }
    if clean.ends_with("/api/v3") {
        clean = clean[..clean.len() - 7].to_string();
    }
    clean
}

/// Returns the scheme + host (+ port) portion of an absolute URL.
pub(crate) fn openproject_origin(url: &str) -> String {
    match url.find("://") {
        Some(scheme_end) => {
            let after = &url[scheme_end + 3..];
            match after.find('/') {
                Some(path_start) => url[..scheme_end + 3 + path_start].to_string(),
                None => url.to_string(),
            }
        }
        None => url.to_string(),
    }
}

/// Resolves an OpenProject href (absolute, root-relative or relative) against the configured
/// base URL, avoiding a duplicated relative root (e.g. `/openproject/openproject/api/v3/...`).
pub(crate) fn resolve_openproject_href(clean_url: &str, href: &str) -> String {
    let href = href.trim();
    if href.starts_with("http://") || href.starts_with("https://") {
        return href.to_string();
    }
    let origin = openproject_origin(clean_url);
    let base_path = clean_url[origin.len()..].trim_end_matches('/');
    if href.starts_with('/') {
        if !base_path.is_empty()
            && (href == base_path || href.starts_with(&format!("{}/", base_path)))
        {
            return format!("{}{}", origin, href);
        }
        return format!("{}{}", clean_url, href);
    }
    format!("{}/{}", clean_url, href)
}
