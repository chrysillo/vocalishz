package com.chris.vocalishz

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder

/**
 * Reads the microphone and estimates pitch with [Yin].
 * Audio is captured at 44.1 kHz and halved to 22.05 kHz, which keeps the
 * maths cheap while still reaching down to a bass low E (41 Hz).
 *
 * [onError] is called from the capture thread when the microphone can't be opened or stops
 * delivering audio (held by another app or a call, or the audio server restarted); capture ends.
 */
class PitchDetector(
    private val onPitch: (hz: Double, clarity: Double, level: Double) -> Unit,
    private val onError: () -> Unit
) {
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
            if (r.state != AudioRecord.STATE_INITIALIZED) { r.release(); fail(); return@Thread }
            rec = r
            val yin = Yin()
            val raw = ShortArray(HOP * 2)
            val win = FloatArray(Yin.WINDOW)
            try {
                r.startRecording()
                if (r.recordingState != AudioRecord.RECORDSTATE_RECORDING) { fail(); return@Thread }
                while (running) {
                    var got = 0
                    while (got < raw.size && running) {
                        val n = r.read(raw, got, raw.size - got)
                        // A blocking read only comes back empty or negative on an error, or when stop()
                        // stops the recorder; retrying would spin, so capture ends either way.
                        if (n <= 0) { fail(); return@Thread }
                        got += n
                    }
                    if (got < raw.size) break
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

    /** Ends capture and reports it, unless [stop] asked for it. Runs on the capture thread. */
    private fun fail() {
        if (running) { running = false; onError() }
    }

    /** Called on the main thread: stopping the recorder unblocks a pending read, so the wait is short. */
    fun stop() {
        running = false
        try { rec?.stop() } catch (_: IllegalStateException) { /* already stopped or released */ }
        thread?.join(STOP_WAIT_MS)
        thread = null
    }
}
