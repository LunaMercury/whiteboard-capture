package com.example.whiteboardcapture

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
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
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.whiteboardcapture.ui.theme.WhiteboardCaptureTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.URL

private val LOGIN_URL: String
    get() = "${BuildConfig.CORE_API_BASE_URL}/api/auth/login"

private val UPLOAD_URL: String
    get() = "${BuildConfig.FAST_API_BASE_URL}/upload"

private val IMAGES_URL: String
    get() = "${BuildConfig.FAST_API_BASE_URL}/images"

private enum class AppScreen {
    Camera,
    CapturedPhotos,
    Profile,
    Settings
}

data class CapturedImageRecord(
    val id: Long,
    val url: String,
    val createdAt: String
)

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

        setContent {
            WhiteboardCaptureTheme {
                // 보안 저장소에서 마지막 JWT 복원하여 앱 재실행 시 로그인 상태 유지
                var token by remember {
                    mutableStateOf(JwtSecureStorage.getToken(this))
                }
                var appScreen by remember { mutableStateOf(AppScreen.Camera) }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (token.isNullOrBlank()) {
                        LoginScreen(
                            onLoginSuccess = { nextToken ->
                                JwtSecureStorage.saveToken(this, nextToken)
                                token = nextToken
                                appScreen = AppScreen.Camera
                            }
                        )
                    } else {
                        when (appScreen) {
                            AppScreen.Camera -> CameraScreen(
                                tokenProvider = { JwtSecureStorage.getToken(this) },
                                onOpenCapturedPhotos = { appScreen = AppScreen.CapturedPhotos },
                                onOpenProfile = { appScreen = AppScreen.Profile },
                                onOpenSettings = { appScreen = AppScreen.Settings },
                                onLogout = {
                                    JwtSecureStorage.clearToken(this)
                                    token = null
                                    appScreen = AppScreen.Camera
                                }
                            )

                            AppScreen.CapturedPhotos -> CapturedPhotosScreen(
                                tokenProvider = { JwtSecureStorage.getToken(this) },
                                onBack = { appScreen = AppScreen.Camera }
                            )

                            AppScreen.Profile -> SimpleMenuScreen(
                                title = "프로필",
                                body = "로그인 계정과 프로필 설정은 이후 이곳에서 관리합니다.",
                                onBack = { appScreen = AppScreen.Camera }
                            )

                            AppScreen.Settings -> SimpleMenuScreen(
                                title = "설정",
                                body = "업로드, 보안, 알림 설정은 이후 이곳에서 관리합니다.",
                                onBack = { appScreen = AppScreen.Camera }
                            )
                        }
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
fun CameraScreen(
    tokenProvider: () -> String?,
    onOpenCapturedPhotos: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSettings: () -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var isUploading by remember { mutableStateOf(false) }
    var menuExpanded by remember { mutableStateOf(false) }

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
            Box {
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(
                        imageVector = Icons.Default.Menu,
                        contentDescription = "메뉴",
                        tint = Color(0xFFAA3BFF)
                    )
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("캡쳐한 사진") },
                        onClick = {
                            menuExpanded = false
                            onOpenCapturedPhotos()
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("프로필") },
                        onClick = {
                            menuExpanded = false
                            onOpenProfile()
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("설정") },
                        onClick = {
                            menuExpanded = false
                            onOpenSettings()
                        }
                    )
                }
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
                                // 업로드 시점마다 최신 토큰을 보안 저장소에서 복원해 사용
                                val currentToken = tokenProvider()
                                uploadImage(
                                    file = photoFile,
                                    token = currentToken,
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

@Composable
fun CapturedPhotosScreen(tokenProvider: () -> String?, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var images by remember { mutableStateOf<List<CapturedImageRecord>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var editingImage by remember { mutableStateOf<CapturedImageRecord?>(null) }
    var pendingDelete by remember { mutableStateOf<CapturedImageRecord?>(null) }

    fun loadImages() {
        val token = tokenProvider()
        if (token.isNullOrBlank()) {
            errorMessage = "로그인이 필요합니다."
            return
        }

        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                images = withContext(Dispatchers.IO) { fetchCapturedImages(token) }
            } catch (error: Exception) {
                Log.e("CapturedPhotos", "Failed to load images", error)
                errorMessage = "캡쳐한 사진을 불러오지 못했습니다."
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadImages()
    }

    editingImage?.let { image ->
        ImageEditScreen(
            image = image,
            onBack = { editingImage = null }
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFAF9FF))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "뒤로가기",
                        tint = Color(0xFF6B6375)
                    )
                }
                Text(
                    text = "캡쳐한 사진",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color(0xFF08060D)
                )
            }
            IconButton(onClick = { loadImages() }, enabled = !isLoading) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "새로고침",
                    tint = Color(0xFFAA3BFF)
                )
            }
        }

        HorizontalDivider(color = Color(0xFFAA3BFF).copy(alpha = 0.12f))

        when {
            isLoading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFFAA3BFF))
                }
            }

            errorMessage != null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(text = errorMessage ?: "", color = Color(0xFF6B6375))
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(onClick = { loadImages() }) {
                        Text("다시 시도")
                    }
                }
            }

            images.isEmpty() -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "아직 캡쳐한 사진이 없습니다.",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFF08060D)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "카메라 화면에서 칠판을 촬영하면 이곳에 표시됩니다.",
                        color = Color(0xFF6B6375)
                    )
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(images, key = { it.id }) { image ->
                        CapturedImageCard(
                            image = image,
                            onEdit = { editingImage = image },
                            onCopy = {
                                scope.launch {
                                    try {
                                        val bitmap = withContext(Dispatchers.IO) {
                                            downloadBitmap(resolveMobileImageUrl(image.url))
                                        }
                                        if (bitmap == null) {
                                            Toast.makeText(context, "이미지를 불러오지 못했습니다.", Toast.LENGTH_SHORT).show()
                                            return@launch
                                        }

                                        withContext(Dispatchers.IO) {
                                            copyBitmapToClipboard(context, bitmap, "capture-${image.id}.png")
                                        }
                                        Toast.makeText(context, "이미지를 클립보드에 복사했습니다.", Toast.LENGTH_SHORT).show()
                                    } catch (error: Exception) {
                                        Log.e("CapturedPhotos", "Failed to copy image", error)
                                        Toast.makeText(context, "복사에 실패했습니다.", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            },
                            onDelete = { pendingDelete = image }
                        )
                    }
                }
            }
        }
    }

    pendingDelete?.let { image ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("사진 삭제") },
            text = { Text("이 캡쳐 사진을 삭제할까요? 삭제하면 복구할 수 없습니다.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        val token = tokenProvider()
                        pendingDelete = null
                        if (token.isNullOrBlank()) {
                            Toast.makeText(context, "로그인이 필요합니다.", Toast.LENGTH_SHORT).show()
                            return@TextButton
                        }

                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) { deleteCapturedImage(token, image.id) }
                                images = images.filterNot { it.id == image.id }
                                Toast.makeText(context, "사진을 삭제했습니다.", Toast.LENGTH_SHORT).show()
                            } catch (error: Exception) {
                                Log.e("CapturedPhotos", "Failed to delete image", error)
                                Toast.makeText(context, "삭제에 실패했습니다.", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                ) {
                    Text("삭제")
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) {
                    Text("취소")
                }
            }
        )
    }
}

