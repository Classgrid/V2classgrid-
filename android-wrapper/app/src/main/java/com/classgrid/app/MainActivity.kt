package com.classgrid.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricPrompt
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager
import android.provider.Settings
import android.os.Build
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import androidx.core.app.ActivityCompat
import com.google.firebase.messaging.FirebaseMessaging
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private val LOCATION_PERMISSION_REQUEST_CODE = 1001
    private val NOTIFICATION_PERMISSION_REQUEST_CODE = 1002

    private lateinit var webView: WebView
    private val KEY_NAME = "ClassgridBiometricKey"
    private lateinit var prefs: SharedPreferences

    // File Upload properties
    private var fileUploadCallback: android.webkit.ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_RESULT_CODE = 1003

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("ClassgridPrefs", Context.MODE_PRIVATE)
        webView = findViewById(R.id.webView)
        
        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.mediaPlaybackRequiresUserGesture = false
        webSettings.cacheMode = WebSettings.LOAD_NO_CACHE
        webView.clearCache(true) // Aggressively clear cache on every startup
        webSettings.useWideViewPort = true
        webSettings.loadWithOverviewMode = true
        webSettings.setGeolocationEnabled(true)
        
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                // Check if we have Android location permissions
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    // We don't have it, request it. We'll grant the webview permission after the user grants the android permission.
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                        LOCATION_PERMISSION_REQUEST_CODE
                    )
                    // We retain the callback to invoke it in onRequestPermissionsResult
                    geolocationOrigin = origin
                    geolocationCallback = callback
                } else {
                    // We already have Android permission, grant WebView permission
                    callback.invoke(origin, true, false)
                }
            }

            // Enable file uploads (e.g., for profile pictures or assignments)
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: android.webkit.ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent()
                try {
                    startActivityForResult(intent!!, FILE_CHOOSER_RESULT_CODE)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    return false
                }
                return true
            }
        }
        
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString()?.lowercase() ?: ""
                
                if (url.contains("super-admin") || 
                    url.contains("org-admin") || 
                    url.contains("admin-login") ||
                    url.contains("superadmin")) {
                    Toast.makeText(this@MainActivity, "Admin access is restricted on the mobile app.", Toast.LENGTH_SHORT).show()
                    return true
                }
                
                // Intercept Google OAuth and open in secure Custom Chrome Tab
                if (url.contains("/api/auth/google") && !url.contains("callback")) {
                    val customTabsIntent = CustomTabsIntent.Builder().build()
                    val authUrl = "$url${if (url.contains("?")) "&" else "?"}android=true"
                    customTabsIntent.launchUrl(this@MainActivity, Uri.parse(authUrl))
                    return true
                }
                
                // Open all other external links (like Privacy Policy) in Custom Chrome Tab instead of inside WebView
                if (!url.contains("v2.classgrid.in") && (url.startsWith("http://") || url.startsWith("https://"))) {
                    val customTabsIntent = CustomTabsIntent.Builder().build()
                    customTabsIntent.launchUrl(this@MainActivity, Uri.parse(url))
                    return true
                }
                
                return false
            }
        }

        // Add JavaScript Bridge to connect the Web App with Native Kotlin
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidApp")

        // Prevent 1-second login flash: check if we already have the auth cookie
        val cookieManager = CookieManager.getInstance()
        val cookies = cookieManager.getCookie("https://v2.classgrid.in")
        if (cookies != null && cookies.contains("jwt=")) {
            webView.loadUrl("https://v2.classgrid.in/classroom.html")
        } else {
            webView.loadUrl("https://v2.classgrid.in/login") 
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
        
        // Handle initial intent if app was launched via deep link
        handleIntent(intent)
        
        // Request Notification Permissions (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_REQUEST_CODE)
            }
        }
    }
    
    private var geolocationOrigin: String? = null
    private var geolocationCallback: GeolocationPermissions.Callback? = null

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // Android permission granted, now grant WebView permission
                geolocationCallback?.invoke(geolocationOrigin, true, false)
            } else {
                // Android permission denied
                geolocationCallback?.invoke(geolocationOrigin, false, false)
            }
            geolocationCallback = null
            geolocationOrigin = null
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, intent: Intent?) {
        super.onActivityResult(requestCode, resultCode, intent)
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (fileUploadCallback == null) return
            val result = if (intent == null || resultCode != RESULT_OK) null else intent.data
            if (result != null) {
                fileUploadCallback?.onReceiveValue(arrayOf(result))
            } else {
                fileUploadCallback?.onReceiveValue(null)
            }
            fileUploadCallback = null
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val action = intent?.action
        val data = intent?.data
        
        if (Intent.ACTION_VIEW == action && data != null && data.scheme == "classgridapp") {
            // We just returned from the Google Custom Tab
            val token = data.getQueryParameter("token")
            val target = data.getQueryParameter("target") ?: "/classroom.html"
            if (token != null) {
                // Set the token securely in the WebView's localStorage and cookies
                val cookieManager = CookieManager.getInstance()
                cookieManager.setCookie("https://v2.classgrid.in", "jwt=$token; Path=/; HttpOnly")
                
                // Inject token into localStorage and redirect to dashboard
                webView.evaluateJavascript("localStorage.setItem('token', '$token'); window.location.href = '$target';", null)
            }
        }
    }

    // 1. Get True Hardware Device ID (Survives App Uninstalls & Data Clears)
    private fun getHardwareDeviceId(): String {
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
    }

    // 2. Generate Biometric Cryptographic KeyPair
    private fun generateSecretKey() {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        if (!keyStore.containsAlias(KEY_NAME)) {
            val keyPairGenerator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
            keyPairGenerator.initialize(
                KeyGenParameterSpec.Builder(
                    KEY_NAME,
                    KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
                )
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(true) // Forces Biometric prompt to unlock
                .build()
            )
            keyPairGenerator.generateKeyPair()
        }
    }

    // 3. Get Public Key in Base64 (to save in MongoDB)
    private fun getPublicKeyString(): String {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        val publicKey = keyStore.getCertificate(KEY_NAME).publicKey
        return Base64.encodeToString(publicKey.encoded, Base64.NO_WRAP)
    }

    // --- JAVASCRIPT INTERFACE ---
    inner class WebAppInterface(private val context: Context) {
        
        // Expose to JS: window.AndroidApp.getHardwareDeviceId()
        @JavascriptInterface
        fun getHardwareDeviceId(): String {
            return this@MainActivity.getHardwareDeviceId()
        }

        // Expose to JS: window.AndroidApp.hasBiometricKey()
        @JavascriptInterface
        fun hasBiometricKey(): Boolean {
            return try {
                val keyStore = KeyStore.getInstance("AndroidKeyStore")
                keyStore.load(null)
                keyStore.containsAlias(KEY_NAME) && keyStore.getKey(KEY_NAME, null) != null
            } catch (e: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun registerDevice(setupToken: String) {
            try {
                generateSecretKey()
                
                val executor = ContextCompat.getMainExecutor(context)
                val biometricPrompt = BiometricPrompt(this@MainActivity, executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            val deviceId = getHardwareDeviceId()
                            val publicKey = getPublicKeyString()
                            
                            // Send data back to Web JS
                            runOnUiThread {
                                val script = "javascript:onDeviceRegistered(true, null, '$deviceId', '$publicKey');"
                                webView.evaluateJavascript(script, null)
                            }
                        }
                        
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            val safeErr = errString.toString().replace("'", "\\'").replace("\n", " ")
                            runOnUiThread {
                                webView.evaluateJavascript("javascript:onDeviceRegistered(false, '$safeErr', null, null);", null)
                            }
                        }
                    })

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Secure Device Registration")
                .setSubtitle("Link this device to your Classgrid account")
                .setNegativeButtonText("Cancel")
                .build()

                runOnUiThread {
                    biometricPrompt.authenticate(promptInfo)
                }
            } catch (e: Exception) {
                val errorMsg = e.message ?: "Unknown biometric hardware error"
                val safeErr = errorMsg.replace("'", "\\'").replace("\n", " ")
                runOnUiThread {
                    webView.evaluateJavascript("javascript:onDeviceRegistered(false, 'Hardware Error: $safeErr', null, null);", null)
                }
            }
        }
        
        // Expose to JS: window.AndroidApp.signChallenge()
        @JavascriptInterface
        fun signChallenge(challenge: String, callbackName: String) {
            val executor = ContextCompat.getMainExecutor(context)
            
            try {
                val keyStore = KeyStore.getInstance("AndroidKeyStore")
                keyStore.load(null)
                val privateKey = keyStore.getKey(KEY_NAME, null) as java.security.PrivateKey
                
                val signature = Signature.getInstance("SHA256withECDSA")
                signature.initSign(privateKey)
                
                val cryptoObject = BiometricPrompt.CryptoObject(signature)

                val biometricPrompt = BiometricPrompt(this@MainActivity, executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            val sig = result.cryptoObject?.signature
                            if (sig != null) {
                                sig.update(challenge.toByteArray())
                                val signatureBytes = sig.sign()
                                val signatureBase64 = Base64.encodeToString(signatureBytes, Base64.NO_WRAP)
                                val deviceId = getHardwareDeviceId()
                                
                                runOnUiThread {
                                    webView.evaluateJavascript("javascript:$callbackName(true, null, '$deviceId', '$signatureBase64');", null)
                                }
                            }
                        }
                        
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            val safeErr = errString.toString().replace("'", "\\'").replace("\n", " ")
                            runOnUiThread {
                                webView.evaluateJavascript("javascript:$callbackName(false, '$safeErr', null, null);", null)
                            }
                        }
                    })

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Verify Identity")
                    .setSubtitle("Confirm it's you to mark attendance")
                    .setNegativeButtonText("Cancel")
                    .build()

                runOnUiThread {
                    biometricPrompt.authenticate(promptInfo, cryptoObject)
                }
            } catch (e: Exception) {
                val errorMsg = e.message ?: "Unknown biometric hardware error"
                val safeErr = errorMsg.replace("'", "\\'").replace("\n", " ")
                runOnUiThread {
                    webView.evaluateJavascript("javascript:$callbackName(false, 'Biometric Error: $safeErr', null, null);", null)
                }
            }
        }
        
        // Expose to JS: window.AndroidApp.getFcmToken()
        @JavascriptInterface
        fun getFcmToken() {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    runOnUiThread {
                        webView.evaluateJavascript("javascript:if(window.onFcmTokenReady) window.onFcmTokenReady('$token');", null)
                    }
                }
            }
        }
    }
}
