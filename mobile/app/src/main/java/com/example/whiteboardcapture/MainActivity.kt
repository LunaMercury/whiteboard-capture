package com.example.whiteboardcapture

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.HorizontalDivider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.whiteboardcapture.ui.theme.WhiteboardCaptureTheme
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.File
import java.io.IOException

private const val AUTH_PREFS = "auth_prefs"
private const val TOKEN_KEY = "jwt_token"
private const val LOGIN_URL = "http://10.0.2.2:8080/api/auth/login"
private const val UPLOAD_URL = "http://10.0.2.2:3000/upload"

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (!isGranted) {
            Toast.makeText(this, "카메라 권한이 필요합니다.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }

        val prefs = getSharedPreferences(AUTH_PREFS, MODE_PRIVATE)

        setContent {
            WhiteboardCaptureTheme {
                // The app restores the last JWT so students can reopen the camera without logging in again.
                var token by remember {
                    mutableStateOf(prefs.getString(TOKEN_KEY, null))
                }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (token.isNullOrBlank()) {
                        LoginScreen(
                            onLoginSuccess = { nextToken ->
                                prefs.edit().putString(TOKEN_KEY, nextToken).apply()
                                token = nextToken
                            }
                        )
                    } else {
                        CameraScreen(
                            token = token!!,
                            onLogout = {
                                prefs.edit().remove(TOKEN_KEY).apply()
                                token = null
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LoginScreen(onLoginSuccess: (String) -> Unit) {
    val context = LocalContext.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Whiteboard ",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = Color(0xFF08060D)
            )
            Text(
                text = "Capture",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = Color(0xFFAA3BFF)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "촬영한 칠판 사진을 즉시 PC로 보내보세요.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF6B6375)
        )

        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("이메일") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next
            )
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("비밀번호") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            visualTransformation = if (passwordVisible) {
                VisualTransformation.None
            } else {
                PasswordVisualTransformation()
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done
            ),
            trailingIcon = {
                val icon = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff
                val description = if (passwordVisible) "비밀번호 숨기기" else "비밀번호 보기"

                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(imageVector = icon, contentDescription = description)
                }
            }
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                if (isSubmitting) {
                    return@Button
                }

                isSubmitting = true
                // Keep networking out of the composable state graph; only push the final token back in.
                login(
                    email = email,
                    password = password,
                    onSuccess = { nextToken ->
                        runOnUiThread(context) {
                            isSubmitting = false
                            onLoginSuccess(nextToken)
                        }
                    },
                    onFailure = { message ->
                        runOnUiThread(context) {
                            isSubmitting = false
                            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                        }
                    }
                )
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !isSubmitting,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFAA3BFF),
                contentColor = Color.White,
                disabledContainerColor = Color(0xFFAA3BFF).copy(alpha = 0.5f),
                disabledContentColor = Color.White.copy(alpha = 0.5f)
            )
        ) {
            Text(if (isSubmitting) "로그인 중..." else "로그인")
        }
    }
}

