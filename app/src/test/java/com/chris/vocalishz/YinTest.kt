package com.chris.vocalishz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Random
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.sin

class YinTest {
    private fun sine(hz: Double, amp: Double = 0.5) =
        FloatArray(Yin.WINDOW) { i -> (amp * sin(2 * PI * hz * i / Yin.RATE)).toFloat() }

    private fun cents(found: Double, expected: Double) = 1200 * ln(found / expected) / ln(2.0)

    @Test
    fun knownNotesWithinTwoCents() {
        // Bass low E, guitar low E, A2, A4, C6.
        for (hz in listOf(41.2034, 82.4069, 110.0, 440.0, 1046.502)) {
            val r = Yin().analyse(sine(hz))
            assertTrue("$hz Hz read as ${r.hz} Hz", abs(cents(r.hz, hz)) < 2.0)
            assertTrue("clarity ${r.clarity} at $hz Hz", r.clarity > 0.85)
        }
    }

    @Test
    fun harmonicsStillGiveTheFundamental() {
        val hz = 196.0
        val x = FloatArray(Yin.WINDOW) { i ->
            val t = 2 * PI * hz * i / Yin.RATE
            (0.3 * sin(t) + 0.2 * sin(2 * t) + 0.1 * sin(3 * t)).toFloat()
        }
        assertTrue(abs(cents(Yin().analyse(x).hz, hz)) < 2.0)
    }

    @Test
    fun silenceIsZero() {
        val r = Yin().analyse(FloatArray(Yin.WINDOW))
        assertEquals(0.0, r.hz, 0.0)
        assertEquals(0.0, r.level, 0.0)
    }

    @Test
    fun quietSignalBelowGateIsZero() {
        assertEquals(0.0, Yin().analyse(sine(440.0, amp = 0.005)).hz, 0.0)
    }

    @Test
    fun noiseHasNoPitch() {
        val rnd = Random(1)
        val x = FloatArray(Yin.WINDOW) { (rnd.nextFloat() - 0.5f) }
        assertEquals(0.0, Yin().analyse(x).hz, 0.0)
    }

    @Test
    fun decimateAveragesPairs() {
        val out = FloatArray(2)
        Yin.decimate(shortArrayOf(16384, 16384, -32768, 0), out, 0, 2)
        assertEquals(0.5f, out[0], 1e-6f)
        assertEquals(-0.5f, out[1], 1e-6f)
    }
}
