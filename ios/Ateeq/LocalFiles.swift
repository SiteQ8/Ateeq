import Foundation
import WebKit

/// Serves the web app from the app bundle (the Web folder) under ateeq://local/.
/// Nothing is fetched from the internet: every page, font and data file ships inside the app.
final class LocalFiles: NSObject, WKURLSchemeHandler {
    static let scheme = "ateeq"
    static let host = "local"

    private let root: URL = {
        let base = Bundle.main.resourceURL ?? Bundle.main.bundleURL
        return base.appendingPathComponent("Web", isDirectory: true).standardizedFileURL
    }()

    static func url(fragment: String?) -> URL {
        var parts = URLComponents()
        parts.scheme = scheme
        parts.host = host
        parts.path = "/app/index.html"
        if let fragment, !fragment.isEmpty {
            parts.fragment = fragment.hasPrefix("#") ? String(fragment.dropFirst()) : fragment
        }
        return parts.url!
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/app/index.html" }
        if path.hasSuffix("/") { path += "index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            respond(task, url: url, status: 404, type: "text/plain; charset=utf-8", data: Data())
            return
        }
        respond(task, url: url, status: 200, type: Self.mime(file.pathExtension), data: data)
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, type: String, data: Data) {
        let headers = ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else { return }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    static func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "webp": return "image/webp"
        case "woff2": return "font/woff2"
        case "txt": return "text/plain; charset=utf-8"
        default: return "application/octet-stream"
        }
    }
}
