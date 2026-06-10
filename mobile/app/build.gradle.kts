plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val releaseCoreApiBaseUrl = providers.gradleProperty("RELEASE_CORE_API_BASE_URL")
    .orElse(providers.environmentVariable("RELEASE_CORE_API_BASE_URL"))
val releaseFastApiBaseUrl = providers.gradleProperty("RELEASE_FAST_API_BASE_URL")
    .orElse(providers.environmentVariable("RELEASE_FAST_API_BASE_URL"))
val releaseFastWsBaseUrl = providers.gradleProperty("RELEASE_FAST_WS_BASE_URL")
    .orElse(providers.environmentVariable("RELEASE_FAST_WS_BASE_URL"))

fun String.asBuildConfigString(): String = "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

val validateReleaseEndpoints = tasks.register("validateReleaseEndpoints") {
    doLast {
        val coreApi = releaseCoreApiBaseUrl.orNull
        val fastApi = releaseFastApiBaseUrl.orNull
        val fastWs = releaseFastWsBaseUrl.orNull

        if (coreApi.isNullOrBlank() || !coreApi.startsWith("https://")) {
            throw GradleException("RELEASE_CORE_API_BASE_URL must be set to an HTTPS URL for release builds.")
        }
        if (fastApi.isNullOrBlank() || !fastApi.startsWith("https://")) {
            throw GradleException("RELEASE_FAST_API_BASE_URL must be set to an HTTPS URL for release builds.")
        }
        if (fastWs.isNullOrBlank() || !fastWs.startsWith("wss://")) {
            throw GradleException("RELEASE_FAST_WS_BASE_URL must be set to a WSS URL for release builds.")
        }
    }
}

android {
    namespace = "com.example.whiteboardcapture"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.example.whiteboardcapture"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            buildConfigField("String", "CORE_API_BASE_URL", "http://10.0.2.2:18080".asBuildConfigString())
            buildConfigField("String", "FAST_API_BASE_URL", "http://10.0.2.2:3000".asBuildConfigString())
            buildConfigField("String", "FAST_WS_BASE_URL", "ws://10.0.2.2:3000/ws".asBuildConfigString())
        }
        release {
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            buildConfigField(
                "String",
                "CORE_API_BASE_URL",
                (releaseCoreApiBaseUrl.orNull ?: "https://release-core-url-required.invalid").asBuildConfigString()
            )
            buildConfigField(
                "String",
                "FAST_API_BASE_URL",
                (releaseFastApiBaseUrl.orNull ?: "https://release-fast-url-required.invalid").asBuildConfigString()
            )
            buildConfigField(
                "String",
                "FAST_WS_BASE_URL",
                (releaseFastWsBaseUrl.orNull ?: "wss://release-fast-ws-required.invalid/ws").asBuildConfigString()
            )
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

afterEvaluate {
    tasks.matching {
        it.name != validateReleaseEndpoints.name && it.name.contains("Release")
    }.configureEach {
        dependsOn(validateReleaseEndpoints)
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // CameraX & Network
    implementation(libs.camerax.core)
    implementation(libs.camerax.camera2)
    implementation(libs.camerax.lifecycle)
    implementation(libs.camerax.view)
    implementation(libs.okhttp)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.security.crypto)
}