@Composable
fun CapturedImageCard(
    image: CapturedImageRecord,
    onEdit: () -> Unit,
    onCopy: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RemoteImage(
                    imageUrl = image.url,
                    modifier = Modifier
                        .size(width = 112.dp, height = 84.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFEDE9F2))
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "캡쳐 사진 #${image.id}",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color(0xFF08060D)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = image.createdAt,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF6B6375)
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("수정")
                }
                TextButton(onClick = onCopy) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("복사")
                }
                TextButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = null, tint = Color(0xFFEF4444))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("삭제", color = Color(0xFFEF4444))
                }
            }
        }
    }
}

@Composable
fun ImageEditScreen(image: CapturedImageRecord, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var sourceBitmap by remember(image.url) { mutableStateOf<Bitmap?>(null) }
    var rotationDegrees by remember(image.url) { mutableStateOf(0f) }
    var isLoading by remember(image.url) { mutableStateOf(true) }
    var errorMessage by remember(image.url) { mutableStateOf<String?>(null) }

    LaunchedEffect(image.url) {
        isLoading = true
        errorMessage = null
        sourceBitmap = withContext(Dispatchers.IO) {
            downloadBitmap(resolveMobileImageUrl(image.url))
        }
        if (sourceBitmap == null) {
            errorMessage = "이미지를 불러오지 못했습니다."
        }
        isLoading = false
    }

    val editedBitmap = remember(sourceBitmap, rotationDegrees) {
        sourceBitmap?.let { rotateBitmap(it, rotationDegrees) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFAF9FF))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "뒤로가기",
                    tint = Color(0xFF6B6375)
                )
            }
            Text(
                text = "사진 수정",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = Color(0xFF08060D)
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            when {
                isLoading -> CircularProgressIndicator(color = Color(0xFFAA3BFF))
                errorMessage != null -> Text(errorMessage ?: "", color = Color(0xFF6B6375))
                editedBitmap != null -> Image(
                    bitmap = editedBitmap.asImageBitmap(),
                    contentDescription = "수정 중인 캡쳐 사진",
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White),
                    contentScale = ContentScale.Fit
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { rotationDegrees = (rotationDegrees + 270f) % 360f },
                modifier = Modifier.weight(1f)
            ) {
                Text("왼쪽 회전")
            }
            Button(
                onClick = { rotationDegrees = (rotationDegrees + 90f) % 360f },
                modifier = Modifier.weight(1f)
            ) {
                Text("오른쪽 회전")
            }
        }
        Button(
            onClick = {
                val bitmap = editedBitmap ?: return@Button
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) {
                            copyBitmapToClipboard(context, bitmap, "edited-capture-${image.id}.png")
                        }
                        Toast.makeText(context, "수정한 이미지를 클립보드에 복사했습니다.", Toast.LENGTH_SHORT).show()
                    } catch (error: Exception) {
                        Log.e("ImageEdit", "Failed to copy edited image", error)
                        Toast.makeText(context, "복사에 실패했습니다.", Toast.LENGTH_SHORT).show()
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            enabled = editedBitmap != null
        ) {
            Text("편집본 복사")
        }
    }
}

