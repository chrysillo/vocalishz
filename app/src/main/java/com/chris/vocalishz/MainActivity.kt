package com.chris.vocalishz

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Build
import android.os.Bundle
import android.view.WindowInsets
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.FrameLayout
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.min
import kotlin.math.sin

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var detector: PitchDetector? = null
    @Volatile private var wantMic = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // System bar colours come from Theme.Vocalishz; the page follows the same day/night setting via theme.css.
        val bg = getColor(R.color.theme_bg)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.setBackgroundColor(bg)
        web.addJavascriptInterface(Bridge(), "Android")
        web.loadUrl("file:///android_asset/index.html")
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
    }

    /** Lets the page close its inner screens first; the app closes only when the page has nowhere to go back to. */
    @Deprecated("Predictive back is not enabled for this app")
    override fun onBackPressed() {
        web.evaluateJavascript("window.V && V.app && V.app.back()") { handled ->
            @Suppress("DEPRECATION")
            if (handled != "true") super.onBackPressed()
        }
    }

    private fun hasMic() = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun js(code: String) = runOnUiThread { web.evaluateJavascript(code, null) }

    private fun startMic() {
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
        if (wantMic && hasMic()) startMic()
    }

    override fun onPause() {
        // Never hold the microphone while the app is in the background.
        stopMic()
        super.onPause()
    }

    /** Plays a plucked-string style reference tone. */
    private fun playTone(hz: Double, seconds: Double) {
        val rate = 44100
        val n = (rate * seconds).toInt()
        val buf = ShortArray(n) { i ->
            val t = i.toDouble() / rate
            val w = (sin(2 * PI * hz * t) + 0.4 * sin(4 * PI * hz * t) + 0.15 * sin(6 * PI * hz * t)) / 1.55
            val env = min(1.0, t / 0.005) * exp(-t * 2.2)
            (w * env * 0.8 * Short.MAX_VALUE).toInt().toShort()
        }
        val track = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setAudioFormat(AudioFormat.Builder()
                .setSampleRate(rate)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setBufferSizeInBytes(n * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()
        track.write(buf, 0, n)
        track.play()
        Thread.sleep((seconds * 1000).toLong() + 100)
        track.release()
    }

    inner class Bridge {
        @JavascriptInterface
        fun startMic() { wantMic = true; runOnUiThread { this@MainActivity.startMic() } }
        @JavascriptInterface
        fun stopMic() { wantMic = false; runOnUiThread { this@MainActivity.stopMic() } }
        @JavascriptInterface
        fun playTone(hz: Double, seconds: Double) { Thread { this@MainActivity.playTone(hz, seconds) }.start() }
    }
}
