package com.eworldq8.ateeq

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject

/**
 * Hosts the app. Pages, data and fonts come from the APK's own assets through
 * WebViewAssetLoader, so nothing is fetched from the internet. The page talks back through
 * AteeqAndroid for what only the phone can do: haptics, keeping the screen on during tawaf
 * and sa'i, the share sheet, the clipboard, and the ihram alert as a real notification that
 * fires even when the app is closed.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var statusStrip: View
    private lateinit var navStrip: View
    private var waitingAlarms: JSONArray? = null

    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val items = waitingAlarms
        waitingAlarms = null
        if (granted && items != null) Alarms.schedule(this, items)
    }

    private val back = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
            if (web.canGoBack()) {
                web.goBack()
            } else {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= 29) {
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }

        val band = ContextCompat.getColor(this, R.color.band)
        statusStrip = View(this).apply { setBackgroundColor(band) }
        navStrip = View(this).apply { setBackgroundColor(band) }
        web = WebView(this).apply { setBackgroundColor(band) }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(band)
            addView(statusStrip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0))
            addView(web, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(navStrip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0))
        }
        setContentView(root)

        // The page draws between the system bars, which take the palette's colours.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            statusStrip.layoutParams = statusStrip.layoutParams.apply { height = bars.top }
            navStrip.layoutParams = navStrip.layoutParams.apply { height = maxOf(bars.bottom, keyboard.bottom) }
            view.setPadding(bars.left, 0, bars.right, 0)
            WindowInsetsCompat.CONSUMED
        }

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            // Text size lives in the app's own settings, which start from the phone's font scale.
            textZoom = 100
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
        }
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        web.addJavascriptInterface(Bridge(), "AteeqAndroid")

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? =
                request?.url?.let { loader.shouldInterceptRequest(it) }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return true
                if (url.host == WebViewAssetLoader.DEFAULT_DOMAIN) return false
                openOutside(url)
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                val text = message.orEmpty()
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(text)
                    .setPositiveButton(word("ok", text)) { _, _ -> result?.confirm() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                val text = message.orEmpty()
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(text)
                    .setPositiveButton(word("ok", text)) { _, _ -> result?.confirm() }
                    .setNegativeButton(word("cancel", text)) { _, _ -> result?.cancel() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }
        }
        onBackPressedDispatcher.addCallback(this, back)

        val route = intent.getStringExtra("route").orEmpty()
        val hash = when {
            route.isEmpty() -> ""
            route.startsWith("#") -> route
            else -> "#$route"
        }
        web.loadUrl("https://${WebViewAssetLoader.DEFAULT_DOMAIN}/app/index.html$hash")
    }

    override fun onResume() {
        super.onResume()
        back.isEnabled = true
    }

    private fun openOutside(url: Uri) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
    }

    /** Dialog buttons follow the language of the question the app is asking. */
    private fun word(key: String, message: String): String {
        val arabic = message.any { it in '\u0600'..'\u06FF' }
        return when {
            key == "ok" && arabic -> "نعم"
            key == "cancel" && arabic -> "إلغاء"
            key == "ok" -> "OK"
            else -> "Cancel"
        }
    }

    private fun handle(msg: JSONObject) {
        when (msg.optString("type")) {
            "haptic" -> web.performHapticFeedback(
                when (msg.optString("style")) {
                    "success" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
                    "medium" -> HapticFeedbackConstants.VIRTUAL_KEY
                    else -> HapticFeedbackConstants.CLOCK_TICK
                }
            )
            "awake" ->
                if (msg.optBoolean("on")) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            "copy" -> getSystemService(ClipboardManager::class.java)
                ?.setPrimaryClip(ClipData.newPlainText(getString(R.string.app_name), msg.optString("text")))
            "share" -> runCatching {
                val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, msg.optString("text"))
                startActivity(Intent.createChooser(send, null))
            }
            "theme" -> paintBars(msg)
            "alarms" -> alarms(msg.optJSONArray("items") ?: JSONArray())
        }
    }

    private fun paintBars(msg: JSONObject) {
        val band = color(msg.optString("band")) ?: return
        val card = color(msg.optString("card")) ?: color(msg.optString("background")) ?: band
        statusStrip.setBackgroundColor(band)
        navStrip.setBackgroundColor(card)
        web.setBackgroundColor(color(msg.optString("background")) ?: card)
        val bars = WindowInsetsControllerCompat(window, window.decorView)
        bars.isAppearanceLightStatusBars = msg.optBoolean("lightBand")
        bars.isAppearanceLightNavigationBars = luminance(card) > 0.5
    }

    private fun color(hex: String): Int? = if (hex.isEmpty()) null else runCatching { Color.parseColor(hex) }.getOrNull()

    private fun luminance(c: Int) = (0.2126 * Color.red(c) + 0.7152 * Color.green(c) + 0.0722 * Color.blue(c)) / 255.0

    private fun alarms(items: JSONArray) {
        Alarms.clear(this)
        if (items.length() == 0) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            waitingAlarms = items
            askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        Alarms.schedule(this, items)
    }

    private fun versionName(): String = runCatching {
        packageManager.getPackageInfo(packageName, 0).versionName ?: ""
    }.getOrDefault("")

    /** What the page can ask of the phone. Called on a background thread, so work moves to the UI thread. */
    inner class Bridge {
        @JavascriptInterface
        fun info(): String {
            val out = JSONObject()
            out.put("platform", "android")
            out.put("version", versionName())
            out.put("textScale", resources.configuration.fontScale.toDouble())
            // A prepared state, passed only when the app is opened for screenshots.
            intent.getStringExtra("state")?.let { encoded ->
                runCatching { String(Base64.decode(encoded, Base64.DEFAULT), Charsets.UTF_8) }.getOrNull()?.let { out.put("state", it) }
                intent.removeExtra("state")
            }
            return out.toString()
        }

        @JavascriptInterface
        fun post(json: String) {
            val msg = runCatching { JSONObject(json) }.getOrNull() ?: return
            runOnUiThread { handle(msg) }
        }
    }
}