@Composable
fun RemoteImage(imageUrl: String, modifier: Modifier = Modifier) {
    var bitmap by remember(imageUrl) { mutableStateOf<Bitmap?>(null) }
    var hasError by remember(imageUrl) { mutableStateOf(false) }

    LaunchedEffect(imageUrl) {
        hasError = false
        bitmap = withContext(Dispatchers.IO) {
            downloadBitmap(resolveMobileImageUrl(imageUrl))
        }
        hasError = bitmap == null
    }

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        when {
            bitmap != null -> Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = "캡쳐 사진",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
            hasError -> Text("불러오기 실패", color = Color(0xFF6B6375), style = MaterialTheme.typography.bodySmall)
            else -> CircularProgressIndicator(color = Color(0xFFAA3BFF), modifier = Modifier.size(28.dp))
        }
    }
}

@Composable
fun SimpleMenuScreen(title: String, body: String, onBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFAF9FF))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "뒤로가기",
                    tint = Color(0xFF6B6375)
                )
            }
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = Color(0xFF08060D)
            )
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(text = body, color = Color(0xFF6B6375))
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

                val body = it.body.string()
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

private fun uploadImage(file: File, token: String?, onResult: (Boolean, String) -> Unit) {
    if (token.isNullOrBlank()) {
        onResult(false, "로그인 토큰이 만료되었습니다. 다시 로그인해주세요.")
        return
    }
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

private fun fetchCapturedImages(token: String): List<CapturedImageRecord> {
    val request = Request.Builder()
        .url(IMAGES_URL)
        .header("Authorization", "Bearer $token")
        .get()
        .build()

    OkHttpClient().newCall(request).execute().use { response ->
        if (!response.isSuccessful) {
            throw IOException("Failed to fetch images: HTTP ${response.code}")
        }

        val body = response.body.string()
        val array = JSONArray(body)
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                add(
                    CapturedImageRecord(
                        id = item.getLong("id"),
                        url = item.getString("url"),
                        createdAt = item.optString("created_at", "")
                    )
                )
            }
        }
    }
}

private fun deleteCapturedImage(token: String, imageId: Long) {
    val request = Request.Builder()
        .url("$IMAGES_URL/$imageId")
        .header("Authorization", "Bearer $token")
        .delete()
        .build()

    OkHttpClient().newCall(request).execute().use { response ->
        if (!response.isSuccessful && response.code != 204) {
            throw IOException("Failed to delete image: HTTP ${response.code}")
        }
    }
}

private fun resolveMobileImageUrl(url: String): String {
    val fastBaseUrl = BuildConfig.FAST_API_BASE_URL.trimEnd('/')
    return url
        .replace(Regex("^http://localhost:\\d+"), fastBaseUrl)
        .replace(Regex("^http://127\\.0\\.0\\.1:\\d+"), fastBaseUrl)
}

private fun downloadBitmap(url: String): Bitmap? {
    return try {
        URL(url).openStream().use { stream ->
            BitmapFactory.decodeStream(stream)
        }
    } catch (error: Exception) {
        Log.e("ImageDownload", "Failed to download image: $url", error)
        null
    }
}

private fun rotateBitmap(bitmap: Bitmap, degrees: Float): Bitmap {
    if (degrees == 0f) {
        return bitmap
    }

    val matrix = Matrix().apply {
        postRotate(degrees)
    }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
}

private fun copyBitmapToClipboard(context: Context, bitmap: Bitmap, fileName: String) {
    val clipboardDir = File(context.cacheDir, "clipboard").apply {
        mkdirs()
    }
    val file = File(clipboardDir, fileName)
    FileOutputStream(file).use { output ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
    }

    val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.fileprovider",
        file
    )
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newUri(context.contentResolver, "Whiteboard Capture", uri))
}

private fun runOnUiThread(context: Context, action: () -> Unit) {
    if (context is ComponentActivity) {
        context.runOnUiThread(action)
    } else {
        action()
    }
}
