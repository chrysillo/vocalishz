plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.chris.vocalishz"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.chris.vocalishz"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

/**
 * Generates the app's colours from design/theme-canyon.json, the single source of truth:
 * - assets/theme.css: CSS custom properties, light by default and dark under prefers-color-scheme
 * - res/values/colors.xml: fixed canyon_light_* and canyon_dark_* colours plus theme_* aliases (light)
 * - res/values-night/colors.xml: theme_* aliases (dark)
 */
abstract class GenerateThemeTask : DefaultTask() {
    @get:InputFile @get:PathSensitive(PathSensitivity.NONE) abstract val themeFile: RegularFileProperty
    @get:OutputDirectory abstract val assetsDir: DirectoryProperty
    @get:OutputDirectory abstract val resDir: DirectoryProperty

    @TaskAction
    fun generate() {
        @Suppress("UNCHECKED_CAST")
        val themes = groovy.json.JsonSlurper().parse(themeFile.get().asFile) as Map<String, Map<String, String>>
        val light = themes.getValue("Canyon light")
        val dark = themes.getValue("Canyon dark")
        require(light.keys == dark.keys) { "Canyon light and dark must define the same tokens" }

        fun cssVars(tokens: Map<String, String>, indent: String) =
            tokens.entries.joinToString("\n") { (k, v) -> "$indent--$k: $v;" }
        fun xmlColor(name: String, value: String) = "    <color name=\"$name\">${value.uppercase()}</color>"
        fun write(file: java.io.File, text: String) { file.parentFile.mkdirs(); file.writeText(text) }
        val header = "Generated from design/theme-canyon.json by :app:generateTheme. Do not edit."

        write(assetsDir.get().file("theme.css").asFile, buildString {
            appendLine("/* $header */")
            appendLine(":root {\n  color-scheme: light dark;\n${cssVars(light, "  ")}\n}")
            appendLine("@media (prefers-color-scheme: dark) {\n  :root {\n${cssVars(dark, "    ")}\n  }\n}")
        })

        val res = resDir.get().asFile
        write(res.resolve("values/colors.xml"), buildString {
            appendLine("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- $header -->\n<resources>")
            light.forEach { (k, v) -> appendLine(xmlColor("canyon_light_$k", v)) }
            dark.forEach { (k, v) -> appendLine(xmlColor("canyon_dark_$k", v)) }
            light.keys.forEach { k -> appendLine("    <color name=\"theme_$k\">@color/canyon_light_$k</color>") }
            appendLine("</resources>")
        })
        write(res.resolve("values-night/colors.xml"), buildString {
            appendLine("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- $header -->\n<resources>")
            dark.keys.forEach { k -> appendLine("    <color name=\"theme_$k\">@color/canyon_dark_$k</color>") }
            appendLine("</resources>")
        })
    }
}

val generateTheme = tasks.register<GenerateThemeTask>("generateTheme") {
    themeFile.set(rootProject.layout.projectDirectory.file("design/theme-canyon.json"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(generateTheme, GenerateThemeTask::assetsDir)
        variant.sources.res?.addGeneratedSourceDirectory(generateTheme, GenerateThemeTask::resDir)
    }
}
