plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/** Copies the web app from docs/ into the APK's assets, so docs/ stays the only source. */
abstract class CopyWeb : DefaultTask() {
    @get:InputDirectory
    abstract val docs: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun run() {
        val out = outputDir.get().asFile
        out.deleteRecursively()
        out.mkdirs()
        val root = docs.get().asFile
        listOf("app", "data", "fonts").forEach { File(root, it).copyRecursively(File(out, it), overwrite = true) }
        val assets = File(out, "assets").apply { mkdirs() }
        listOf("logo.svg", "mark-flat.svg", "mark-352.png", "icon.svg", "icon-180.png").forEach {
            File(root, "assets/$it").copyTo(File(assets, it), overwrite = true)
        }
    }
}

val copyWeb = tasks.register<CopyWeb>("copyWeb") {
    docs.set(rootProject.layout.projectDirectory.dir("../docs"))
    outputDir.set(layout.buildDirectory.dir("generated/web"))
}

android {
    namespace = "com.eworldq8.ateeq"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.eworldq8.ateeq"
        minSdk = 24
        targetSdk = 36
        // Play refuses a version code it has seen, so the release workflow numbers every build.
        versionCode = (System.getenv("ATEEQ_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("ATEEQ_VERSION_NAME") ?: "1.0.0"
        resourceConfigurations += listOf("ar", "en")
    }

    // The upload key is never stored in the repository: a release build reads it from the environment.
    val keystorePath: String? = System.getenv("ATEEQ_KEYSTORE")
    signingConfigs {
        create("release") {
            if (keystorePath != null) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("ATEEQ_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ATEEQ_KEY_ALIAS") ?: "ateeq"
                keyPassword = System.getenv("ATEEQ_KEY_PASSWORD") ?: System.getenv("ATEEQ_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // Without the upload key (every build except the Play one) the release build is signed
            // with the debug key, so CI can install and photograph exactly what Play receives.
            signingConfig = signingConfigs.getByName(if (keystorePath != null) "release" else "debug")
            // R8 removes the unused parts of Kotlin and AndroidX, which are most of the app's size.
            // The mapping file travels inside the bundle and is also uploaded to Play by the release workflow.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyWeb, CopyWeb::outputDir)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.webkit:webkit:1.11.0")
}
