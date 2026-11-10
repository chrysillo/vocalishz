package com.chris.vocalishz

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlin.math.sqrt

/**
 * Reads the microphone and estimates pitch with the YIN algorithm.
 * Audio is captured at 44.1 kHz and halved to 22.05 kHz, which keeps the
 * maths cheap while still reaching down to a bass low E (41 Hz).
 */
class PitchDetector(private val onPitch: (hz: Double, clarity: Double, level: Double) -> Unit) {
    companion object {
        private const val IN_RATE = 44100
        const val RATE = 22050
        private const val WINDOW = 2048
        private const val HOP = 512
        private const val THRESHOLD = 0.15
        private const val MIN_HZ = 35.0
        private const val MAX_HZ = 1600.0
        private const val SILENCE_RMS = 0.008
    }

    @Volatile private var running = false
    private var thread: Thread? = null

    @SuppressLint("MissingPermission")
    fun start() {
        if (running) return
        running = true
        thread = Thread {
            val minBuf = AudioRecord.getMinBufferSize(IN_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val size = maxOf(minBuf, HOP * 2 * 2 * 4)
            // VOICE_RECOGNITION skips most noise suppression and auto gain, which would distort pitch.
            var rec = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,
                IN_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size)
            if (rec.state != AudioRecord.STATE_INITIALIZED) {
                rec.release()
                rec = AudioRecord(MediaRecorder.AudioSource.MIC,
                    IN_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size)
            }
            if (rec.state != AudioRecord.STATE_INITIALIZED) { rec.release(); running = false; return@Thread }
            val raw = ShortArray(HOP * 2)
            val win = FloatArray(WINDOW)
            rec.startRecording()
            while (running) {
                var got = 0
                while (got < raw.size && running) {
                    val n = rec.read(raw, got, raw.size - got)
                    if (n <= 0) break
                    got += n
                }
                if (got < raw.size) continue
                // Slide the window left by HOP and append the newly decimated samples.
                System.arraycopy(win, HOP, win, 0, WINDOW - HOP)
                for (i in 0 until HOP) {
                    win[WINDOW - HOP + i] = (raw[2 * i] + raw[2 * i + 1]) / 65536f
                }
                analyse(win)
            }
            rec.stop(); rec.release()
        }.apply { start() }
    }

    fun stop() {
        running = false
        thread?.join(500)
        thread = null
    }

    private val diff = FloatArray(WINDOW / 2)

    private fun analyse(x: FloatArray) {
        var sum = 0.0
        for (v in x) sum += v * v
        val rms = sqrt(sum / x.size)
        if (rms < SILENCE_RMS) { onPitch(0.0, 0.0, rms); return }

        val half = WINDOW / 2
        val tauMin = (RATE / MAX_HZ).toInt()
        val tauMax = minOf(half - 1, (RATE / MIN_HZ).toInt())

        // Difference function and cumulative mean normalisation.
        diff[0] = 1f
        var running = 0f
        for (tau in 1..tauMax) {
            var d = 0f
            for (i in 0 until half) { val delta = x[i] - x[i + tau]; d += delta * delta }
            running += d
            diff[tau] = if (running == 0f) 1f else d * tau / running
        }

        // First dip under the threshold, followed to its local minimum.
        var tau = -1
        var t = tauMin
        while (t <= tauMax) {
            if (diff[t] < THRESHOLD) {
                while (t + 1 <= tauMax && diff[t + 1] < diff[t]) t++
                tau = t; break
            }
            t++
        }
        if (tau < 0) { onPitch(0.0, 0.0, rms); return }

        // Parabolic interpolation for sub-sample accuracy.
        var better = tau.toDouble()
        if (tau in 1 until tauMax) {
            val a = diff[tau - 1]; val b = diff[tau]; val c = diff[tau + 1]
            val den = a + c - 2 * b
            if (den != 0f) better = tau + (a - c) / (2.0 * den)
        }
        onPitch(RATE / better, 1.0 - diff[tau], rms)
    }
}
