import UIKit
import WebKit
import UserNotifications

/// Hosts the app. The pages come from the bundle through LocalFiles, and the page talks back
/// through the "ateeq" message handler for what only the phone can do: haptics, keeping the
/// screen on during tawaf and sa'i, the share sheet, the clipboard, and the ihram alert as a
/// real notification that fires even when the app is closed.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!
    private var lightBand = false

    override var preferredStatusBarStyle: UIStatusBarStyle { lightBand ? .darkContent : .lightContent }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalFiles(), forURLScheme: LocalFiles.scheme)
        config.dataDetectorTypes = []
        let content = WKUserContentController()
        content.addUserScript(WKUserScript(source: Self.bootScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.addUserScript(WKUserScript(source: Self.viewportScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        content.add(WeakHandler(self), name: "ateeq")
        config.userContentController = content

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        let background = UIColor(named: "LaunchBackground") ?? .black
        web.backgroundColor = background
        web.scrollView.backgroundColor = background
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.showsVerticalScrollIndicator = false
        web.scrollView.showsHorizontalScrollIndicator = false
        web.allowsLinkPreview = false
        web.allowsBackForwardNavigationGestures = true
        webView = web
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: LocalFiles.url(fragment: UserDefaults.standard.string(forKey: "route"))))
    }

    // MARK: what the page learns at start

    /// The phone's text size and platform, and a prepared state when launched for screenshots.
    private static func bootScript() -> String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        let shot = UserDefaults.standard.string(forKey: "state") != nil
        var js = "window.AteeqNative = { platform: 'ios', version: \(literal(version)), textScale: \(textScale()), shot: \(shot) };"
        if let encoded = UserDefaults.standard.string(forKey: "state"),
           let data = Data(base64Encoded: encoded),
           let json = String(data: data, encoding: .utf8) {
            js += "try { localStorage.setItem('ateeq.v1', \(literal(json))); } catch (e) {}"
        }
        return js
    }

    /// Text size lives in the app's own settings, so pinch zoom is off inside the app.
    private static let viewportScript = """
    (function () {
      var m = document.querySelector('meta[name=viewport]');
      if (m) m.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    })();
    """

    private static func literal(_ text: String) -> String {
        guard let data = try? JSONEncoder().encode(text), let out = String(data: data, encoding: .utf8) else { return "''" }
        return out
    }

    /// Follows the text size chosen in iOS settings until the person picks one in the app.
    private static func textScale() -> Double {
        switch UIApplication.shared.preferredContentSizeCategory {
        case .extraSmall, .small, .medium, .large: return 1.0
        case .extraLarge: return 1.12
        case .extraExtraLarge: return 1.25
        default: return 1.4
        }
    }

    // MARK: messages from the page

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "haptic":
            switch body["style"] as? String {
            case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "medium": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        case "awake":
            UIApplication.shared.isIdleTimerDisabled = (body["on"] as? Bool) ?? false
        case "copy":
            if let text = body["text"] as? String { UIPasteboard.general.string = text }
        case "share":
            guard let text = body["text"] as? String else { return }
            let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = view
            present(sheet, animated: true)
        case "theme":
            lightBand = (body["lightBand"] as? Bool) ?? false
            if let band = (body["band"] as? String).flatMap(UIColor.init(hex:)) {
                webView.backgroundColor = band
                webView.scrollView.backgroundColor = band
                view.window?.backgroundColor = band
            }
            setNeedsStatusBarAppearanceUpdate()
        case "alarms":
            Alarms.schedule(body["items"] as? [[String: Any]] ?? [])
        default:
            break
        }
    }

    // MARK: links and dialogs

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        if url.scheme == LocalFiles.scheme { return decisionHandler(.allow) }
        if ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme != LocalFiles.scheme { UIApplication.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: Self.word("ok", for: message), style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: Self.word("cancel", for: message), style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: Self.word("ok", for: message), style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    /// Dialog buttons follow the language of the question the app is asking.
    private static func word(_ key: String, for message: String) -> String {
        let arabic = message.unicodeScalars.contains { (0x0600...0x06FF).contains($0.value) }
        switch (key, arabic) {
        case ("ok", true): return "نعم"
        case ("cancel", true): return "إلغاء"
        case ("ok", false): return "OK"
        default: return "Cancel"
        }
    }
}

/// Keeps the message handler from holding the controller forever.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

/// The plane alert: "get ready" and "time to enter ihram", scheduled on the phone itself.
enum Alarms {
    private static let ids = ["ateeq.prepare", "ateeq.intent"]

    static func schedule(_ items: [[String: Any]]) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ids)
        guard !items.isEmpty else { return }
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            for item in items {
                guard let id = item["id"] as? String, let at = (item["at"] as? NSNumber)?.doubleValue else { continue }
                let seconds = at / 1000 - Date().timeIntervalSince1970
                guard seconds > 1 else { continue }
                let note = UNMutableNotificationContent()
                note.title = item["title"] as? String ?? ""
                note.body = item["body"] as? String ?? ""
                note.sound = .default
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
                center.add(UNNotificationRequest(identifier: "ateeq." + id, content: note, trigger: trigger))
            }
        }
    }
}

extension UIColor {
    convenience init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.count == 6, let value = UInt32(text, radix: 16) else { return nil }
        self.init(red: CGFloat((value >> 16) & 0xFF) / 255,
                  green: CGFloat((value >> 8) & 0xFF) / 255,
                  blue: CGFloat(value & 0xFF) / 255, alpha: 1)
    }
}
