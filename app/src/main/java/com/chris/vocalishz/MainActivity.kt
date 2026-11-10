package com.chris.vocalishz

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.view.WindowInsets
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import android.widget.FrameLayout
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.min
import kotlin.math.sin

class MainActivity : Activity() {
    companion object {
        private const val PAGE = "file:///android_asset/index.html"
        private const val ASSETS = "file:///android_asset/"
        private const val MIN_TONE_HZ = 20.0
        private const val MAX_TONE_HZ = 5000.0
        private const val MIN_TONE_SECONDS = 0.05
        private const val MAX_TONE_SECONDS = 5.0
        private const val TONE_RATE = 44100
    }

    private lateinit var web: WebView
    private var detector: PitchDetector? = null
    @Volatile private var wantMic = false
    private var resumed = false

    // Reference tones are built and played on one background thread; only the latest one sounds.
    private val toneThread = HandlerThread("tones").apply { start() }
    private val tones = Handler(toneThread.looper)
    private var track: AudioTrack? = null  // touched only on toneThread
    private val releaseTone = Runnable { stopTone() }

    private var backCallback: OnBackInvokedCallback? = null

    @SuppressLint("SetJavaScriptEnabled")  // the page is bundled and navigation is limited to the app's assets
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // System bar colours come from Theme.Vocalishz; the page follows the same day/night setting via theme.css.
        val bg = getColor(R.color.theme_bg)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        // Bundled assets still load; other file:// and content:// URLs do not.
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) =
                !request.url.toString().startsWith(ASSETS)
        }
        web.setBackgroundColor(bg)
        web.addJavascriptInterface(Bridge(), "Android")
        web.loadUrl(PAGE)
        val root = FrameLayout(this)
        root.setBackgroundColor(bg)
        root.addView(web)
        setContentView(root)
        // Android 15+ draws edge-to-edge, so keep the page clear of the status and navigation bars.
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener { v, insets ->
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                insets
            }
        }
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = OnBackInvokedCallback { goBack() }.also {
                onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, it)
            }
        }
    }

    /** Lets the page close its inner screens first; the app closes only when the page has nowhere to go back to. */
    private fun goBack() {
        web.evaluateJavascript("window.V && V.app && V.app.back()") { handled ->
            if (handled != "true") finish()
        }
    }

    @Deprecated("Used below Android 13; newer versions use the OnBackInvokedCallback")
    override fun onBackPressed() = goBack()

    private fun hasMic() = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun js(code: String) = runOnUiThread { if (!isDestroyed) web.evaluateJavascript(code, null) }

    /** Starts listening only while the app is in the foreground; [onResume] picks up a request made while paused. */
    private fun startMic() {
        if (!resumed) return
        if (!hasMic()) { requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1); return }
        if (detector == null) {
            detector = PitchDetector { hz, clarity, level ->
                js("window.onPitch && onPitch($hz,$clarity,$level)")
            }.also { it.start() }
        }
        js("window.onMicState && onMicState('on')")
    }

    private fun stopMic() {
        detector?.stop()
        detector = null
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        if (hasMic()) { if (wantMic) startMic() } else js("window.onMicState && onMicState('denied')")
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        web.onResume()
        if (wantMic && hasMic()) startMic()
    }

    override fun onPause() {
        // Never hold the microphone, or keep a tone or page timers running, while the app is in the background.
        resumed = false
        stopMic()
        tones.post { stopTone() }
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= 33) backCallback?.let { onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it) }
        stopMic()
        tones.post { stopTone() }
        toneThread.quitSafely()
        web.destroy()
        super.onDestroy()
    }

    /** Runs on toneThread. */
    private fun stopTone() {
        tones.removeCallbacks(releaseTone)
        track?.let { it.stop(); it.release() }
        track = null
    }

    /** Plays a plucked-string style reference tone. Runs on toneThread. */
    private fun playTone(hz: Double, seconds: Double) {
        stopTone()
        val n = (TONE_RATE * seconds).toInt()
        val buf = ShortArray(n) { i ->
            val t = i.toDouble() / TONE_RATE
            val w = (sin(2 * PI * hz * t) + 0.4 * sin(4 * PI * hz * t) + 0.15 * sin(6 * PI * hz * t)) / 1.55
            val env = min(1.0, t / 0.005) * exp(-t * 2.2)
            (w * env * 0.8 * Short.MAX_VALUE).toInt().toShort()
        }
        val t = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setAudioFormat(AudioFormat.Builder()
                .setSampleRate(TONE_RATE)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setBufferSizeInBytes(n * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()
        track = t
        try {
            t.write(buf, 0, n)
            t.play()
            tones.postDelayed(releaseTone, (seconds * 1000).toLong() + 100)
        } catch (e: IllegalStateException) {
            stopTone()
        }
    }

    inner class Bridge {
        @JavascriptInterface
        fun startMic() { wantMic = true; runOnUiThread { this@MainActivity.startMic() } }
        @JavascriptInterface
        fun stopMic() { wantMic = false; runOnUiThread { this@MainActivity.stopMic() } }
        @JavascriptInterface
        fun playTone(hz: Double, seconds: Double) {
            // Arguments come from page JS: ignore non-numbers and keep both within what a reference tone needs.
            if (!hz.isFinite() || !seconds.isFinite()) return
            val f = hz.coerceIn(MIN_TONE_HZ, MAX_TONE_HZ)
            val s = seconds.coerceIn(MIN_TONE_SECONDS, MAX_TONE_SECONDS)
            tones.post { this@MainActivity.playTone(f, s) }
        }
    }
}
