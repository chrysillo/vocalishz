package com.chris.vocalishz

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder

/**
 * Reads the microphone and estimates pitch with [Yin].
 * Audio is captured at 44.1 kHz and halved to 22.05 kHz, which keeps the
 * maths cheap while still reaching down to a bass low E (41 Hz).
 */
class PitchDetector(private val onPitch: (hz: Double, clarity: Double, level: Double) -> Unit) {
    companion object {
        private const val IN_RATE = 44100
        private const val HOP = 512
        private const val STOP_WAIT_MS = 100L
    }

    @Volatile private var running = false
    @Volatile private var rec: AudioRecord? = null
    private var thread: Thread? = null

    @SuppressLint("MissingPermission")
    fun start() {
        if (running) return
        running = true
        thread = Thread {
            val minBuf = AudioRecord.getMinBufferSize(IN_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val size = maxOf(minBuf, HOP * 2 * 2 * 4)
            // VOICE_RECOGNITION skips most noise suppression and auto gain, which would distort pitch.
            var r = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,
                IN_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size)
            if (r.state != AudioRecord.STATE_INITIALIZED) {
                r.release()
                r = AudioRecord(MediaRecorder.AudioSource.MIC,
                    IN_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size)
            }
            if (r.state != AudioRecord.STATE_INITIALIZED) { r.release(); running = false; return@Thread }
            rec = r
            val yin = Yin()
            val raw = ShortArray(HOP * 2)
            val win = FloatArray(Yin.WINDOW)
            try {
                r.startRecording()
                while (running) {
                    var got = 0
                    while (got < raw.size && running) {
                        val n = r.read(raw, got, raw.size - got)
                        if (n <= 0) break
                        got += n
                    }
                    if (got < raw.size) continue
                    // Slide the window left by HOP and append the newly decimated samples.
                    System.arraycopy(win, HOP, win, 0, Yin.WINDOW - HOP)
                    Yin.decimate(raw, win, Yin.WINDOW - HOP, HOP)
                    val p = yin.analyse(win)
                    if (running) onPitch(p.hz, p.clarity, p.level)
                }
            } finally {
                rec = null
                r.release()
            }
        }.apply { start() }
    }

    /** Called on the main thread: stopping the recorder unblocks a pending read, so the wait is short. */
    fun stop() {
        running = false
        try { rec?.stop() } catch (_: IllegalStateException) { /* already stopped or released */ }
        thread?.join(STOP_WAIT_MS)
        thread = null
    }
}