@Composable
fun CameraScreen(token: String, onLogout: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var isUploading by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        // 상단 메뉴바 (Top Menu Bar) - 웹 테마 스타일 리팩토링
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFFAF9FF)) // 은은한 웹의 연보라/화이트 톤 배경
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 좌측 햄버거 메뉴 아이콘
            IconButton(onClick = { /* 메뉴 확장 등 향후 기능 연동 */ }) {
                Icon(
                    imageVector = Icons.Default.Menu,
                    contentDescription = "메뉴",
                    tint = Color(0xFFAA3BFF) // 브랜드 보라색 강조 컬러
                )
            }

            // 중앙 타이틀 (Whiteboard + Capture 보라색 포인트)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Whiteboard ",
                    color = Color(0xFF08060D), // 웹의 헤더 텍스트 색상
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold
                    )
                )
                Text(
                    text = "Capture",
                    color = Color(0xFFAA3BFF), // 웹의 액센트 퍼플
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold
                    )
                )
            }

            // 우측 로그아웃 아이콘
            IconButton(onClick = onLogout) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Logout,
                    contentDescription = "로그아웃",
                    tint = Color(0xFF6B6375) // 웹의 차분한 일반 텍스트 색상
                )
            }
        }

        // 얇은 하단 테두리 선
        HorizontalDivider(
            color = Color(0xFFAA3BFF).copy(alpha = 0.12f),
            thickness = 1.dp
        )

        // 카메라 프리뷰 및 촬영 버튼 영역
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            AndroidView(
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    previewView.scaleType = PreviewView.ScaleType.FIT_CENTER

                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()
                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                        imageCapture = ImageCapture.Builder()
                            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                            .build()

                        try {
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageCapture
                            )
                        } catch (exc: Exception) {
                            Log.e("CameraX", "Use case binding failed", exc)
                        }
                    }, ContextCompat.getMainExecutor(ctx))

                    previewView
                },
                modifier = Modifier.fillMaxSize()
            )

            Button(
                onClick = {
                    if (isUploading) {
                        return@Button
                    }

                    val capture = imageCapture ?: return@Button
                    val photoFile = File(context.cacheDir, "${System.currentTimeMillis()}.jpg")
                    val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                    isUploading = true
                    capture.takePicture(
                        outputOptions,
                        ContextCompat.getMainExecutor(context),
                        object : ImageCapture.OnImageSavedCallback {
                            override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                // Upload immediately after capture so the web dashboard can react in near real time.
                                uploadImage(
                                    file = photoFile,
                                    token = token,
                                    onResult = { success, message ->
                                        runOnUiThread(context) {
                                            isUploading = false
                                            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                                        }

                                        if (!success) {
                                            Log.e("Upload", "Upload failed: $message")
                                        }
                                    }
                                )
                            }

                            override fun onError(exc: ImageCaptureException) {
                                Log.e("CameraX", "Photo capture failed: ${exc.message}", exc)
                                isUploading = false
                            }
                        }
                    )
                },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 32.dp)
                    .size(width = 140.dp, height = 60.dp),
                enabled = !isUploading,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFAA3BFF),
                    contentColor = Color.White,
                    disabledContainerColor = Color(0xFFAA3BFF).copy(alpha = 0.5f),
                    disabledContentColor = Color.White.copy(alpha = 0.5f)
                )
            ) {
                Text(if (isUploading) "업로드 중..." else "촬영")
            }
        }
    }
}

private fun login(
    email: String,
    password: String,
    onSuccess: (String) -> Unit,
    onFailure: (String) -> Unit
) {
    val client = OkHttpClient()
    val requestBody = JSONObject()
        .put("email", email)
        .put("password", password)
        .toString()
        .toRequestBody("application/json".toMediaTypeOrNull())

    val request = Request.Builder()
        .url(LOGIN_URL)
        .post(requestBody)
        .build()

    // The mobile app uses the same Spring login endpoint as the web app to keep token issuance centralized.
    client.newCall(request).enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            Log.e("Login", "Failed to login", e)
            onFailure("로그인 요청에 실패했습니다.")
        }

        override fun onResponse(call: Call, response: Response) {
            response.use {
                if (!it.isSuccessful) {
                    onFailure("이메일 또는 비밀번호가 올바르지 않습니다.")
                    return
                }

                val body = it.body?.string().orEmpty()
                val token = JSONObject(body).optString("token")
                if (token.isBlank()) {
                    onFailure("서버 응답에 토큰이 없습니다.")
                    return
                }

                onSuccess(token)
            }
        }
    })
}

private fun uploadImage(file: File, token: String, onResult: (Boolean, String) -> Unit) {
    val client = OkHttpClient()
    val requestBody = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart(
            "image",
            file.name,
            file.asRequestBody("image/jpeg".toMediaTypeOrNull())
        )
        .build()

    val request = Request.Builder()
        .url(UPLOAD_URL)
        .header("Authorization", "Bearer $token")
        .post(requestBody)
        .build()

    // Rust owns the hot path because it can store metadata and fan out websocket events in one hop.
    client.newCall(request).enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            Log.e("Upload", "Failed to upload", e)
            onResult(false, "업로드에 실패했습니다.")
        }

        override fun onResponse(call: Call, response: Response) {
            response.use {
                if (it.isSuccessful) {
                    onResult(true, "업로드가 완료되었습니다.")
                } else {
                    onResult(false, "업로드가 거부되었습니다. 다시 로그인해주세요.")
                }
            }
        }
    })
}

private fun runOnUiThread(context: Context, action: () -> Unit) {
    if (context is ComponentActivity) {
        context.runOnUiThread(action)
    } else {
        action()
    }
}
