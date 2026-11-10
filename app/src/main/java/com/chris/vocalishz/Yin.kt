package com.chris.vocalishz

import kotlin.math.sqrt

/**
 * YIN pitch estimation over a sliding window. Pure maths with no Android APIs, so it can be
 * unit-tested with synthetic tones.
 */
class Yin(
    private val rate: Int = RATE,
    private val window: Int = WINDOW,
    private val threshold: Double = THRESHOLD,
    private val minHz: Double = MIN_HZ,
    private val maxHz: Double = MAX_HZ,
    private val silenceRms: Double = SILENCE_RMS
) {
    companion object {
        const val RATE = 22050
        const val WINDOW = 2048
        const val THRESHOLD = 0.15
        const val MIN_HZ = 35.0
        const val MAX_HZ = 1600.0
        const val SILENCE_RMS = 0.008

        /** Halves the sample rate by averaging pairs of 16-bit samples into floats in -1..1. */
        fun decimate(raw: ShortArray, out: FloatArray, offset: Int, count: Int) {
            for (i in 0 until count) out[offset + i] = (raw[2 * i] + raw[2 * i + 1]) / 65536f
        }
    }

    /** `hz` is 0 when the window is silent or has no clear pitch. */
    data class Result(val hz: Double, val clarity: Double, val level: Double)

    private val diff = FloatArray(window / 2)

    fun analyse(x: FloatArray): Result {
        var sum = 0.0
        for (v in x) sum += v * v
        val rms = sqrt(sum / x.size)
        if (rms < silenceRms) return Result(0.0, 0.0, rms)

        val half = window / 2
        val tauMin = (rate / maxHz).toInt()
        val tauMax = minOf(half - 1, (rate / minHz).toInt())

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
            if (diff[t] < threshold) {
                while (t + 1 <= tauMax && diff[t + 1] < diff[t]) t++
                tau = t; break
            }
            t++
        }
        if (tau < 0) return Result(0.0, 0.0, rms)

        // Parabolic interpolation for sub-sample accuracy.
        var better = tau.toDouble()
        if (tau in 1 until tauMax) {
            val a = diff[tau - 1]; val b = diff[tau]; val c = diff[tau + 1]
            val den = a + c - 2 * b
            if (den != 0f) better = tau + (a - c) / (2.0 * den)
        }
        return Result(rate / better, 1.0 - diff[tau], rms)
    }
}
